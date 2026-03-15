/**
 * Subwoofer Integration Interpretation
 *
 * Wraps sub-integration analysis with plain language summaries and
 * explicit phase inversion detection (ANLZ-04, ANLZ-05).
 */

import type {
  SubIntegrationAnalysis,
  CrossoverAnalysis,
  PolarityRecommendation
} from '../analysis/sub-integration.js';
import type { ConfidenceLevel, Severity } from '../types/index.js';

export interface PhaseInversionDetection {
  is_inverted: boolean;
  phase_difference_deg: number;
  confidence: ConfidenceLevel;
  explanation: string;
  expected_improvement_db?: number;
}

export interface Recommendation {
  action: string;
  expected_impact: string;
  priority: number;
  fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
  category: string;
}

export interface InterpretedResult<T> {
  data: T;
  summary: string;
  recommendations: Recommendation[];
  severity: Severity;
  confidence: ConfidenceLevel;
}

export interface SubIntegrationData {
  analysis: SubIntegrationAnalysis;
  phase_inversion: PhaseInversionDetection;
}

/**
 * Detect phase inversion based on phase difference at crossover
 *
 * Phase inversion is detected when phase difference is 150-210 degrees (near 180°).
 * This is distinct from normal phase misalignment.
 */
export function detectPhaseInversion(
  crossover: CrossoverAnalysis,
  polarity: PolarityRecommendation
): PhaseInversionDetection {
  const phaseDiff = Math.abs(crossover.phase_difference_deg);

  // Phase inversion range: 150-210 degrees (near 180)
  const isInverted = phaseDiff >= 150 && phaseDiff <= 210;

  let confidence: ConfidenceLevel;
  if (phaseDiff >= 165 && phaseDiff <= 195) {
    // Very close to 180 degrees
    confidence = 'high';
  } else if (phaseDiff >= 150 && phaseDiff <= 210) {
    // Within range but not perfect
    confidence = 'medium';
  } else {
    // Outside inversion range
    confidence = phaseDiff > 90 ? 'medium' : 'high';
  }

  let explanation: string;
  if (isInverted) {
    explanation = `Phase difference of ${crossover.phase_difference_deg.toFixed(1)}° at crossover (${crossover.detected_crossover_hz.toFixed(0)} Hz) indicates polarity inversion. Sub and mains are out of phase.`;
  } else if (phaseDiff > 90) {
    explanation = `Phase difference of ${crossover.phase_difference_deg.toFixed(1)}° at crossover suggests timing misalignment, not polarity inversion.`;
  } else {
    explanation = `Phase difference of ${crossover.phase_difference_deg.toFixed(1)}° at crossover is within normal range.`;
  }

  return {
    is_inverted: isInverted,
    phase_difference_deg: crossover.phase_difference_deg,
    confidence,
    explanation,
    expected_improvement_db: isInverted ? polarity.expected_improvement_db : undefined
  };
}

/**
 * Generate plain language summary for crossover analysis
 */
function summarizeCrossover(crossover: CrossoverAnalysis): string {
  const freq = crossover.detected_crossover_hz.toFixed(0);
  const phaseDiff = Math.abs(crossover.phase_difference_deg).toFixed(1);

  const qualityDescription = {
    excellent: 'excellent phase alignment',
    good: 'good phase alignment',
    fair: 'fair phase alignment with minor issues',
    poor: 'poor phase alignment requiring attention'
  }[crossover.phase_alignment_quality];

  return `Crossover detected at ${freq} Hz with ${qualityDescription}. Phase difference: ${phaseDiff}°.`;
}

/**
 * Generate plain language summary for timing recommendations
 */
function summarizeTiming(
  timing: SubIntegrationAnalysis['timing_recommendations']
): string {
  const adjustment = timing.adjustment_needed_ms;

  if (Math.abs(adjustment) < 0.5) {
    return 'Timing is well aligned - no adjustment needed.';
  }

  const direction = adjustment > 0 ? 'delay' : 'advance';
  const amount = Math.abs(adjustment).toFixed(1);

  return `Sub needs ${amount} ms ${direction} for optimal alignment at crossover.`;
}

/**
 * Generate recommendations from sub integration analysis
 */
function generateRecommendations(
  analysis: SubIntegrationAnalysis,
  phaseInversion: PhaseInversionDetection
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Priority 1: Phase inversion (settings fix)
  if (phaseInversion.is_inverted && analysis.polarity_recommendation.invert_recommended) {
    recommendations.push({
      action: `Invert subwoofer polarity (flip phase switch from ${analysis.polarity_recommendation.current_polarity} to ${analysis.polarity_recommendation.recommended_polarity})`,
      expected_impact: `Expected improvement: ${phaseInversion.expected_improvement_db?.toFixed(1)} dB at crossover`,
      priority: 1,
      fixability: 'settings',
      category: 'sub_integration'
    });
  }

  // Priority 2: Timing adjustment (settings fix)
  if (Math.abs(analysis.timing_recommendations.adjustment_needed_ms) >= 0.5) {
    const adjustment = analysis.timing_recommendations.adjustment_needed_ms;
    const direction = adjustment > 0 ? 'add' : 'reduce';
    const amount = Math.abs(adjustment).toFixed(1);

    recommendations.push({
      action: `${direction === 'add' ? 'Add' : 'Reduce'} subwoofer delay by ${amount} ms (from ${analysis.timing_recommendations.current_delay_ms.toFixed(1)} ms to ${analysis.timing_recommendations.optimal_delay_ms.toFixed(1)} ms)`,
      expected_impact: `Improved phase alignment at ${analysis.crossover_analysis.detected_crossover_hz.toFixed(0)} Hz crossover`,
      priority: phaseInversion.is_inverted ? 2 : 1,
      fixability: 'settings',
      category: 'sub_integration'
    });
  }

  // Priority 3: Poor phase alignment (placement fix)
  if (analysis.crossover_analysis.phase_alignment_quality === 'poor' && !phaseInversion.is_inverted) {
    recommendations.push({
      action: 'Consider repositioning subwoofer - phase alignment cannot be fully corrected with timing alone',
      expected_impact: 'May improve summation by 3-6 dB at crossover region',
      priority: 3,
      fixability: 'placement',
      category: 'sub_integration'
    });
  }

  // Priority 4: Significant dip warning (informational)
  if (analysis.summation_prediction.current_dip_at_crossover_db > 6) {
    recommendations.push({
      action: `Significant crossover dip detected (${analysis.summation_prediction.current_dip_at_crossover_db.toFixed(1)} dB) - apply timing and polarity adjustments before considering placement changes`,
      expected_impact: `Predicted improvement: ${analysis.summation_prediction.improvement_db.toFixed(1)} dB reduction in dip`,
      priority: 4,
      fixability: 'settings',
      category: 'sub_integration'
    });
  }

  return recommendations;
}

/**
 * Determine severity from sub integration analysis
 */
function determineSeverity(
  analysis: SubIntegrationAnalysis,
  phaseInversion: PhaseInversionDetection
): Severity {
  // Phase inversion is always significant
  if (phaseInversion.is_inverted) {
    return 'significant';
  }

  // Large crossover dip is significant
  if (analysis.summation_prediction.current_dip_at_crossover_db > 6) {
    return 'significant';
  }

  // Poor phase alignment is moderate
  if (analysis.crossover_analysis.phase_alignment_quality === 'poor') {
    return 'moderate';
  }

  // Fair alignment or minor timing issues
  if (
    analysis.crossover_analysis.phase_alignment_quality === 'fair' ||
    Math.abs(analysis.timing_recommendations.adjustment_needed_ms) > 5
  ) {
    return 'minor';
  }

  return 'negligible';
}

/**
 * Interpret sub integration analysis with plain language summary
 *
 * Wraps existing SubIntegrationAnalysis with:
 * - Explicit phase inversion detection (150-210 degree range)
 * - Plain language summaries for crossover, timing, and polarity
 * - Prioritized recommendations (settings fixes before placement)
 */
export function interpretSubIntegration(
  analysis: SubIntegrationAnalysis
): InterpretedResult<SubIntegrationData> {
  // Detect phase inversion
  const phaseInversion = detectPhaseInversion(
    analysis.crossover_analysis,
    analysis.polarity_recommendation
  );

  // Build plain language summary
  const crossoverSummary = summarizeCrossover(analysis.crossover_analysis);
  const timingSummary = summarizeTiming(analysis.timing_recommendations);

  let summary = `${crossoverSummary} ${timingSummary}`;

  if (phaseInversion.is_inverted) {
    summary += ` ${phaseInversion.explanation}`;
  }

  if (analysis.summation_prediction.improvement_db > 1) {
    summary += ` Optimizing timing and polarity can improve summation by ${analysis.summation_prediction.improvement_db.toFixed(1)} dB.`;
  }

  // Generate recommendations
  const recommendations = generateRecommendations(analysis, phaseInversion);

  // Determine severity
  const severity = determineSeverity(analysis, phaseInversion);

  return {
    data: {
      analysis,
      phase_inversion: phaseInversion
    },
    summary,
    recommendations,
    severity,
    confidence: analysis.confidence
  };
}
