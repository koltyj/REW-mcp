/**
 * REW MCP Server Type Definitions
 * 
 * Core interfaces for measurements, analysis results, and tool responses.
 */

// ============================================================================
// Speaker and Measurement Metadata
// ============================================================================

export type SpeakerId = 'L' | 'R' | 'C' | 'Sub' | 'Combined' | 'LFE' | 'SL' | 'SR' | 'RL' | 'RR';

export interface MeasurementMetadata {
  speaker_id: SpeakerId;
  condition: string;
  mic_position_id?: string;
  notes?: string;
}

export interface ParsedFileMetadata {
  rew_version?: string;
  measurement_name?: string;
  export_date?: string;
  source_description?: string;
}

// ============================================================================
// Frequency Response Data
// ============================================================================

export interface FrequencyResponseData {
  frequencies_hz: number[];
  spl_db: number[];
  phase_degrees: number[];
}

// ============================================================================
// Impulse Response Data
// ============================================================================

export interface ImpulseResponseData {
  samples: number[];
  sample_rate_hz: number;
  peak_index: number;
  start_time_s: number;
  duration_s: number;
}

// ============================================================================
// Waterfall/Spectrogram Data
// ============================================================================

export interface WaterfallData {
  frequencies_hz: number[];
  time_slices_ms: number[];
  magnitude_db: number[][]; // [time_index][freq_index]
}

// ============================================================================
// Quick Stats
// ============================================================================

export interface QuickStats {
  bass_avg_db: number;
  midrange_avg_db: number;
  treble_avg_db: number;
  variance_20_200hz_db: number;
  variance_200_2000hz_db: number;
  variance_2000_20000hz_db: number;
}

// ============================================================================
// Data Quality
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'uncertain';

export interface DataQualityWarning {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface DataQuality {
  confidence: ConfidenceLevel;
  warnings: DataQualityWarning[];
}

// ============================================================================
// Stored Measurement
// ============================================================================

export interface StoredMeasurement {
  id: string;
  metadata: MeasurementMetadata;
  timestamp: string;
  frequency_response: FrequencyResponseData;
  impulse_response?: ImpulseResponseData;
  waterfall_data?: WaterfallData;
  quick_stats: QuickStats;
  data_quality: DataQuality;
  parsed_file_metadata: ParsedFileMetadata;
}

// ============================================================================
// Analysis Types - Peaks and Nulls
// ============================================================================

export type Severity = 'significant' | 'moderate' | 'minor' | 'negligible';
export type ModeType = 'axial' | 'tangential' | 'oblique';

export interface PeakClassification {
  type: string;
  confidence: ConfidenceLevel;
  reasoning: string;
}

export interface ModeCorrelation {
  theoretical_mode_hz: number;
  mode_type: ModeType;
  dimension: string;
  order: number;
  match_error_percent: number;
}

export interface DetectedPeak {
  frequency_hz: number;
  level_db: number;
  deviation_db: number;
  q_factor: number;
  classification?: PeakClassification;
  mode_correlation?: ModeCorrelation;
  severity: Severity;
  glm_addressable: boolean;
}

export interface DetectedNull {
  frequency_hz: number;
  level_db: number;
  depth_db: number;
  q_factor: number;
  classification?: PeakClassification;
  severity: Severity;
  glm_addressable: boolean;
  suggested_resolution?: string;
}

// ============================================================================
// Analysis Types - Room Modes
// ============================================================================

export interface TheoreticalMode {
  frequency_hz: number;
  mode_type: ModeType;
  dimension: string;
  order: number;
  detected_in_measurement: boolean;
  matched_peak_hz?: number;
}

export interface RoomDimensions {
  length: number;
  width: number;
  height: number;
}

export interface ModeDistributionAssessment {
  schroeder_frequency_hz: number;
  mode_spacing_quality: 'good' | 'fair' | 'poor';
  problematic_clusters: Array<{ frequencies_hz: number[]; severity: Severity }>;
  mode_gaps: Array<{ range_hz: [number, number]; severity: Severity }>;
}

// ============================================================================
// Analysis Types - Decay
// ============================================================================

export type DecayCharacter = 'modal_ringing' | 'severe_resonance' | 'extended_decay' | 'normal_decay';

export interface ProblematicDecay {
  frequency_hz: number;
  t60_seconds: number;
  t30_seconds?: number;
  severity: Severity;
  threshold_seconds: number;
  excess_seconds: number;
  decay_character: DecayCharacter;
  correlated_peak?: {
    found: boolean;
    peak_deviation_db?: number;
    correlation_confidence: ConfidenceLevel;
  };
  likely_cause?: string;
  glm_impact?: string;
}

// ============================================================================
// Analysis Types - Reflections
// ============================================================================

export interface EarlyReflection {
  delay_ms: number;
  level_relative_db: number;
  level_absolute_db: number;
  estimated_path_length_m: number;
  likely_source?: {
    surface: string;
    confidence: ConfidenceLevel;
    reasoning: string;
  };
  severity: 'severe' | 'significant' | 'moderate' | 'minor' | 'negligible';
  comb_filter_analysis?: {
    affected_frequencies_hz: number[];
    first_null_hz: number;
    pattern: string;
  };
  suggested_treatment?: {
    action: string;
    expected_reduction_db: string;
    confidence: ConfidenceLevel;
  };
}

export interface ClarityMetrics {
  c50_db: number;
  c80_db: number;
  d50_percent: number;
  assessment: string;
}

// ============================================================================
// Analysis Types - Comparison
// ============================================================================

export type ComparisonType = 'before_after' | 'placement_comparison' | 'lr_symmetry' | 'with_without_sub';
export type AssessmentVerdict = 'improved' | 'slightly_improved' | 'unchanged' | 'slightly_regressed' | 'regressed' | 'mixed';

export interface FrequencyBandAnalysis {
  band_name: string;
  frequency_range_hz: [number, number];
  reference_avg_db: number;
  reference_variance_db: number;
  comparison_avg_db: number;
  comparison_variance_db: number;
  level_delta_db: number;
  variance_delta_db: number;
  assessment: AssessmentVerdict;
  assessment_reason: string;
}

// ============================================================================
// GLM Interpretation Types
// ============================================================================

export interface GLMCorrection {
  issue: string;
  pre_severity?: string;
  pre_deviation_db?: number;
  post_severity?: string;
  post_deviation_db?: number;
  glm_action: string;
  effectiveness: 'highly_effective' | 'effective' | 'partially_effective' | 'minimal_effect';
  explanation: string;
}

export interface GLMBeyondScope {
  issue: string;
  severity: string;
  measured_depth_db?: number;
  why_glm_cannot_fix: {
    reason: string;
    explanation: string;
    reference?: string;
  };
  recommended_solutions: Array<{
    type: string;
    action: string;
    expected_improvement?: string;
    confidence: ConfidenceLevel;
    reversible?: boolean;
    cost?: string;
  }>;
}

// ============================================================================
// Tool Response Types
// ============================================================================

export interface ToolResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error_type?: string;
  message?: string;
  suggestion?: string;
}

export interface IngestResult {
  measurement_id: string;
  summary: {
    data_type: 'frequency_response' | 'impulse_response' | 'combined';
    frequency_range_hz: [number, number];
    data_points: number;
    points_per_octave?: number;
    has_phase_data: boolean;
    has_impulse_data: boolean;
    overall_level_db: number;
  };
  quick_stats: QuickStats;
  data_quality: DataQuality;
  parsed_file_metadata: ParsedFileMetadata;
}
