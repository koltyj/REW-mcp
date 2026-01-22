/**
 * Optimization Validation
 *
 * Validates that placement adjustments improved response through pre/post comparison.
 * Provides actionable next steps based on improvement classification.
 */

import { detectPeaks, detectNulls } from '../analysis/peaks-nulls.js';
import type { StoredMeasurement, FrequencyResponseData } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type ImprovementType = 'success' | 'partial' | 'unchanged' | 'worsened';

export interface ValidationResult {
  improvement_type: ImprovementType;
  metric_name: string;
  pre_value_db: number;
  post_value_db: number;
  improvement_db: number;
  improvement_percent: number;
  summary: string;
  next_action: string;
  explanation: string;
}

export interface TargetIssue {
  frequency_hz: number;
  category: string;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate that an adjustment improved the response.
 *
 * Classification rules:
 * - Success: 50%+ reduction in deviation (proportional threshold)
 * - Unchanged: <1/2/3 dB based on issue size (context-dependent)
 * - Partial: Between unchanged and success
 * - Worsened: improvement_percent < -10
 */
export function validateAdjustment(
  preMeasurement: StoredMeasurement,
  postMeasurement: StoredMeasurement,
  targetIssue: TargetIssue
): ValidationResult {
  // Calculate the relevant metric based on category
  const preValue = calculateMetricForCategory(
    preMeasurement,
    targetIssue.category,
    targetIssue.frequency_hz
  );
  const postValue = calculateMetricForCategory(
    postMeasurement,
    targetIssue.category,
    targetIssue.frequency_hz
  );

  // Calculate improvement
  const improvementDb = preValue - postValue;
  const improvementPercent = preValue !== 0 ? (improvementDb / Math.abs(preValue)) * 100 : 0;

  // Determine metric name for reporting
  const metricName = getMetricName(targetIssue.category, targetIssue.frequency_hz);

  // Classify improvement
  let improvementType: ImprovementType;
  let nextAction: string;
  let explanation: string;

  // Check for worsened first
  if (improvementPercent < -10) {
    improvementType = 'worsened';
    nextAction = 'This worsened the response. Try moving the opposite direction.';
    explanation = 'The adjustment increased the deviation, making the problem worse. Reverse the direction of your last change.';
  }
  // Check for success (50%+ improvement)
  else if (improvementPercent >= 50) {
    improvementType = 'success';
    nextAction = 'Good improvement. Ready to address next issue.';
    explanation = 'The adjustment significantly reduced the deviation. The physics of the change (speaker position relative to boundaries or listening position) created constructive interference at this frequency.';
  }
  // Check for unchanged (context-dependent threshold)
  else if (Math.abs(improvementDb) < getUnchangedThreshold(Math.abs(preValue))) {
    improvementType = 'unchanged';
    nextAction = 'No significant change detected. Try a different adjustment or element.';
    explanation = 'The change was too small to be meaningful. The adjustment may not have affected the dominant acoustic path causing this issue.';
  }
  // Partial improvement (between unchanged and success)
  else if (improvementPercent > 0) {
    improvementType = 'partial';
    nextAction = 'Some improvement. Consider fine-tuning or moving to next issue.';
    explanation = 'The adjustment helped but did not fully resolve the issue. You may need to continue adjusting in the same direction or combine with other changes.';
  }
  // Slight worsening (between 0 and -10%)
  else {
    improvementType = 'partial';
    nextAction = 'Slight regression. Try adjusting in the opposite direction.';
    explanation = 'The adjustment slightly worsened the response. Try moving the opposite direction or a smaller increment.';
  }

  // Generate plain language summary
  const summary = generateSummary(metricName, preValue, postValue, improvementDb, improvementPercent);

  return {
    improvement_type: improvementType,
    metric_name: metricName,
    pre_value_db: preValue,
    post_value_db: postValue,
    improvement_db: improvementDb,
    improvement_percent: improvementPercent,
    summary,
    next_action: nextAction,
    explanation
  };
}

// ============================================================================
// Metric Calculation
// ============================================================================

/**
 * Calculate the relevant metric based on issue category.
 */
function calculateMetricForCategory(
  measurement: StoredMeasurement,
  category: string,
  frequencyHz: number
): number {
  const fr = measurement.frequency_response;

  switch (category) {
    case 'peak':
      return calculatePeakDeviation(fr, frequencyHz);

    case 'null':
      return calculateNullDepth(fr, frequencyHz);

    case 'sub_integration':
      return calculateCrossoverVariance(fr);

    case 'lr_symmetry':
      // For L/R symmetry, we need separate measurements
      // For now, return overall variance as proxy
      return measurement.quick_stats.variance_20_200hz_db;

    default:
      // Default: overall 40-200 Hz variance
      return calculateBandVariance(fr, 40, 200);
  }
}

/**
 * Calculate peak deviation at target frequency.
 */
function calculatePeakDeviation(fr: FrequencyResponseData, targetHz: number): number {
  const peaks = detectPeaks(fr, { threshold_db: 3 });

  // Find peak within 5 Hz tolerance
  const matchedPeak = peaks.find(p => Math.abs(p.frequency_hz - targetHz) < 5);

  return matchedPeak ? matchedPeak.deviation_db : 0;
}

/**
 * Calculate null depth at target frequency.
 */
function calculateNullDepth(fr: FrequencyResponseData, targetHz: number): number {
  const nulls = detectNulls(fr, { threshold_db: -3 });

  // Find null within 5 Hz tolerance
  const matchedNull = nulls.find(n => Math.abs(n.frequency_hz - targetHz) < 5);

  return matchedNull ? matchedNull.depth_db : 0;
}

/**
 * Calculate variance in crossover region (40-100 Hz).
 */
function calculateCrossoverVariance(fr: FrequencyResponseData): number {
  return calculateBandVariance(fr, 40, 100);
}

/**
 * Calculate variance in frequency band.
 */
function calculateBandVariance(fr: FrequencyResponseData, minHz: number, maxHz: number): number {
  const { frequencies_hz, spl_db } = fr;
  const values: number[] = [];

  for (let i = 0; i < frequencies_hz.length; i++) {
    if (frequencies_hz[i] >= minHz && frequencies_hz[i] <= maxHz) {
      values.push(spl_db[i]);
    }
  }

  if (values.length === 0) return 0;

  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);

  return maxVal - minVal;
}

// ============================================================================
// Threshold Logic
// ============================================================================

/**
 * Get context-dependent unchanged threshold.
 *
 * Small issues (<6 dB): <1 dB change = unchanged
 * Medium issues (6-10 dB): <2 dB change = unchanged
 * Large issues (>10 dB): <3 dB change = unchanged
 */
export function getUnchangedThreshold(deviation_db: number): number {
  const absDeviation = Math.abs(deviation_db);

  if (absDeviation < 6) return 1;
  if (absDeviation < 10) return 2;
  return 3;
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get human-readable metric name.
 */
function getMetricName(category: string, frequencyHz: number): string {
  switch (category) {
    case 'peak':
      return `Peak at ${frequencyHz.toFixed(0)} Hz`;
    case 'null':
      return `Null at ${frequencyHz.toFixed(0)} Hz`;
    case 'sub_integration':
      return 'Sub integration variance';
    case 'lr_symmetry':
      return 'L/R symmetry';
    default:
      return 'Bass variance';
  }
}

/**
 * Generate plain language summary with dB and percentage.
 */
function generateSummary(
  metricName: string,
  preValueDb: number,
  postValueDb: number,
  improvementDb: number,
  improvementPercent: number
): string {
  const direction = improvementDb > 0 ? 'improved' : improvementDb < 0 ? 'worsened' : 'unchanged';
  const absImprovement = Math.abs(improvementDb);
  const absPercent = Math.abs(improvementPercent);

  if (direction === 'unchanged') {
    return `${metricName}: No significant change (${preValueDb.toFixed(1)} dB)`;
  }

  return `${metricName} ${direction} from ${preValueDb.toFixed(1)} dB to ${postValueDb.toFixed(1)} dB (${absImprovement.toFixed(1)} dB ${direction === 'improved' ? 'reduction' : 'increase'}, ${absPercent.toFixed(0)}%)`;
}
