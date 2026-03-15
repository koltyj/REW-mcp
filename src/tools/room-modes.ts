/**
 * Tool: rew.analyze_room_modes
 * 
 * Analyzes measurement for room modes, peaks, and nulls.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import {
  detectPeaks,
  detectNulls,
  calculateTheoreticalModes,
  correlatePeaksWithModes,
  assessModeDistribution
} from '../analysis/index.js';
import type { ToolResponse, DetectedPeak, DetectedNull, TheoreticalMode } from '../types/index.js';

// Input schema
export const RoomModesInputSchema = z.object({
  measurement_id: z.string().min(1),
  room_dimensions_m: z.object({
    length: z.number().min(1).max(100),
    width: z.number().min(1).max(100),
    height: z.number().min(1).max(20)
  }).optional(),
  analysis_options: z.object({
    peak_threshold_db: z.number().min(1).max(20).default(5.0),
    null_threshold_db: z.number().min(-30).max(-1).default(-6.0),
    frequency_range_hz: z.tuple([
      z.number().min(1).max(1000),
      z.number().min(1).max(1000)
    ]).default([20, 300])
  }).optional()
});

export type RoomModesInput = z.infer<typeof RoomModesInputSchema>;

export interface RoomModesResult {
  measurement_id: string;
  analysis_type: 'room_mode_analysis';
  analysis_confidence: string;
  detected_peaks: DetectedPeak[];
  detected_nulls: DetectedNull[];
  theoretical_room_modes?: TheoreticalMode[];
  mode_distribution_assessment?: ReturnType<typeof assessModeDistribution>;
  summary: {
    total_peaks_detected: number;
    total_nulls_detected: number;
    modes_correlated: number;
    primary_issues: string[];
    glm_addressable_issues: number;
    placement_sensitive_issues: number;
    recommended_priority: Array<{
      priority: number;
      issue: string;
      action: string;
      reasoning: string;
    }>;
  };
}

/**
 * Execute room modes analysis tool
 */
export async function executeRoomModes(input: RoomModesInput): Promise<ToolResponse<RoomModesResult>> {
  try {
    const validated = RoomModesInputSchema.parse(input);
    
    // Get measurement
    const measurement = measurementStore.get(validated.measurement_id);
    if (!measurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurement with ID '${validated.measurement_id}' not found`,
        suggestion: 'Use rew.ingest_measurement first, or list measurements with the resources API'
      };
    }
    
    // Check we have frequency response data
    if (measurement.frequency_response.frequencies_hz.length === 0) {
      return {
        status: 'error',
        error_type: 'insufficient_data',
        message: 'Measurement does not contain frequency response data',
        suggestion: 'This analysis requires frequency response data'
      };
    }
    
    const options = validated.analysis_options ?? {
      peak_threshold_db: 5.0,
      null_threshold_db: -6.0,
      frequency_range_hz: [20, 300] as [number, number]
    };
    const freqRange = options.frequency_range_hz ?? [20, 300];
    
    // Detect peaks and nulls
    const peaks = detectPeaks(measurement.frequency_response, {
      threshold_db: options.peak_threshold_db ?? 5.0,
      min_frequency_hz: freqRange[0],
      max_frequency_hz: freqRange[1]
    });
    
    const nulls = detectNulls(measurement.frequency_response, {
      threshold_db: options.null_threshold_db ?? -6.0,
      min_frequency_hz: freqRange[0],
      max_frequency_hz: freqRange[1]
    });
    
    // Calculate theoretical modes if room dimensions provided
    let theoreticalModes: TheoreticalMode[] | undefined;
    let correlatedPeaks = peaks;
    let modeDistribution;
    
    if (validated.room_dimensions_m) {
      theoreticalModes = calculateTheoreticalModes(
        validated.room_dimensions_m,
        freqRange[1]
      );
      
      correlatedPeaks = correlatePeaksWithModes(peaks, theoreticalModes);
      modeDistribution = assessModeDistribution(theoreticalModes);
      
      // Mark modes that were detected
      for (const peak of correlatedPeaks) {
        if (peak.mode_correlation) {
          const mode = theoreticalModes.find(
            m => Math.abs(m.frequency_hz - peak.mode_correlation!.theoretical_mode_hz) < 0.1
          );
          if (mode) {
            mode.detected_in_measurement = true;
            mode.matched_peak_hz = peak.frequency_hz;
          }
        }
      }
    }
    
    // Analyze results
    const modesCorrelated = correlatedPeaks.filter(p => p.mode_correlation).length;
    const glmAddressable = [...peaks, ...nulls].filter(p => p.glm_addressable).length;
    const placementSensitive = peaks.filter(p => p.classification?.type.includes('Room mode')).length +
                               nulls.filter(n => n.frequency_hz < 200).length;
    
    // Generate recommendations
    const primaryIssues: string[] = [];
    const recommendations: Array<{
      priority: number;
      issue: string;
      action: string;
      reasoning: string;
    }> = [];
    
    let priority = 1;
    
    // Significant peaks
    const significantPeaks = peaks.filter(p => p.severity === 'significant');
    if (significantPeaks.length > 0) {
      primaryIssues.push(`${significantPeaks.length} significant peak(s) detected`);
      for (const peak of significantPeaks.slice(0, 3)) {
        recommendations.push({
          priority: priority++,
          issue: `Peak at ${peak.frequency_hz.toFixed(1)} Hz (${peak.deviation_db.toFixed(1)} dB)`,
          action: peak.glm_addressable 
            ? 'GLM can address with cut filter'
            : peak.mode_correlation
              ? 'Consider speaker/listener repositioning (room mode)'
              : 'Acoustic treatment or repositioning',
          reasoning: peak.classification?.reasoning ?? 'Localized peak in frequency response'
        });
      }
    }
    
    // Significant nulls
    const significantNulls = nulls.filter(n => n.severity === 'significant');
    if (significantNulls.length > 0) {
      primaryIssues.push(`${significantNulls.length} significant null(s) detected`);
      for (const nullItem of significantNulls.slice(0, 3)) {
        recommendations.push({
          priority: priority++,
          issue: `Null at ${nullItem.frequency_hz.toFixed(1)} Hz (${nullItem.depth_db.toFixed(1)} dB deep)`,
          action: nullItem.suggested_resolution ?? 'Repositioning or acoustic treatment',
          reasoning: 'Deep nulls cannot be corrected by EQ - require physical changes'
        });
      }
    }
    
    if (primaryIssues.length === 0) {
      primaryIssues.push('No significant peaks or nulls detected');
    }
    
    // Determine confidence
    const confidence = measurement.data_quality.confidence;
    
    const result: RoomModesResult = {
      measurement_id: validated.measurement_id,
      analysis_type: 'room_mode_analysis',
      analysis_confidence: confidence,
      detected_peaks: correlatedPeaks,
      detected_nulls: nulls,
      theoretical_room_modes: theoreticalModes,
      mode_distribution_assessment: modeDistribution,
      summary: {
        total_peaks_detected: peaks.length,
        total_nulls_detected: nulls.length,
        modes_correlated: modesCorrelated,
        primary_issues: primaryIssues,
        glm_addressable_issues: glmAddressable,
        placement_sensitive_issues: placementSensitive,
        recommended_priority: recommendations
      }
    };
    
    return {
      status: 'success',
      data: result
    };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      };
    }
    
    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
