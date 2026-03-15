/**
 * Tool: rew.api_calibrate_spl
 *
 * Semi-automated SPL calibration workflow for monitor level setting.
 * Plays pink noise, reads SPL meter, guides user to target level.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';
import { tuiEventBus } from '../events/index.js';

// Input schema
export const ApiCalibrateSPLInputSchema = z.object({
  action: z.enum(['start', 'check', 'stop'])
    .describe('Calibration action: start (begin pink noise + SPL meter), check (read level + get guidance), stop (end calibration)'),

  target_spl: z.number().min(60).max(100).default(85)
    .describe('Target SPL in dB (default: 85 dB broadcast reference level)'),

  tolerance_db: z.number().min(0.1).max(5).default(1.0)
    .describe('Acceptable tolerance in dB (default: 1.0 dB for Class 2 professional)'),

  weighting: z.enum(['A', 'C', 'Z']).default('C')
    .describe('SPL meter weighting (default: C for full-range monitoring)'),

  meter_id: z.number().int().min(1).max(4).default(1)
    .describe('SPL meter ID (1-4, default: 1)')
});

export type ApiCalibrateSPLInput = z.infer<typeof ApiCalibrateSPLInputSchema>;

export interface ApiCalibrateSPLResult {
  action: string;
  success: boolean;
  message: string;
  calibration_status?: {
    current_spl?: number;
    target_spl: number;
    adjustment_db?: number;
    within_tolerance: boolean;
    tolerance_db: number;
    weighting: string;
    guidance?: string;
  };
}

/**
 * Execute API calibrate SPL tool
 */
export async function executeApiCalibrateSPL(input: ApiCalibrateSPLInput): Promise<ToolResponse<ApiCalibrateSPLResult>> {
  try {
    const validated = ApiCalibrateSPLInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    switch (validated.action) {
      case 'start': {
        // Step 1: Configure generator for pink noise at -20 dBFS
        const signalSet = await client.setGeneratorSignal('Pink noise');
        if (!signalSet) {
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to set generator signal to Pink noise',
            suggestion: 'Check REW signal generator is available'
          };
        }

        const levelSet = await client.setGeneratorLevel(-20, 'dBFS');
        if (!levelSet) {
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to set generator level',
            suggestion: 'Check REW signal generator is available'
          };
        }

        // Step 2: Start generator
        const generatorStarted = await client.executeGeneratorCommand('Play');
        if (!generatorStarted) {
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to start generator',
            suggestion: 'Check REW signal generator is available'
          };
        }

        // Step 3: Wait 2 seconds for stabilization
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 4: Configure SPL meter
        const meterConfigured = await client.setSPLMeterConfig(validated.meter_id, {
          weighting: validated.weighting,
          filter: 'Slow'
        });
        if (!meterConfigured) {
          // Stop generator on failure
          await client.executeGeneratorCommand('Stop');
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to configure SPL meter',
            suggestion: 'Check REW SPL meter is available'
          };
        }

        // Step 5: Start SPL meter
        const meterStarted = await client.executeSPLMeterCommand(validated.meter_id, 'Start');
        if (!meterStarted) {
          // Stop generator on failure
          await client.executeGeneratorCommand('Stop');
          return {
            status: 'error',
            error_type: 'api_error',
            message: 'Failed to start SPL meter',
            suggestion: 'Check REW SPL meter is available'
          };
        }

        // Step 6: Wait 1 second for meter averaging
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
          status: 'success',
          data: {
            action: 'start',
            success: true,
            message: `Calibration started. Pink noise playing, SPL meter reading with ${validated.weighting}-weighting. Wait a few seconds, then use action: check.`,
            calibration_status: {
              target_spl: validated.target_spl,
              within_tolerance: false,
              tolerance_db: validated.tolerance_db,
              weighting: validated.weighting
            }
          }
        };
      }

      case 'check': {
        // Step 1: Read SPL meter
        const levels = await client.getSPLMeterLevels(validated.meter_id);

        if (!levels) {
          return {
            status: 'success',
            data: {
              action: 'check',
              success: false,
              message: 'Failed to read SPL meter. Ensure calibration was started with action: start.',
              calibration_status: {
                target_spl: validated.target_spl,
                within_tolerance: false,
                tolerance_db: validated.tolerance_db,
                weighting: validated.weighting
              }
            }
          };
        }

        // Step 2: Calculate adjustment
        const currentSPL = levels.spl;
        const adjustment = validated.target_spl - currentSPL;

        // Step 3: Determine within tolerance
        const withinTolerance = Math.abs(adjustment) <= validated.tolerance_db;

        // Step 4: Generate guidance
        let guidance: string;
        if (withinTolerance) {
          guidance = `Target achieved! Current level is within tolerance (${currentSPL.toFixed(1)} dB${levels.weighting}). Use action: stop to end calibration.`;
        } else if (adjustment > 0) {
          guidance = `Too quiet. Increase monitor volume by approximately ${Math.abs(adjustment).toFixed(1)} dB, then check again.`;
        } else {
          guidance = `Too loud. Decrease monitor volume by approximately ${Math.abs(adjustment).toFixed(1)} dB, then check again.`;
        }

        const calibrationStatus = {
          current_spl: currentSPL,
          target_spl: validated.target_spl,
          adjustment_db: adjustment,
          within_tolerance: withinTolerance,
          tolerance_db: validated.tolerance_db,
          weighting: levels.weighting,
          guidance
        };

        tuiEventBus.emit('calibration:spl_reading', calibrationStatus);

        return {
          status: 'success',
          data: {
            action: 'check',
            success: true,
            message: guidance,
            calibration_status: calibrationStatus
          }
        };
      }

      case 'stop': {
        // Step 1: Stop generator
        const generatorStopped = await client.executeGeneratorCommand('Stop');

        // Step 2: Stop SPL meter
        const meterStopped = await client.executeSPLMeterCommand(validated.meter_id, 'Stop');

        const success = generatorStopped && meterStopped;

        return {
          status: 'success',
          data: {
            action: 'stop',
            success,
            message: success
              ? 'Calibration stopped. Generator and SPL meter stopped.'
              : 'Calibration stopped with warnings (check generator and SPL meter state).',
            calibration_status: {
              target_spl: validated.target_spl,
              within_tolerance: false,
              tolerance_db: validated.tolerance_db,
              weighting: validated.weighting
            }
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: start, check, stop'
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
