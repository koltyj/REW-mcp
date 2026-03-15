/**
 * Tool: rew.api_measurement_session
 *
 * Guided L/R/Sub measurement workflow with session state.
 * Sessions persist across tool calls and can be resumed.
 * REW Pro license required for automated measurements.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';
import { tuiEventBus } from '../events/index.js';
import {
  createSession,
  getSession,
  updateSession,
  listActiveSessions,
  endSession,
  type SessionState,
  type SessionMeasurement,
} from '../session/index.js';
import {
  validateTransition,
  getNextStep,
  getStepGuidance,
  channelToStep,
  type SequenceStep,
} from '../session/index.js';

// Input schema
export const ApiMeasurementSessionInputSchema = z.object({
  action: z.enum(['start_session', 'measure', 'get_status', 'stop_session'])
    .describe('Session action: start_session (create new), measure (trigger measurement), get_status (check progress), stop_session (end)'),

  session_id: z.string().uuid().optional()
    .describe('Session UUID (required for measure/get_status/stop_session, omit for start_session)'),

  channel: z.enum(['left', 'right', 'sub']).optional()
    .describe('Channel to measure (required for measure action)'),

  notes: z.string().optional()
    .describe('User description for session (optional for start_session)')
});

export type ApiMeasurementSessionInput = z.infer<typeof ApiMeasurementSessionInputSchema>;

export interface ApiMeasurementSessionResult {
  action: string;
  session_id?: string;
  sequence_step?: SequenceStep;
  next_step?: string | null;
  message: string;
  guidance?: string;
  measurements?: SessionMeasurement[];
  session?: SessionState;
  active_sessions?: SessionState[];
}

/**
 * Execute API measurement session tool
 */
export async function executeApiMeasurementSession(
  input: ApiMeasurementSessionInput
): Promise<ToolResponse<ApiMeasurementSessionResult>> {
  try {
    const validated = ApiMeasurementSessionInputSchema.parse(input);

    switch (validated.action) {
      case 'start_session': {
        // Reject if session_id provided (must omit for new session)
        if (validated.session_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Cannot provide session_id when starting a new session',
            suggestion: 'Omit session_id parameter for start_session action'
          };
        }

        // Create new session
        const session = createSession(validated.notes);
        const guidance = getStepGuidance(session.sequence_step);

        tuiEventBus.emit('workflow:session_started', {
          session_id: session.session_id,
          created_at: session.created_at,
          target_spl: session.target_spl,
          notes: session.notes,
        });

        return {
          status: 'success',
          data: {
            action: 'start_session',
            session_id: session.session_id,
            sequence_step: session.sequence_step,
            message: `Session created: ${session.session_id}`,
            guidance,
            measurements: []
          }
        };
      }

      case 'measure': {
        // Require session_id and channel
        if (!validated.session_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'session_id required for measure action',
            suggestion: 'Provide session_id from start_session response'
          };
        }

        if (!validated.channel) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'channel required for measure action',
            suggestion: 'Provide channel: left, right, or sub'
          };
        }

        // Get session (throws if not found)
        let session: SessionState;
        try {
          session = getSession(validated.session_id);
        } catch (error) {
          return {
            status: 'error',
            error_type: 'session_error',
            message: error instanceof Error ? error.message : 'Session not found',
            suggestion: 'Use get_status action to list active sessions'
          };
        }

        // Check REW connection
        const client = getActiveApiClient();
        if (!client) {
          return {
            status: 'error',
            error_type: 'connection_error',
            message: 'Not connected to REW API. Use rew.api_connect first.',
            suggestion: 'Call rew.api_connect to establish connection'
          };
        }

        // Validate transition
        const targetStep = channelToStep(validated.channel);
        try {
          validateTransition(session.sequence_step, targetStep);
        } catch (error) {
          return {
            status: 'error',
            error_type: 'sequence_error',
            message: error instanceof Error ? error.message : 'Invalid sequence transition',
            suggestion: `Current step: ${session.sequence_step}. Expected: ${getNextStep(session.sequence_step)}`
          };
        }

        // Capture pre-transition step for event emission
        const previousStep = session.sequence_step;

        // Generate measurement name: {short_session_id}_{channel}
        const shortSessionId = session.session_id.slice(0, 8);
        const measurementName = `${shortSessionId}_${validated.channel}`;

        // Configure measurement notes
        const notesSet = await client.setMeasureNotes(measurementName);
        if (!notesSet) {
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to set measurement notes',
            suggestion: 'Check REW application state'
          };
        }

        // Enable blocking mode for synchronous measurement
        const blockingSet = await client.setBlockingMode(true);
        if (!blockingSet) {
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to set blocking mode',
            suggestion: 'Check REW application state'
          };
        }

        // Get before count
        const beforeMeasurements = await client.listMeasurements();
        const beforeCount = beforeMeasurements.length;

        // Trigger measurement
        const measureResult = await client.executeMeasureCommand('Measure');

        // Handle 403 status: Pro license required
        if (measureResult.status === 403) {
          return {
            status: 'error',
            error_type: 'license_error',
            message: 'REW Pro license required for automated measurements',
            suggestion: 'Upgrade to REW Pro: https://www.roomeqwizard.com/wizardpurchase.html'
          };
        }

        // Handle other errors
        if (!measureResult.success) {
          return {
            status: 'error',
            error_type: 'api_error',
            message: measureResult.message || 'Measurement failed',
            suggestion: 'Check REW signal generator and input levels'
          };
        }

        // Get after measurements to find the new one
        const afterMeasurements = await client.listMeasurements();
        const afterCount = afterMeasurements.length;

        // Find new measurement (last in list if count increased)
        let newMeasurement: SessionMeasurement | null = null;
        if (afterCount > beforeCount) {
          const latestMeasurement = afterMeasurements[afterCount - 1];
          newMeasurement = {
            uuid: latestMeasurement.uuid,
            name: measurementName,
            channel: validated.channel,
            timestamp: Date.now()
          };
        }

        // Update session with new measurement
        const updatedMeasurements = [...session.measurements];
        if (newMeasurement) {
          updatedMeasurements.push(newMeasurement);
        }

        // Update sequence step
        let newSequenceStep: SequenceStep = targetStep;
        if (validated.channel === 'sub') {
          newSequenceStep = 'complete';
        }

        updateSession(validated.session_id, {
          sequence_step: newSequenceStep,
          measurements: updatedMeasurements
        });

        tuiEventBus.emit('workflow:step_changed', {
          session_id: validated.session_id,
          previous_step: previousStep,
          current_step: newSequenceStep,
          next_step: getNextStep(newSequenceStep),
          guidance: getStepGuidance(newSequenceStep),
          measurement_just_completed: newMeasurement ?? undefined,
        });

        const nextStep = getNextStep(newSequenceStep);
        const guidance = getStepGuidance(newSequenceStep);

        return {
          status: 'success',
          data: {
            action: 'measure',
            session_id: validated.session_id,
            sequence_step: newSequenceStep,
            next_step: nextStep,
            message: `Measurement complete: ${measurementName}`,
            guidance,
            measurements: updatedMeasurements
          }
        };
      }

      case 'get_status': {
        // If session_id provided: return full session + guidance
        if (validated.session_id) {
          let session: SessionState;
          try {
            session = getSession(validated.session_id);
          } catch (error) {
            return {
              status: 'error',
              error_type: 'session_error',
              message: error instanceof Error ? error.message : 'Session not found',
              suggestion: 'Use get_status without session_id to list all active sessions'
            };
          }

          const nextStep = getNextStep(session.sequence_step);
          const guidance = getStepGuidance(session.sequence_step);

          return {
            status: 'success',
            data: {
              action: 'get_status',
              session_id: validated.session_id,
              sequence_step: session.sequence_step,
              next_step: nextStep,
              message: `Session status: ${session.sequence_step}`,
              guidance,
              session
            }
          };
        }

        // No session_id: list all active sessions
        const activeSessions = listActiveSessions();

        return {
          status: 'success',
          data: {
            action: 'get_status',
            message: `Active sessions: ${activeSessions.length}`,
            active_sessions: activeSessions
          }
        };
      }

      case 'stop_session': {
        // Require session_id
        if (!validated.session_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'session_id required for stop_session action',
            suggestion: 'Provide session_id to stop'
          };
        }

        // Get session (throws if not found)
        let session: SessionState;
        try {
          session = getSession(validated.session_id);
        } catch (error) {
          return {
            status: 'error',
            error_type: 'session_error',
            message: error instanceof Error ? error.message : 'Session not found',
            suggestion: 'Use get_status action to list active sessions'
          };
        }

        // Emit session completed before deleting session data
        tuiEventBus.emit('workflow:session_completed', {
          session_id: session.session_id,
          sequence_step: session.sequence_step,
          measurements: session.measurements,
          next_step: null,
        });

        // End session
        endSession(validated.session_id);

        const measurementsTaken = session.measurements.length;

        return {
          status: 'success',
          data: {
            action: 'stop_session',
            message: `Session stopped: ${validated.session_id}. Measurements taken: ${measurementsTaken}`,
            measurements: session.measurements,
            sequence_step: session.sequence_step,
            next_step: null
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: start_session, measure, get_status, stop_session'
        };
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`,
        suggestion: 'Check input parameters'
      };
    }

    if (error instanceof REWApiError) {
      tuiEventBus.emit('health:api_error', {
        code: error.code,
        httpStatus: error.httpStatus,
        message: error.message,
      });

      const suggestionMap: Record<string, string> = {
        'NOT_FOUND': 'Check REW application for errors',
        'CONNECTION_REFUSED': 'Ensure REW is running with API enabled. Check Preferences → API → Start',
        'TIMEOUT': 'REW took too long to respond. Check if REW is busy or frozen',
        'INTERNAL_ERROR': 'Check REW application for errors',
        'INVALID_RESPONSE': 'Check REW application for errors'
      };

      return {
        status: 'error',
        error_type: error.code.toLowerCase(),
        message: error.message,
        suggestion: suggestionMap[error.code] || 'Check REW application for errors'
      };
    }

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestion: 'Check REW API connection'
    };
  }
}
