/**
 * GLM Comparison and Interpretation
 *
 * Compares pre-GLM and post-GLM measurements to classify corrections.
 * Provides both full comparison mode and post-only heuristic mode.
 */

import { detectPeaks, detectNulls } from '../analysis/peaks-nulls.js';
import { classifySBIR } from './peaks-nulls-interpret.js';
import type {
  StoredMeasurement,
  ConfidenceLevel,
  GLMCorrection,
  GLMBeyondScope,
  DetectedPeak,
  DetectedNull
} from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface GLMComparisonResult {
  glm_successes: GLMCorrection[];
  glm_persistent: GLMBeyondScope[];
  glm_observations: Array<{
    observation: string;
    explanation: string;
    is_expected: boolean;
  }>;
  overcorrection_indicators: {
    bass_flatness: { detected: boolean; variance_db: number; threshold_db: number };
    null_revelation: { detected: boolean; contrast_increase_db: number };
  };
  mode: 'full_comparison' | 'post_only_heuristic';
  confidence: ConfidenceLevel;
}

interface IssueComparison {
  frequency_hz: number;
  pre_deviation_db: number;
  post_deviation_db: number;
  improvement_db: number;
  improvement_percent: number;
}

// ============================================================================
// Full Comparison Mode
// ============================================================================

/**
 * Compare pre-GLM and post-GLM measurements to classify corrections.
 *
 * Classification rules:
 * - Success: 50%+ reduction in deviation (proportional threshold)
 * - Unchanged: <1/2/3 dB change based on issue size (context-dependent)
 * - Partial: Between unchanged and success
 */
export function compareGLMCalibration(
  preMeasurement: StoredMeasurement,
  postMeasurement: StoredMeasurement
): GLMComparisonResult {
  // Detect peaks and nulls in both measurements
  const prePeaks = detectPeaks(preMeasurement.frequency_response, { threshold_db: 3, max_frequency_hz: 500 });
  const postPeaks = detectPeaks(postMeasurement.frequency_response, { threshold_db: 3, max_frequency_hz: 500 });
  const preNulls = detectNulls(preMeasurement.frequency_response, { threshold_db: -3, max_frequency_hz: 500 });
  const postNulls = detectNulls(postMeasurement.frequency_response, { threshold_db: -3, max_frequency_hz: 500 });

  const glm_successes: GLMCorrection[] = [];
  const glm_persistent: GLMBeyondScope[] = [];
  const glm_observations: Array<{ observation: string; explanation: string; is_expected: boolean }> = [];

  // Compare peaks (GLM can address these with cuts)
  const matchedPeaks = matchIssuesByFrequency(prePeaks, postPeaks);

  for (const match of matchedPeaks) {
    if (!match.post) {
      // Peak was completely eliminated
      glm_successes.push(createGLMSuccess(
        match.pre,
        match.pre.deviation_db,
        0,
        'Peak completely eliminated'
      ));
      continue;
    }

    const comparison: IssueComparison = {
      frequency_hz: match.pre.frequency_hz,
      pre_deviation_db: match.pre.deviation_db,
      post_deviation_db: match.post.deviation_db,
      improvement_db: match.pre.deviation_db - match.post.deviation_db,
      improvement_percent: ((match.pre.deviation_db - match.post.deviation_db) / match.pre.deviation_db) * 100
    };

    const classification = classifyCorrection(comparison);

    if (classification === 'success') {
      glm_successes.push(createGLMSuccess(
        match.pre,
        match.pre.deviation_db,
        match.post.deviation_db,
        `Peak reduced from ${match.pre.deviation_db.toFixed(1)} dB to ${match.post.deviation_db.toFixed(1)} dB (${comparison.improvement_percent.toFixed(0)}% improvement)`
      ));
    } else if (classification === 'partial') {
      glm_observations.push({
        observation: `Partial improvement at ${match.pre.frequency_hz.toFixed(0)} Hz`,
        explanation: `Peak reduced by ${comparison.improvement_db.toFixed(1)} dB (${comparison.improvement_percent.toFixed(0)}%), but remains elevated`,
        is_expected: false
      });
    }
    // Unchanged peaks are noted in observations
    else {
      glm_observations.push({
        observation: `Peak at ${match.pre.frequency_hz.toFixed(0)} Hz unchanged`,
        explanation: `Less than ${getUnchangedThreshold(match.pre.deviation_db)} dB change - peak may be outside GLM target range`,
        is_expected: true
      });
    }
  }

  // Compare nulls (GLM cannot address these - cut only)
  const matchedNulls = matchIssuesByFrequency(preNulls, postNulls);

  for (const match of matchedNulls) {
    const depth = match.post?.depth_db ?? match.pre.depth_db;

    // Deep nulls should remain (expected)
    if (depth > 10) {
      glm_persistent.push(createGLMBeyondScope(match.post ?? match.pre));
      glm_observations.push({
        observation: `Deep null at ${match.pre.frequency_hz.toFixed(0)} Hz unchanged`,
        explanation: 'GLM applies cuts only, never boosts. Deep nulls cannot be filled.',
        is_expected: true
      });
    }
  }

  // Check for new nulls in post measurement (beyond-scope issues)
  const newNulls = postNulls.filter(postNull =>
    !preNulls.some(preNull => Math.abs(preNull.frequency_hz - postNull.frequency_hz) < 5)
  );

  for (const newNull of newNulls) {
    if (newNull.depth_db > 10) {
      glm_persistent.push(createGLMBeyondScope(newNull));
    }
  }

  // Detect overcorrection
  const overcorrection_indicators = detectOvercorrectionWithComparison(preMeasurement, postMeasurement);

  // Generate observations about overall trends
  if (glm_successes.length > 0) {
    const avgImprovement = glm_successes.reduce((sum, s) => {
      const preDb = s.pre_deviation_db ?? 0;
      const postDb = s.post_deviation_db ?? 0;
      return sum + ((preDb - postDb) / preDb) * 100;
    }, 0) / glm_successes.length;

    glm_observations.push({
      observation: `GLM successfully corrected ${glm_successes.length} peaks`,
      explanation: `Average improvement: ${avgImprovement.toFixed(0)}% - GLM cut filters working as designed`,
      is_expected: true
    });
  }

  // Calculate bass variance improvement
  const preVariance = preMeasurement.quick_stats.variance_20_200hz_db;
  const postVariance = postMeasurement.quick_stats.variance_20_200hz_db;
  const varianceReduction = preVariance - postVariance;

  if (varianceReduction > 2) {
    glm_observations.push({
      observation: 'Bass response smoothed significantly',
      explanation: `Variance reduced from ${preVariance.toFixed(1)} dB to ${postVariance.toFixed(1)} dB - smoother frequency response`,
      is_expected: true
    });
  }

  return {
    glm_successes,
    glm_persistent,
    glm_observations,
    overcorrection_indicators,
    mode: 'full_comparison',
    confidence: 'high'
  };
}

// ============================================================================
// Classification Logic
// ============================================================================

/**
 * Classify correction effectiveness.
 *
 * Rules:
 * - Success: 50%+ reduction (proportional threshold)
 * - Unchanged: <1/2/3 dB based on issue size (context-dependent)
 * - Partial: Between unchanged and success
 */
function classifyCorrection(comparison: IssueComparison): 'success' | 'partial' | 'unchanged' {
  const { pre_deviation_db, improvement_db, improvement_percent } = comparison;

  // Check proportional threshold first
  if (improvement_percent >= 50) {
    return 'success';
  }

  // Check context-dependent unchanged threshold
  const unchangedThreshold = getUnchangedThreshold(pre_deviation_db);

  if (improvement_db < unchangedThreshold) {
    return 'unchanged';
  }

  // Between unchanged and success
  return 'partial';
}

/**
 * Get context-dependent unchanged threshold.
 *
 * Small issues (<6 dB): <1 dB change = unchanged
 * Medium issues (6-10 dB): <2 dB change = unchanged
 * Large issues (>10 dB): <3 dB change = unchanged
 */
function getUnchangedThreshold(deviation_db: number): number {
  const absDeviation = Math.abs(deviation_db);

  if (absDeviation < 6) return 1;
  if (absDeviation < 10) return 2;
  return 3;
}

// ============================================================================
// GLM Success/Persistent Mapping
// ============================================================================

/**
 * Create GLMCorrection object from peak improvement.
 */
function createGLMSuccess(
  peak: DetectedPeak,
  pre_deviation_db: number,
  post_deviation_db: number,
  explanation: string
): GLMCorrection {
  const improvement_percent = ((pre_deviation_db - post_deviation_db) / pre_deviation_db) * 100;

  let effectiveness: GLMCorrection['effectiveness'];
  if (improvement_percent >= 75) {
    effectiveness = 'highly_effective';
  } else if (improvement_percent >= 50) {
    effectiveness = 'effective';
  } else if (improvement_percent >= 25) {
    effectiveness = 'partially_effective';
  } else {
    effectiveness = 'minimal_effect';
  }

  return {
    issue: `Peak at ${peak.frequency_hz.toFixed(0)} Hz`,
    pre_severity: peak.severity,
    pre_deviation_db,
    post_severity: post_deviation_db < 3 ? 'negligible' : post_deviation_db < 6 ? 'minor' : 'moderate',
    post_deviation_db,
    glm_action: 'Applied parametric cut filter',
    effectiveness,
    explanation
  };
}

/**
 * Create GLMBeyondScope object from deep null.
 */
function createGLMBeyondScope(null_: DetectedNull): GLMBeyondScope {
  const sbirClassification = classifySBIR(null_);
  const isSBIR = sbirClassification.is_sbir;

  const recommended_solutions: GLMBeyondScope['recommended_solutions'] = [];

  if (isSBIR) {
    const distance = sbirClassification.estimated_boundary_distance_ft ?? 0;
    recommended_solutions.push({
      type: 'placement',
      action: `Move speaker away from boundary at ~${distance.toFixed(1)} ft distance`,
      expected_improvement: 'Can reduce SBIR null by 3-10 dB',
      confidence: 'high',
      reversible: true,
      cost: 'free'
    });
  } else {
    recommended_solutions.push({
      type: 'placement',
      action: 'Reposition speaker or listening position to avoid room mode null',
      expected_improvement: 'May reduce null by 3-6 dB',
      confidence: 'medium',
      reversible: true,
      cost: 'free'
    });

    if (null_.frequency_hz < 80) {
      recommended_solutions.push({
        type: 'treatment',
        action: 'Add bass traps in corners or pressure zones',
        expected_improvement: 'May reduce modal energy by 3-5 dB',
        confidence: 'medium',
        reversible: true,
        cost: 'moderate'
      });
    }
  }

  return {
    issue: `Deep null at ${null_.frequency_hz.toFixed(0)} Hz`,
    severity: null_.severity,
    measured_depth_db: null_.depth_db,
    why_glm_cannot_fix: {
      reason: 'cut_only_correction',
      explanation: 'GLM applies cuts only, never boosts. Deep nulls cannot be filled.',
      reference: 'Genelec GLM User Guide: "GLM uses minimum-phase cut filters only"'
    },
    recommended_solutions
  };
}

// ============================================================================
// Post-Only Heuristic Mode
// ============================================================================

/**
 * Analyze post-GLM measurement without baseline (heuristic mode).
 *
 * Uses GLM physics to infer likely behavior:
 * - Deep nulls (>10 dB) = beyond scope (GLM doesn't boost)
 * - Flat bass regions = likely GLM success
 * - Narrow peaks remaining = GLM may not have addressed
 */
export function analyzePostOnly(postMeasurement: StoredMeasurement): GLMComparisonResult {
  const peaks = detectPeaks(postMeasurement.frequency_response, { threshold_db: 3, max_frequency_hz: 500 });
  const nulls = detectNulls(postMeasurement.frequency_response, { threshold_db: -3, max_frequency_hz: 500 });

  const glm_persistent: GLMBeyondScope[] = [];
  const glm_observations: Array<{ observation: string; explanation: string; is_expected: boolean }> = [];

  // Deep nulls are beyond GLM scope
  const deepNulls = nulls.filter(n => n.depth_db > 10);

  for (const null_ of deepNulls) {
    glm_persistent.push(createGLMBeyondScope(null_));
  }

  // Check bass variance (heuristic for GLM success)
  const bassVariance = postMeasurement.quick_stats.variance_20_200hz_db;

  if (bassVariance < 6) {
    glm_observations.push({
      observation: 'Low bass variance detected',
      explanation: `Variance of ${bassVariance.toFixed(1)} dB suggests GLM successfully addressed peaks in this region`,
      is_expected: true
    });
  } else if (bassVariance > 12) {
    glm_observations.push({
      observation: 'High bass variance remains',
      explanation: `Variance of ${bassVariance.toFixed(1)} dB - significant peaks may remain or are beyond GLM scope`,
      is_expected: false
    });
  }

  // Note remaining peaks (heuristic - may or may not have been addressed)
  if (peaks.length > 0) {
    glm_observations.push({
      observation: `${peaks.length} peaks detected in post-GLM measurement`,
      explanation: 'Cannot determine if these were reduced without pre-GLM baseline',
      is_expected: true
    });
  }

  // Detect overcorrection (post-only mode)
  const overcorrection_indicators = detectOvercorrection(postMeasurement);

  glm_observations.push({
    observation: 'Post-only analysis mode',
    explanation: 'For full comparison and definitive correction assessment, provide pre-GLM measurement',
    is_expected: true
  });

  return {
    glm_successes: [], // Cannot determine without baseline
    glm_persistent,
    glm_observations,
    overcorrection_indicators,
    mode: 'post_only_heuristic',
    confidence: 'medium'
  };
}

// ============================================================================
// Overcorrection Detection
// ============================================================================

/**
 * Detect overcorrection indicators with full comparison.
 *
 * Bass flatness: Unnaturally flat sub-bass (<2 dB variance below 40 Hz)
 * Null revelation: Nulls appear deeper post-GLM due to surrounding peak reduction
 */
export function detectOvercorrectionWithComparison(
  preMeasurement: StoredMeasurement,
  postMeasurement: StoredMeasurement
): GLMComparisonResult['overcorrection_indicators'] {
  // Bass flatness check
  const bass_flatness = checkBassVariance(postMeasurement);

  // Null revelation check (contrast increase)
  const preNulls = detectNulls(preMeasurement.frequency_response, { threshold_db: -3, max_frequency_hz: 500 });
  const postNulls = detectNulls(postMeasurement.frequency_response, { threshold_db: -3, max_frequency_hz: 500 });

  let maxContrastIncrease = 0;

  for (const postNull of postNulls) {
    const preNull = preNulls.find(n => Math.abs(n.frequency_hz - postNull.frequency_hz) < 5);

    if (preNull) {
      const contrastIncrease = postNull.depth_db - preNull.depth_db;
      if (contrastIncrease > maxContrastIncrease) {
        maxContrastIncrease = contrastIncrease;
      }
    }
  }

  const null_revelation = {
    detected: maxContrastIncrease > 3,
    contrast_increase_db: maxContrastIncrease
  };

  return { bass_flatness, null_revelation };
}

/**
 * Detect overcorrection indicators (post-only mode).
 *
 * Bass flatness: Can detect from post measurement alone
 * Null revelation: Cannot detect without pre-GLM comparison
 */
export function detectOvercorrection(postMeasurement: StoredMeasurement): GLMComparisonResult['overcorrection_indicators'] {
  return {
    bass_flatness: checkBassVariance(postMeasurement),
    null_revelation: { detected: false, contrast_increase_db: 0 } // Cannot detect in post-only mode
  };
}

/**
 * Check bass variance for unnaturally flat response.
 */
function checkBassVariance(measurement: StoredMeasurement): { detected: boolean; variance_db: number; threshold_db: number } {
  const { frequencies_hz, spl_db } = measurement.frequency_response;

  // Extract 20-40 Hz range
  const bassValues: number[] = [];
  for (let i = 0; i < frequencies_hz.length; i++) {
    if (frequencies_hz[i] >= 20 && frequencies_hz[i] <= 40) {
      bassValues.push(spl_db[i]);
    }
  }

  if (bassValues.length === 0) {
    return { detected: false, variance_db: 0, threshold_db: 2 };
  }

  const maxVal = Math.max(...bassValues);
  const minVal = Math.min(...bassValues);
  const variance_db = maxVal - minVal;
  const threshold_db = 2;

  return {
    detected: variance_db < threshold_db,
    variance_db,
    threshold_db
  };
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate plain language summary from GLM comparison result.
 */
export function generateGLMSummary(result: GLMComparisonResult): string {
  const { glm_successes, glm_persistent, glm_observations, overcorrection_indicators, mode } = result;

  let summary = '';

  if (mode === 'full_comparison') {
    // Full comparison mode summary
    if (glm_successes.length > 0) {
      const avgImprovement = glm_successes.reduce((sum, s) => {
        const preDb = s.pre_deviation_db ?? 0;
        const postDb = s.post_deviation_db ?? 0;
        return sum + ((preDb - postDb) / preDb) * 100;
      }, 0) / glm_successes.length;

      summary += `GLM calibration successfully corrected ${glm_successes.length} peak${glm_successes.length > 1 ? 's' : ''} (${avgImprovement.toFixed(0)}% average improvement). `;
    }

    if (glm_persistent.length > 0) {
      summary += `${glm_persistent.length} deep null${glm_persistent.length > 1 ? 's' : ''} remain${glm_persistent.length === 1 ? 's' : ''} beyond GLM scope - these cannot be boosted, only avoided through repositioning. `;
    }

    // Note variance improvement
    const varianceObs = glm_observations.find(o => o.observation.includes('Bass response smoothed'));
    if (varianceObs) {
      summary += 'Bass response shows good variance reduction. ';
    }

    // Overcorrection notes (informational, not warning)
    if (overcorrection_indicators.bass_flatness.detected) {
      summary += `Note: Very flat sub-bass region detected (${overcorrection_indicators.bass_flatness.variance_db.toFixed(1)} dB variance below 40 Hz) - some users prefer slight natural variation. `;
    }

    if (overcorrection_indicators.null_revelation.detected) {
      summary += `Note: Nulls appear ${overcorrection_indicators.null_revelation.contrast_increase_db.toFixed(1)} dB deeper due to surrounding peak reduction - this is expected behavior. `;
    }

  } else {
    // Post-only heuristic mode summary
    summary += 'Post-GLM analysis (without baseline comparison): ';

    if (glm_persistent.length > 0) {
      summary += `${glm_persistent.length} deep null${glm_persistent.length > 1 ? 's' : ''} detected that ${glm_persistent.length === 1 ? 'is' : 'are'} beyond GLM correction scope - GLM applies cuts only and cannot boost nulls. `;
    }

    // Note variance (heuristic)
    const varianceObs = glm_observations.find(o => o.observation.includes('variance'));
    if (varianceObs) {
      const variance = overcorrection_indicators.bass_flatness.variance_db;
      summary += `Bass variance is ${variance < 6 ? 'low' : variance > 12 ? 'high' : 'moderate'} (${variance.toFixed(1)} dB)`;

      if (variance < 6) {
        summary += ', suggesting GLM successfully addressed peaks in this region. ';
      } else {
        summary += '. ';
      }
    }

    summary += 'For full comparison, provide pre-GLM measurement.';
  }

  return summary;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Match issues by frequency (within 5 Hz tolerance).
 */
function matchIssuesByFrequency<T extends { frequency_hz: number }>(
  pre: T[],
  post: T[]
): Array<{ pre: T; post: T | null }> {
  const matches: Array<{ pre: T; post: T | null }> = [];

  for (const preIssue of pre) {
    const postIssue = post.find(p => Math.abs(p.frequency_hz - preIssue.frequency_hz) < 5);
    matches.push({ pre: preIssue, post: postIssue ?? null });
  }

  return matches;
}
