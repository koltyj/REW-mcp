/**
 * Room Modes Interpretation
 *
 * Wraps room-modes analysis with plain language summaries and recommendations.
 * Correlates theoretical modes with detected peaks when provided.
 */

import type {
  TheoreticalMode,
  RoomDimensions,
  DetectedPeak,
  ConfidenceLevel,
  Severity
} from '../types/index.js';
import type { InterpretedResult, Recommendation, Fixability } from './types.js';
import {
  calculateTheoreticalModes,
  correlatePeaksWithModes,
  calculateSchroederFrequency,
  assessModeDistribution
} from '../analysis/room-modes.js';

export interface RoomModesData {
  theoretical_modes: TheoreticalMode[];
  schroeder_frequency_hz?: number;
  mode_spacing_quality?: 'good' | 'fair' | 'poor';
  problematic_clusters?: Array<{ frequencies_hz: number[]; severity: Severity }>;
  mode_gaps?: Array<{ range_hz: [number, number]; severity: Severity }>;
  correlated_peaks?: DetectedPeak[];
  dimensions_provided: boolean;
}

/**
 * Interpret room modes analysis with dimension correlation when available
 */
export function interpretRoomModes(
  peaks: DetectedPeak[],
  dimensions?: RoomDimensions,
  rt60?: number
): InterpretedResult<RoomModesData> {
  const hasDimensions = !!dimensions;

  // Calculate theoretical modes if dimensions provided
  let theoreticalModes: TheoreticalMode[] = [];
  let schroederFreq: number | undefined;
  let modeSpacingQuality: 'good' | 'fair' | 'poor' | undefined;
  let problematicClusters: Array<{ frequencies_hz: number[]; severity: Severity }> | undefined;
  let modeGaps: Array<{ range_hz: [number, number]; severity: Severity }> | undefined;
  let correlatedPeaks: DetectedPeak[] | undefined;

  if (hasDimensions && dimensions) {
    theoreticalModes = calculateTheoreticalModes(dimensions, 300);
    schroederFreq = calculateSchroederFrequency(dimensions, rt60 ?? 0.3);
    const distribution = assessModeDistribution(theoreticalModes);
    modeSpacingQuality = distribution.mode_spacing_quality;
    problematicClusters = distribution.problematic_clusters;
    modeGaps = distribution.mode_gaps;
    correlatedPeaks = correlatePeaksWithModes(peaks, theoreticalModes);
  }

  // Build data result
  const data: RoomModesData = {
    theoretical_modes: theoreticalModes,
    schroeder_frequency_hz: schroederFreq,
    mode_spacing_quality: modeSpacingQuality,
    problematic_clusters: problematicClusters,
    mode_gaps: modeGaps,
    correlated_peaks: correlatedPeaks,
    dimensions_provided: hasDimensions
  };

  // Generate summary
  const summary = generateSummary(data, peaks);

  // Generate recommendations
  const recommendations = generateRecommendations(data);

  // Determine overall severity
  const severity = calculateSeverity(data, peaks);

  // Confidence depends on whether dimensions were provided
  const confidence: ConfidenceLevel = hasDimensions ? 'high' : 'medium';

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
function generateSummary(data: RoomModesData, peaks: DetectedPeak[]): string {
  if (!data.dimensions_provided) {
    const lowPeaks = peaks.filter(p => p.frequency_hz < 200);
    return `Found ${lowPeaks.length} low frequency peaks (<200Hz) that may be room modes. ` +
           `Provide room dimensions for theoretical mode calculation and correlation analysis.`;
  }

  const {
    theoretical_modes,
    schroeder_frequency_hz,
    mode_spacing_quality,
    problematic_clusters,
    mode_gaps,
    correlated_peaks
  } = data;

  const axialCount = theoretical_modes.filter(m => m.mode_type === 'axial').length;
  const tangentialCount = theoretical_modes.filter(m => m.mode_type === 'tangential').length;
  const obliqueCount = theoretical_modes.filter(m => m.mode_type === 'oblique').length;

  const correlatedCount = correlated_peaks?.filter(p => p.mode_correlation).length ?? 0;
  const matchPercent = correlatedCount > 0 ? Math.round((correlatedCount / theoretical_modes.length) * 100) : 0;

  let summary = `Room has ${axialCount} axial modes, ${tangentialCount} tangential modes`;
  if (obliqueCount > 0) {
    summary += `, and ${obliqueCount} oblique modes`;
  }
  summary += ` below 300 Hz. `;

  if (schroeder_frequency_hz) {
    summary += `Schroeder frequency is ${Math.round(schroeder_frequency_hz)} Hz ` +
              `(below this, room modes dominate the response). `;
  }

  if (correlatedCount > 0) {
    summary += `${correlatedCount} theoretical modes (${matchPercent}%) match detected peaks in measurement. `;
  }

  if (mode_spacing_quality) {
    if (mode_spacing_quality === 'poor') {
      summary += `Mode distribution quality is POOR - `;
      if (problematic_clusters && problematic_clusters.length > 0) {
        summary += `${problematic_clusters.length} significant mode clusters found. `;
      }
      if (mode_gaps && mode_gaps.length > 0) {
        summary += `${mode_gaps.length} significant gaps in mode distribution. `;
      }
    } else if (mode_spacing_quality === 'fair') {
      summary += `Mode distribution quality is FAIR - some clustering and gaps present. `;
    } else {
      summary += `Mode distribution quality is GOOD - relatively even spacing. `;
    }
  }

  return summary;
}

/**
 * Generate recommendations based on mode analysis
 */
function generateRecommendations(data: RoomModesData): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (!data.dimensions_provided) {
    return [{
      action: 'Measure room dimensions (length, width, height) for theoretical mode calculation',
      expected_impact: 'Enables correlation of detected peaks with theoretical modes',
      priority: 1,
      fixability: 'placement' as Fixability,
      category: 'room_modes'
    }];
  }

  const { problematic_clusters, mode_gaps, correlated_peaks } = data;

  // Recommend treatment for significant mode clusters
  if (problematic_clusters && problematic_clusters.length > 0) {
    const significantClusters = problematic_clusters.filter(
      c => c.severity === 'significant'
    );

    if (significantClusters.length > 0) {
      const frequencies = significantClusters[0].frequencies_hz;
      const avgFreq = Math.round(frequencies.reduce((a, b) => a + b, 0) / frequencies.length);

      recommendations.push({
        action: `Consider bass traps for mode cluster around ${avgFreq} Hz (${frequencies.length} modes)`,
        expected_impact: 'Bass traps can reduce modal ringing by 3-6 dB',
        priority: recommendations.length + 1,
        fixability: 'treatment' as Fixability,
        category: 'room_modes'
      });
    }
  }

  // Recommend repositioning for correlated modal peaks
  const significantModalPeaks = correlated_peaks?.filter(
    p => p.mode_correlation && p.severity === 'significant'
  ) ?? [];

  if (significantModalPeaks.length > 0) {
    recommendations.push({
      action: 'Adjust speaker or listening position to minimize modal peak impact',
      expected_impact: 'Position changes can reduce modal peaks by 3-10 dB at specific frequencies',
      priority: recommendations.length + 1,
      fixability: 'placement' as Fixability,
      category: 'room_modes'
    });
  }

  // Inform about mode gaps
  if (mode_gaps && mode_gaps.length > 0) {
    const significantGaps = mode_gaps.filter(g => g.severity === 'significant');
    if (significantGaps.length > 0) {
      const gap = significantGaps[0];
      recommendations.push({
        action: `Note: Large mode gap between ${Math.round(gap.range_hz[0])}-${Math.round(gap.range_hz[1])} Hz`,
        expected_impact: 'This gap may result in uneven bass response - informational only',
        priority: recommendations.length + 1,
        fixability: 'unfixable' as Fixability,
        category: 'room_modes'
      });
    }
  }

  return recommendations;
}

/**
 * Calculate overall severity from mode analysis
 */
function calculateSeverity(data: RoomModesData, _peaks: DetectedPeak[]): Severity {
  if (!data.dimensions_provided) {
    // Can't assess without dimensions
    return 'minor';
  }

  const { mode_spacing_quality, correlated_peaks } = data;

  // Check mode distribution quality
  if (mode_spacing_quality === 'poor') {
    return 'significant';
  }

  // Check for significant correlated peaks
  const significantModalPeaks = correlated_peaks?.filter(
    p => p.mode_correlation && p.severity === 'significant'
  ).length ?? 0;

  if (significantModalPeaks >= 3) {
    return 'significant';
  } else if (significantModalPeaks >= 1) {
    return 'moderate';
  }

  if (mode_spacing_quality === 'fair') {
    return 'moderate';
  }

  return 'minor';
}
