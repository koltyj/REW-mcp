/**
 * TUI Event Type Definitions
 *
 * Defines the typed event system for the REW MCP TUI layer.
 * All events flow through a typed event bus using these definitions.
 */

import type { SequenceStep, SessionMeasurement } from '../session/index.js';

// ---------------------------------------------------------------------------
// Event Envelope
// ---------------------------------------------------------------------------

/**
 * Generic event envelope wrapping every TUI event.
 */
export interface TuiEvent<T> {
  type: string;
  timestamp: number;
  payload: T;
}

// ---------------------------------------------------------------------------
// Assessment Verdict (shared union)
// ---------------------------------------------------------------------------

export type AssessmentVerdict =
  | 'improved'
  | 'slightly_improved'
  | 'unchanged'
  | 'slightly_regressed'
  | 'regressed'
  | 'mixed';

// ---------------------------------------------------------------------------
// Confidence (shared union)
// ---------------------------------------------------------------------------

export type Confidence = 'high' | 'medium' | 'low' | 'uncertain';

// ---------------------------------------------------------------------------
// Severity (shared union)
// ---------------------------------------------------------------------------

export type Severity = 'significant' | 'moderate' | 'minor' | 'negligible';

// ---------------------------------------------------------------------------
// Zone (shared union)
// ---------------------------------------------------------------------------

export type Zone = 'good' | 'acceptable' | 'needs_work';

// ---------------------------------------------------------------------------
// Payload Interfaces
// ---------------------------------------------------------------------------

// 1. Workflow: session started
export interface WorkflowSessionStartedPayload {
  session_id: string;
  created_at: number;
  target_spl?: number;
  notes?: string;
}

// 2. Workflow: step changed
export interface WorkflowStepChangedPayload {
  session_id: string;
  previous_step: SequenceStep;
  current_step: SequenceStep;
  next_step: SequenceStep | null;
  guidance: string;
  measurement_just_completed?: SessionMeasurement;
}

// 3. Workflow: session completed
export interface WorkflowSessionCompletedPayload {
  session_id: string;
  sequence_step: SequenceStep;
  measurements: SessionMeasurement[];
  next_step: null;
}

// 4. Workflow: device status
export interface WorkflowDeviceStatusPayload {
  connected: boolean;
  input_device?: string;
  output_device?: string;
  sample_rate?: number;
  blocking_mode: boolean;
  pro_features: boolean;
  mic_calibrated: boolean;
  measurement_count: number;
  current_level_dbfs?: number;
  cal_sensitivity_db?: number;
}

// 5. Workflow: measurement ingested
export interface WorkflowMeasurementIngestedPayload {
  measurement_id: string;
  summary: {
    data_type: string;
    frequency_range_hz: [number, number];
    data_points: number;
    has_phase_data: boolean;
    has_impulse_data: boolean;
    overall_level_db: number;
  };
  quick_stats: {
    bass_avg_db: number;
    midrange_avg_db: number;
    treble_avg_db: number;
    variance_20_200hz_db: number;
    variance_200_2000hz_db: number;
    variance_2000_20000hz_db: number;
  };
  data_quality: {
    confidence: Confidence;
    warnings: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
    }>;
  };
}

// 6. Health: REW connected
export interface HealthRewConnectedPayload {
  rew_version?: string;
  measurements_available: number;
  api_capabilities: {
    pro_features: boolean;
    blocking_mode: boolean;
  };
  diagnostics?: {
    server_responding: boolean;
    openapi_available: boolean;
    api_version?: string;
    tested_url: string;
  };
}

// 7. Health: heartbeat
export interface HealthHeartbeatPayload {
  server_responding: boolean;
  openapi_available: boolean;
  api_version?: string;
  error?: string;
  suggestion?: string;
  latency_ms: number;
}

// 8. Health: API error
export interface HealthApiErrorPayload {
  code: 'NOT_FOUND' | 'CONNECTION_REFUSED' | 'TIMEOUT' | 'INTERNAL_ERROR' | 'INVALID_RESPONSE';
  httpStatus: number;
  message: string;
  endpoint?: string;
}

// 9. Analysis: room complete
export interface AnalysisRoomCompletePayload {
  overall_summary: string;
  overall_severity: Severity;
  top_recommendations: Array<{
    priority: number;
    action: string;
    expected_impact: string;
    fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
    category: string;
    priority_score: number;
  }>;
  analysis_sections: {
    peaks_nulls?: unknown;
    room_modes?: unknown;
    sub_integration?: unknown;
    lr_symmetry?: unknown;
    glm_comparison?: unknown;
  };
}

// 10. Analysis: decay complete
export interface AnalysisDecayCompletePayload {
  frequency_band_summary: Array<{
    band: string;
    range_hz: [number, number];
    avg_t60_seconds: number;
    assessment: string;
    target_t60_seconds: number;
  }>;
  problematic_frequencies: Array<{
    frequency_hz: number;
    decay_character: 'modal_ringing' | 'severe_resonance' | 'extended_decay' | 'normal_decay';
    excess_seconds: number;
    likely_cause?: string;
    severity: Severity;
    t60_seconds: number;
    threshold_seconds: number;
  }>;
}

// 11. Analysis: comparison complete
export interface AnalysisComparisonCompletePayload {
  comparison_type: string;
  overall_assessment: {
    verdict: AssessmentVerdict;
    confidence: Confidence;
    improvement_score: number;
    summary: {
      bands_improved: number;
      bands_regressed: number;
      bands_unchanged: number;
    };
  };
  frequency_band_analysis: Array<{
    band_name: string;
    frequency_range_hz: [number, number];
    reference_avg_db: number;
    reference_variance_db: number;
    comparison_avg_db: number;
    comparison_variance_db: number;
    level_delta_db: number;
    variance_delta_db: number;
    assessment: string;
    assessment_reason: string;
  }>;
  analysis_confidence: Confidence;
  analysis_limitations: string[];
}

// 12. Calibration: SPL reading
export interface CalibrationSPLReadingPayload {
  current_spl?: number;
  target_spl: number;
  adjustment_db?: number;
  within_tolerance: boolean;
  tolerance_db: number;
  weighting: string;
  guidance?: string;
}

// 13. Calibration: generator state
export interface CalibrationGeneratorStatePayload {
  playing: boolean;
  signal_type: string;
  level_dbfs: number;
  frequency_hz?: number;
}

// 14. Optimization: recommendation
export interface OptimizationRecommendationPayload {
  element: 'monitors' | 'subwoofer' | 'listening_position';
  action: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  expected_improvement: string;
  issue_frequency_hz: number;
  issue_severity: Severity;
  issue_category: string;
}

// 15. Optimization: validated
export interface OptimizationValidatedPayload {
  improvement_type: 'success' | 'partial' | 'unchanged' | 'worsened';
  metric_name: string;
  pre_value_db: number;
  post_value_db: number;
  improvement_db: number;
  improvement_percent: number;
  summary: string;
  next_action: string;
  explanation: string;
}

// 16. Optimization: progress
export interface OptimizationProgressPayload {
  overall_zone: Zone;
  should_stop: boolean;
  smoothness: {
    zone: Zone;
    variance_db: number;
    target_db: number;
    message: string;
  };
  lr_balance: {
    zone: Zone;
    max_deviation_db: number;
    target_db: number;
    message: string;
  };
  sub_integration: {
    zone: Zone;
    variance_db: number;
    target_db: number;
    message: string;
  };
  progress_summary: string;
  limitation_note?: string;
}

// ---------------------------------------------------------------------------
// Event Map — maps event name strings to their payload types
// ---------------------------------------------------------------------------

export interface TuiEventMap {
  'workflow:session_started': WorkflowSessionStartedPayload;
  'workflow:step_changed': WorkflowStepChangedPayload;
  'workflow:session_completed': WorkflowSessionCompletedPayload;
  'workflow:device_status': WorkflowDeviceStatusPayload;
  'workflow:measurement_ingested': WorkflowMeasurementIngestedPayload;
  'health:rew_connected': HealthRewConnectedPayload;
  'health:heartbeat': HealthHeartbeatPayload;
  'health:api_error': HealthApiErrorPayload;
  'analysis:room_complete': AnalysisRoomCompletePayload;
  'analysis:decay_complete': AnalysisDecayCompletePayload;
  'analysis:comparison_complete': AnalysisComparisonCompletePayload;
  'calibration:spl_reading': CalibrationSPLReadingPayload;
  'calibration:generator_state': CalibrationGeneratorStatePayload;
  'optimization:recommendation': OptimizationRecommendationPayload;
  'optimization:validated': OptimizationValidatedPayload;
  'optimization:progress': OptimizationProgressPayload;
}

// ---------------------------------------------------------------------------
// Event Type — union of all event name strings
// ---------------------------------------------------------------------------

export type TuiEventType = keyof TuiEventMap;
