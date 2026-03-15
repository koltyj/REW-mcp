/**
 * Central state reducer for the TUI client.
 *
 * Receives TuiEvent objects from the WebSocket hook and updates
 * corresponding state slices. Also maintains a rolling event log.
 */

import { useReducer, useCallback } from 'react';
import type {
  TuiEvent,
  HealthRewConnectedPayload,
  HealthHeartbeatPayload,
  HealthApiErrorPayload,
  WorkflowSessionStartedPayload,
  WorkflowStepChangedPayload,
  WorkflowSessionCompletedPayload,
  WorkflowDeviceStatusPayload,
  WorkflowMeasurementIngestedPayload,
  AnalysisRoomCompletePayload,
  AnalysisDecayCompletePayload,
  AnalysisComparisonCompletePayload,
  CalibrationSPLReadingPayload,
  CalibrationGeneratorStatePayload,
  OptimizationRecommendationPayload,
  OptimizationValidatedPayload,
  OptimizationProgressPayload,
} from '../../events/types.js';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface LogEntry {
  type: string;
  timestamp: number;
  summary: string;
}

export interface TuiState {
  connection: HealthRewConnectedPayload | null;
  heartbeat: HealthHeartbeatPayload | null;
  lastError: (HealthApiErrorPayload & { timestamp: number }) | null;
  session: WorkflowSessionStartedPayload | null;
  currentStep: WorkflowStepChangedPayload | null;
  sessionCompleted: WorkflowSessionCompletedPayload | null;
  deviceStatus: WorkflowDeviceStatusPayload | null;
  lastIngested: WorkflowMeasurementIngestedPayload | null;
  roomAnalysis: AnalysisRoomCompletePayload | null;
  decayAnalysis: AnalysisDecayCompletePayload | null;
  comparison: AnalysisComparisonCompletePayload | null;
  splReading: CalibrationSPLReadingPayload | null;
  generatorState: CalibrationGeneratorStatePayload | null;
  recommendation: OptimizationRecommendationPayload | null;
  validation: OptimizationValidatedPayload | null;
  progress: OptimizationProgressPayload | null;
  eventLog: LogEntry[];
}

const initialState: TuiState = {
  connection: null,
  heartbeat: null,
  lastError: null,
  session: null,
  currentStep: null,
  sessionCompleted: null,
  deviceStatus: null,
  lastIngested: null,
  roomAnalysis: null,
  decayAnalysis: null,
  comparison: null,
  splReading: null,
  generatorState: null,
  recommendation: null,
  validation: null,
  progress: null,
  eventLog: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_LOG_ENTRIES = 20;

function addLog(entries: LogEntry[], entry: LogEntry): LogEntry[] {
  return [entry, ...entries].slice(0, MAX_LOG_ENTRIES);
}

function summarize(type: string, payload: unknown): string {
  const p = payload as Record<string, unknown>;
  switch (type) {
    case 'workflow:session_started':
      return `Session ${p['session_id'] as string} started`;
    case 'workflow:step_changed':
      return `Step: ${p['current_step'] as string}`;
    case 'workflow:session_completed':
      return `Session ${p['session_id'] as string} completed`;
    case 'workflow:device_status':
      return `Device ${p['connected'] ? 'connected' : 'disconnected'}`;
    case 'workflow:measurement_ingested':
      return `Measurement ${p['measurement_id'] as string} ingested`;
    case 'health:rew_connected':
      return `REW connected (v${(p['rew_version'] as string | undefined) ?? '?'})`;
    case 'health:heartbeat':
      return `Heartbeat ${(p['latency_ms'] as number).toFixed(0)}ms`;
    case 'health:api_error':
      return `Error: ${p['message'] as string}`;
    case 'analysis:room_complete':
      return `Room analysis: ${p['overall_severity'] as string}`;
    case 'analysis:decay_complete':
      return 'Decay analysis complete';
    case 'analysis:comparison_complete':
      return 'Comparison analysis complete';
    case 'calibration:spl_reading':
      return `SPL: ${(p['current_spl'] as number | undefined)?.toFixed(1) ?? '?'} dB`;
    case 'calibration:generator_state':
      return `Generator ${p['playing'] ? 'playing' : 'stopped'}`;
    case 'optimization:recommendation':
      return `Rec: ${p['action'] as string}`;
    case 'optimization:validated':
      return `Validated: ${p['improvement_type'] as string}`;
    case 'optimization:progress':
      return `Zone: ${p['overall_zone'] as string}`;
    default:
      return type;
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reduceSingleEvent(state: TuiState, event: TuiEvent<unknown>): TuiState {
  const { type, timestamp, payload } = event;
  const log = addLog(state.eventLog, { type, timestamp, summary: summarize(type, payload) });

  switch (type) {
    case 'health:rew_connected':
      return { ...state, connection: payload as HealthRewConnectedPayload, eventLog: log };

    case 'health:heartbeat':
      return { ...state, heartbeat: payload as HealthHeartbeatPayload, eventLog: log };

    case 'health:api_error':
      return {
        ...state,
        lastError: { ...(payload as HealthApiErrorPayload), timestamp },
        eventLog: log,
      };

    case 'workflow:session_started':
      return {
        ...state,
        session: payload as WorkflowSessionStartedPayload,
        currentStep: null,
        sessionCompleted: null,
        eventLog: log,
      };

    case 'workflow:step_changed':
      return { ...state, currentStep: payload as WorkflowStepChangedPayload, eventLog: log };

    case 'workflow:session_completed':
      return {
        ...state,
        sessionCompleted: payload as WorkflowSessionCompletedPayload,
        eventLog: log,
      };

    case 'workflow:device_status':
      return { ...state, deviceStatus: payload as WorkflowDeviceStatusPayload, eventLog: log };

    case 'workflow:measurement_ingested':
      return {
        ...state,
        lastIngested: payload as WorkflowMeasurementIngestedPayload,
        eventLog: log,
      };

    case 'analysis:room_complete':
      return { ...state, roomAnalysis: payload as AnalysisRoomCompletePayload, eventLog: log };

    case 'analysis:decay_complete':
      return { ...state, decayAnalysis: payload as AnalysisDecayCompletePayload, eventLog: log };

    case 'analysis:comparison_complete':
      return {
        ...state,
        comparison: payload as AnalysisComparisonCompletePayload,
        eventLog: log,
      };

    case 'calibration:spl_reading':
      return { ...state, splReading: payload as CalibrationSPLReadingPayload, eventLog: log };

    case 'calibration:generator_state':
      return {
        ...state,
        generatorState: payload as CalibrationGeneratorStatePayload,
        eventLog: log,
      };

    case 'optimization:recommendation':
      return {
        ...state,
        recommendation: payload as OptimizationRecommendationPayload,
        eventLog: log,
      };

    case 'optimization:validated':
      return { ...state, validation: payload as OptimizationValidatedPayload, eventLog: log };

    case 'optimization:progress':
      return { ...state, progress: payload as OptimizationProgressPayload, eventLog: log };

    default:
      return { ...state, eventLog: log };
  }
}

function reducer(state: TuiState, event: TuiEvent<unknown>): TuiState {
  // Handle snapshot: bulk restore by iterating payload values.
  if (event.type === 'snapshot') {
    const entries = event.payload as Record<string, TuiEvent<unknown>>;
    let s = state;
    for (const value of Object.values(entries)) {
      if (value && typeof value === 'object' && 'type' in value) {
        s = reduceSingleEvent(s, value as TuiEvent<unknown>);
      }
    }
    return s;
  }

  return reduceSingleEvent(state, event);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseTuiStateResult {
  state: TuiState;
  handleEvent: (event: TuiEvent<unknown>) => void;
}

export function useTuiState(): UseTuiStateResult {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleEvent = useCallback((event: TuiEvent<unknown>) => {
    dispatch(event);
  }, []);

  return { state, handleEvent };
}
