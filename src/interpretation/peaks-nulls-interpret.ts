/**
 * Peaks and Nulls Interpretation
 *
 * Wraps peaks-nulls analysis with plain language summaries and SBIR classification.
 * Provides GLM-aware recommendations for addressable issues.
 */

import type {
  DetectedPeak,
  DetectedNull,
  ConfidenceLevel,
  Severity
} from '../types/index.js';
import type { InterpretedResult, Recommendation, Fixability } from './types.js';

const SPEED_OF_SOUND_FT_S = 1125; // ft/s

export interface SBIRClassification {
  is_sbir: boolean;
  confidence: ConfidenceLevel;
  estimated_boundary_distance_ft?: number;
  boundary_type?: 'rear_wall' | 'front_wall' | 'side_wall' | 'floor' | 'ceiling' | 'unknown';
  explanation: string;
}

export interface PeaksNullsData {
  peaks: DetectedPeak[];
  nulls: DetectedNull[];
  sbir_nulls: Array<DetectedNull & { sbir_classification: SBIRClassification }>;
}

/**
 * Classify a null as SBIR (Speaker Boundary Interference Response)
 *
 * SBIR occurs when sound reflects off a nearby boundary and cancels the direct sound.
 * Detection criteria:
 * - Frequency range: 60-300 Hz (below = room modes, above = unlikely)
 * - Q factor: > 5 (narrow null from single reflection)
 * - Distance range: 1-4 ft (typical speaker-to-boundary distance)
 *
 * Uses quarter-wavelength formula: distance_ft = 1125 / (4 * frequency_hz)
 */
export function classifySBIR(null_: DetectedNull): SBIRClassification {
  // Check frequency range
  if (null_.frequency_hz < 60) {
    return {
      is_sbir: false,
      confidence: 'high',
      explanation: `Frequency ${null_.frequency_hz.toFixed(0)} Hz is too low - likely room mode rather than boundary interference`
    };
  }

  if (null_.frequency_hz > 300) {
    return {
      is_sbir: false,
      confidence: 'high',
      explanation: `Frequency ${null_.frequency_hz.toFixed(0)} Hz is too high for typical SBIR`
    };
  }

  // Check Q factor (narrow null indicates single reflection)
  if (null_.q_factor < 5) {
    return {
      is_sbir: false,
      confidence: 'medium',
      explanation: 'Wide null (Q < 5) suggests room mode rather than boundary interference'
    };
  }

  // Calculate quarter-wavelength distance
  // At the null frequency, the reflected path is 1/4 wavelength longer than direct path
  // This corresponds to the distance from speaker to boundary
  const quarterWavelength = SPEED_OF_SOUND_FT_S / (4 * null_.frequency_hz);

  // SBIR typically occurs when speaker is 1-4 ft from boundary
  const is_sbir = quarterWavelength >= 1 && quarterWavelength <= 4;

  return {
    is_sbir,
    confidence: 'high',
    estimated_boundary_distance_ft: quarterWavelength,
    boundary_type: 'unknown', // Would need position data to determine which boundary
    explanation: is_sbir
      ? `Narrow null at ${null_.frequency_hz.toFixed(0)} Hz suggests speaker is approximately ${quarterWavelength.toFixed(1)} ft from a boundary`
      : `Calculated distance (${quarterWavelength.toFixed(1)} ft) is outside typical SBIR range (1-4 ft)`
  };
}

/**
 * Interpret peaks and nulls analysis with SBIR classification
 */
export function interpretPeaksNulls(
  peaks: DetectedPeak[],
  nulls: DetectedNull[]
): InterpretedResult<PeaksNullsData> {
  // Classify nulls for SBIR
  const sbirNulls = nulls
    .map(null_ => {
      const sbir_classification = classifySBIR(null_);
      return { ...null_, sbir_classification };
    })
    .filter(n => n.sbir_classification.is_sbir);

  const data: PeaksNullsData = {
    peaks,
    nulls,
    sbir_nulls: sbirNulls
  };

  // Generate summary
  const summary = generateSummary(data);

  // Generate recommendations
  const recommendations = generateRecommendations(data);

  // Determine overall severity
  const severity = calculateSeverity(data);

  // Confidence is high for peak/null detection
  const confidence: ConfidenceLevel = 'high';

  return {
    data,
    summary,
    recommendations,
    severity,
    confidence
  };
}

/**
 * Generate plain language summary
 */
function generateSummary(data: PeaksNullsData): string {
  const { peaks, nulls, sbir_nulls } = data;

  const significantPeaks = peaks.filter(p => p.severity === 'significant');
  const significantNulls = nulls.filter(n => n.severity === 'significant');

  let summary = `Detected ${peaks.length} peaks and ${nulls.length} nulls in frequency response. `;

  if (significantPeaks.length > 0) {
    const glmAddressablePeaks = significantPeaks.filter(p => p.glm_addressable);
    summary += `${significantPeaks.length} significant peaks found`;
    if (glmAddressablePeaks.length > 0) {
      summary += ` (${glmAddressablePeaks.length} addressable with GLM cut filters)`;
    }
    summary += `. `;
  }

  if (significantNulls.length > 0) {
    summary += `${significantNulls.length} significant nulls found - `;
    summary += `these CANNOT be boosted with GLM (cut-only correction). `;
  }

  if (sbir_nulls.length > 0) {
    summary += `Detected ${sbir_nulls.length} SBIR (boundary interference) nulls. `;
    const distances = sbir_nulls.map(n => n.sbir_classification.estimated_boundary_distance_ft!);
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    summary += `Average estimated boundary distance: ${avgDistance.toFixed(1)} ft. `;
  }

  if (peaks.length === 0 && nulls.length === 0) {
    summary = 'No significant peaks or nulls detected - frequency response is relatively flat.';
  }

  return summary;
}

/**
 * Generate recommendations based on peaks and nulls
 */
function generateRecommendations(data: PeaksNullsData): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { peaks, nulls, sbir_nulls } = data;

  // Recommend SBIR fixes (highest priority - placement fixes)
  if (sbir_nulls.length > 0) {
    const primarySBIR = sbir_nulls[0];
    const distance = primarySBIR.sbir_classification.estimated_boundary_distance_ft!;

    recommendations.push({
      action: `Move speaker away from boundary at ~${distance.toFixed(1)} ft distance (currently causing ${primarySBIR.frequency_hz.toFixed(0)} Hz null)`,
      expected_impact: `Can reduce SBIR null by 3-10 dB - nulls cannot be boosted, only avoided through repositioning`,
      priority: recommendations.length + 1,
      fixability: 'placement' as Fixability,
      category: 'sbir'
    });
  }

  // Recommend GLM correction for significant peaks
  const glmAddressablePeaks = peaks.filter(
    p => p.severity === 'significant' && p.glm_addressable
  );

  if (glmAddressablePeaks.length > 0) {
    const peakFrequencies = glmAddressablePeaks
      .slice(0, 3) // Top 3
      .map(p => `${p.frequency_hz.toFixed(0)} Hz`)
      .join(', ');

    recommendations.push({
      action: `Apply GLM cut filters to address peaks at ${peakFrequencies}`,
      expected_impact: 'Can reduce peaks by 3-10 dB using parametric EQ cuts',
      priority: recommendations.length + 1,
      fixability: 'settings' as Fixability,
      category: 'peak'
    });
  }

  // Inform about non-SBIR nulls (likely room modes)
  const nonSBIRNulls = nulls.filter(
    n => n.severity === 'significant' && !sbir_nulls.find(s => s.frequency_hz === n.frequency_hz)
  );

  if (nonSBIRNulls.length > 0) {
    const lowFreqNulls = nonSBIRNulls.filter(n => n.frequency_hz < 200);

    if (lowFreqNulls.length > 0) {
      recommendations.push({
        action: `Reposition speakers or listening position to minimize room mode nulls`,
        expected_impact: 'Position changes may reduce modal nulls by 3-6 dB - nulls cannot be boosted',
        priority: recommendations.length + 1,
        fixability: 'placement' as Fixability,
        category: 'null'
      });
    } else {
      recommendations.push({
        action: `Note: ${nonSBIRNulls.length} nulls detected that cannot be boosted with GLM`,
        expected_impact: 'Consider repositioning or acoustic treatment - informational only',
        priority: recommendations.length + 1,
        fixability: 'unfixable' as Fixability,
        category: 'null'
      });
    }
  }

  return recommendations;
}

/**
 * Calculate overall severity from peaks and nulls
 */
function calculateSeverity(data: PeaksNullsData): Severity {
  const { peaks, nulls, sbir_nulls } = data;

  const significantPeaks = peaks.filter(p => p.severity === 'significant').length;
  const significantNulls = nulls.filter(n => n.severity === 'significant').length;

  // SBIR nulls are particularly problematic
  if (sbir_nulls.length >= 2) {
    return 'significant';
  }

  if (significantPeaks + significantNulls >= 5) {
    return 'significant';
  } else if (significantPeaks + significantNulls >= 3) {
    return 'moderate';
  } else if (significantPeaks + significantNulls >= 1) {
    return 'minor';
  }

  return 'negligible';
}
