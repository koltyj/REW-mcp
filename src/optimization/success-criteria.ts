/**
 * Success Criteria Evaluation
 *
 * Evaluates progress toward +-3dB target with zone-based classification.
 * Provides separate evaluations for smoothness, L/R balance, and sub integration.
 */

import type { StoredMeasurement, FrequencyResponseData } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type SuccessZone = 'good' | 'acceptable' | 'needs_work';

export interface ZoneEvaluation {
  zone: SuccessZone;
  variance_db: number;
  target_db: number;
  message: string;
}

export interface BalanceEvaluation {
  zone: SuccessZone;
  max_deviation_db: number;
  target_db: number;
  message: string;
}

export interface SuccessCriteriaResult {
  smoothness: ZoneEvaluation;
  lr_balance: BalanceEvaluation;
  sub_integration: ZoneEvaluation;
  overall_zone: SuccessZone;
  should_stop: boolean;
  progress_summary: string;
  limitation_note?: string;
}

export interface SuccessCriteriaOptions {
  leftMeasurement?: StoredMeasurement;
  rightMeasurement?: StoredMeasurement;
  subMeasurement?: StoredMeasurement;
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate success criteria with zone-based classification.
 *
 * Zone thresholds (per CONTEXT.md and RESEARCH.md):
 * - Smoothness (40-200 Hz variance):
 *   - good: <= 3 dB (+-3 dB target)
 *   - acceptable: <= 5 dB (+-4-5 dB)
 *   - needs_work: > 5 dB
 * - L/R Balance (max deviation):
 *   - good: <= 1 dB (excellent)
 *   - acceptable: <= 2 dB (good to fair)
 *   - needs_work: > 2 dB
 * - Sub Integration (40-100 Hz variance):
 *   - good: <= 4 dB
 *   - acceptable: <= 6 dB
 *   - needs_work: > 6 dB
 */
export function evaluateSuccessCriteria(
  measurement: StoredMeasurement,
  options: SuccessCriteriaOptions = {}
): SuccessCriteriaResult {
  const { leftMeasurement, rightMeasurement, subMeasurement } = options;

  // Evaluate smoothness (primary metric)
  const smoothness = evaluateSmoothness(measurement);

  // Evaluate L/R balance (if separate measurements provided)
  const lr_balance = evaluateLRBalance(leftMeasurement, rightMeasurement);

  // Evaluate sub integration (if sub measurement provided)
  const sub_integration = evaluateSubIntegration(measurement, subMeasurement);

  // Determine overall zone (worst of the three)
  const overall_zone = getWorstZone([smoothness.zone, lr_balance.zone, sub_integration.zone]);

  // Determine if optimization should stop
  const should_stop = smoothness.zone === 'good';

  // Generate progress summary
  const progress_summary = generateProgressSummary(smoothness, lr_balance, sub_integration);

  // Generate limitation note if applicable
  const limitation_note = generateLimitationNote(smoothness, measurement);

  return {
    smoothness,
    lr_balance,
    sub_integration,
    overall_zone,
    should_stop,
    progress_summary,
    limitation_note
  };
}

// ============================================================================
// Zone Evaluations
// ============================================================================

/**
 * Evaluate smoothness (40-200 Hz variance).
 */
function evaluateSmoothness(measurement: StoredMeasurement): ZoneEvaluation {
  const variance_db = calculateBandVariance(measurement.frequency_response, 40, 200);
  const target_db = 3;

  let zone: SuccessZone;
  let message: string;

  if (variance_db <= 3) {
    zone = 'good';
    message = "Within target (+-" + variance_db.toFixed(1) + " dB) - further gains will be marginal";
  } else if (variance_db <= 5) {
    zone = 'acceptable';
    message = "Close to target (" + variance_db.toFixed(1) + " dB vs " + target_db + " dB goal) - improvement possible";
  } else {
    zone = 'needs_work';
    message = variance_db.toFixed(1) + " dB variance - target is +-" + target_db + " dB";
  }

  return { zone, variance_db, target_db, message };
}

/**
 * Evaluate L/R balance.
 */
function evaluateLRBalance(
  leftMeasurement?: StoredMeasurement,
  rightMeasurement?: StoredMeasurement
): BalanceEvaluation {
  // If measurements not provided, default to 'good' zone
  if (!leftMeasurement || !rightMeasurement) {
    return {
      zone: 'good',
      max_deviation_db: 0,
      target_db: 1,
      message: 'L/R measurements not provided - skipping balance evaluation'
    };
  }

  const max_deviation_db = calculateLRDeviation(leftMeasurement, rightMeasurement);
  const target_db = 1;

  let zone: SuccessZone;
  let message: string;

  if (max_deviation_db <= 1) {
    zone = 'good';
    message = "Excellent balance (" + max_deviation_db.toFixed(1) + " dB deviation) - within +-" + target_db + " dB target";
  } else if (max_deviation_db <= 2) {
    zone = 'acceptable';
    message = "Good balance (" + max_deviation_db.toFixed(1) + " dB vs " + target_db + " dB goal) - slight adjustment may help";
  } else {
    zone = 'needs_work';
    message = max_deviation_db.toFixed(1) + " dB deviation - target is +-" + target_db + " dB for excellent imaging";
  }

  return { zone, max_deviation_db, target_db, message };
}

/**
 * Evaluate sub integration (40-100 Hz variance).
 */
function evaluateSubIntegration(
  measurement: StoredMeasurement,
  _subMeasurement?: StoredMeasurement
): ZoneEvaluation {
  // If sub measurement not provided, use crossover region variance from main measurement
  const variance_db = calculateBandVariance(measurement.frequency_response, 40, 100);
  const target_db = 4;

  let zone: SuccessZone;
  let message: string;

  if (variance_db <= 4) {
    zone = 'good';
    message = "Smooth crossover (" + variance_db.toFixed(1) + " dB variance) - within +-" + target_db + " dB target";
  } else if (variance_db <= 6) {
    zone = 'acceptable';
    message = "Acceptable integration (" + variance_db.toFixed(1) + " dB vs " + target_db + " dB goal) - fine-tuning possible";
  } else {
    zone = 'needs_work';
    message = variance_db.toFixed(1) + " dB variance in crossover region - target is +-" + target_db + " dB";
  }

  return { zone, variance_db, target_db, message };
}

// ============================================================================
// Calculation Helpers
// ============================================================================

/**
 * Calculate variance (range) in frequency band.
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

/**
 * Calculate maximum L/R deviation in bass region.
 */
function calculateLRDeviation(
  leftMeasurement: StoredMeasurement,
  rightMeasurement: StoredMeasurement
): number {
  const { frequencies_hz: leftFreqs, spl_db: leftSpl } = leftMeasurement.frequency_response;
  const { frequencies_hz: rightFreqs, spl_db: rightSpl } = rightMeasurement.frequency_response;

  let maxDeviation = 0;

  // Compare in 40-200 Hz range
  for (let i = 0; i < leftFreqs.length; i++) {
    const freq = leftFreqs[i];
    if (freq < 40 || freq > 200) continue;

    // Find matching frequency in right measurement
    const rightIndex = rightFreqs.findIndex(f => Math.abs(f - freq) < 1);
    if (rightIndex === -1) continue;

    const deviation = Math.abs(leftSpl[i] - rightSpl[rightIndex]);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
    }
  }

  return maxDeviation;
}

// ============================================================================
// Summary Helpers
// ============================================================================

/**
 * Get worst zone from multiple evaluations.
 */
function getWorstZone(zones: SuccessZone[]): SuccessZone {
  if (zones.includes('needs_work')) return 'needs_work';
  if (zones.includes('acceptable')) return 'acceptable';
  return 'good';
}

/**
 * Generate plain language progress summary.
 */
function generateProgressSummary(
  smoothness: ZoneEvaluation,
  lr_balance: BalanceEvaluation,
  sub_integration: ZoneEvaluation
): string {
  const parts: string[] = [];

  parts.push("Smoothness: " + capitalizeFirstLetter(smoothness.zone.replace('_', ' ')));

  if (lr_balance.max_deviation_db > 0) {
    parts.push("L/R Balance: " + capitalizeFirstLetter(lr_balance.zone.replace('_', ' ')));
  }

  parts.push("Sub: " + capitalizeFirstLetter(sub_integration.zone.replace('_', ' ')));

  return parts.join('. ') + '.';
}

/**
 * Generate limitation note if target may not be achievable.
 */
function generateLimitationNote(
  smoothness: ZoneEvaluation,
  measurement: StoredMeasurement
): string | undefined {
  // If smoothness is still 'needs_work' with high variance, note potential limitation
  if (smoothness.zone === 'needs_work' && smoothness.variance_db > 8) {
    // Check for persistent issues in frequency response
    const { frequencies_hz, spl_db } = measurement.frequency_response;

    // Find worst deviation in 40-200 Hz
    let worstDeviation = 0;
    let worstFrequency = 0;

    for (let i = 0; i < frequencies_hz.length; i++) {
      const freq = frequencies_hz[i];
      if (freq < 40 || freq > 200) continue;

      // Calculate local average
      const localAvg = calculateLocalAverage(frequencies_hz, spl_db, i);
      const deviation = Math.abs(spl_db[i] - localAvg);

      if (deviation > worstDeviation) {
        worstDeviation = deviation;
        worstFrequency = freq;
      }
    }

    if (worstDeviation > 10) {
      return "Target +-3dB may not be achievable without treatment at " + worstFrequency.toFixed(0) + " Hz";
    }
  }

  return undefined;
}

/**
 * Calculate local average SPL around a frequency.
 */
function calculateLocalAverage(
  frequencies: number[],
  spl: number[],
  centerIndex: number
): number {
  const windowOctaves = 0.3;
  const centerFreq = frequencies[centerIndex];
  const minFreq = centerFreq / Math.pow(2, windowOctaves);
  const maxFreq = centerFreq * Math.pow(2, windowOctaves);

  let sum = 0;
  let count = 0;

  for (let i = 0; i < frequencies.length; i++) {
    if (i === centerIndex) continue;
    if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
      sum += spl[i];
      count++;
    }
  }

  return count > 0 ? sum / count : spl[centerIndex];
}

/**
 * Capitalize first letter of a string.
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
