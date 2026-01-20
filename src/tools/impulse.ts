/**
 * Tool: rew.analyze_impulse
 * 
 * Analyzes impulse response for early reflections.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import {
  findDirectSound,
  detectReflections,
  estimateReflectingSurface,
  analyzeCombFiltering,
  calculateITDGap,
  calculateClarityMetrics
} from '../analysis/index.js';
import type { ToolResponse, EarlyReflection, ClarityMetrics, ConfidenceLevel } from '../types/index.js';

// Input schema
export const ImpulseInputSchema = z.object({
  measurement_id: z.string().min(1),
  analysis_options: z.object({
    max_reflection_time_ms: z.number().min(10).max(200).default(50),
    reflection_threshold_db: z.number().min(-40).max(-3).default(-15)
  }).optional()
});

export type ImpulseInput = z.infer<typeof ImpulseInputSchema>;

export interface ImpulseResult {
  measurement_id: string;
  analysis_type: 'impulse_response_analysis';
  analysis_confidence: ConfidenceLevel;
  direct_sound: {
    arrival_time_ms: number;
    level_db: number;
    peak_sample_index: number;
  };
  early_reflections: EarlyReflection[];
  initial_time_delay_gap: {
    itd_ms: number;
    assessment: 'excellent' | 'good' | 'acceptable' | 'short' | 'poor';
    note: string;
    ideal_minimum_ms: number;
    impact: string;
  };
  reflection_pattern_analysis: {
    total_early_reflections: number;
    significant_reflections: number;
    average_level_db: number;
    reflection_density: 'sparse' | 'moderate' | 'dense';
  };
  comb_filtering_risk: {
    level: 'severe' | 'moderate' | 'low' | 'minimal';
    primary_concern?: {
      source: string;
      first_null_frequency_hz: number;
      affected_range: string;
    };
    expected_audible_effect: string;
  };
  clarity_metrics: ClarityMetrics;
  summary: {
    primary_issues: string[];
    reflection_quality: 'excellent' | 'good' | 'acceptable' | 'needs_improvement' | 'poor';
    recommended_priority: Array<{
      priority: number;
      issue: string;
      action: string;
      impact: string;
    }>;
  };
}

/**
 * Execute impulse analysis tool
 */
export async function executeImpulse(input: ImpulseInput): Promise<ToolResponse<ImpulseResult>> {
  try {
    const validated = ImpulseInputSchema.parse(input);
    
    // Get measurement
    const measurement = measurementStore.get(validated.measurement_id);
    if (!measurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurement with ID '${validated.measurement_id}' not found`
      };
    }
    
    // Check for impulse response data
    if (!measurement.impulse_response) {
      return {
        status: 'error',
        error_type: 'insufficient_data',
        message: 'Measurement does not contain impulse response data',
        suggestion: 'This analysis requires impulse response data. Re-export from REW with IR included.'
      };
    }
    
    const options = validated.analysis_options ?? {};
    
    // Analyze direct sound
    const directSound = findDirectSound(measurement.impulse_response);
    
    // Detect reflections
    const reflections = detectReflections(measurement.impulse_response, options);
    
    // Enhance reflections with surface estimates and comb filter analysis
    const enhancedReflections: EarlyReflection[] = reflections.map(r => {
      const surface = estimateReflectingSurface(r.estimated_path_length_m);
      const combFilter = analyzeCombFiltering(r.delay_ms);
      
      return {
        ...r,
        likely_source: surface,
        comb_filter_analysis: combFilter,
        suggested_treatment: {
          action: r.severity === 'severe' || r.severity === 'significant'
            ? `Add absorption/diffusion on ${surface.surface}`
            : 'Monitor - may not require treatment',
          expected_reduction_db: r.severity === 'severe' ? '6-10 dB' : '3-6 dB',
          confidence: surface.confidence
        }
      };
    });
    
    // Calculate ITD gap
    const itdGap = calculateITDGap(directSound.arrival_time_ms, enhancedReflections);
    const itdNote = itdGap.assessment === 'excellent' || itdGap.assessment === 'good'
      ? 'Good separation between direct sound and first reflection'
      : itdGap.assessment === 'acceptable'
        ? 'Acceptable but could be improved with repositioning'
        : 'First reflection too close - may cause imaging issues';
    
    // Calculate clarity metrics
    const clarityMetrics = calculateClarityMetrics(measurement.impulse_response);
    
    // Reflection pattern analysis
    const significantReflections = enhancedReflections.filter(
      r => r.severity === 'severe' || r.severity === 'significant'
    );
    const avgLevel = enhancedReflections.length > 0
      ? enhancedReflections.reduce((sum, r) => sum + r.level_relative_db, 0) / enhancedReflections.length
      : 0;
    
    let density: 'sparse' | 'moderate' | 'dense';
    if (enhancedReflections.length < 3) density = 'sparse';
    else if (enhancedReflections.length < 6) density = 'moderate';
    else density = 'dense';
    
    // Comb filtering risk assessment
    const severeReflections = enhancedReflections.filter(r => r.severity === 'severe');
    let combFilteringLevel: 'severe' | 'moderate' | 'low' | 'minimal';
    let primaryConcern;
    
    if (severeReflections.length > 0) {
      combFilteringLevel = 'severe';
      const worst = severeReflections[0];
      primaryConcern = {
        source: worst.likely_source?.surface ?? 'Unknown',
        first_null_frequency_hz: worst.comb_filter_analysis?.first_null_hz ?? 0,
        affected_range: `${worst.comb_filter_analysis?.affected_frequencies_hz[0]?.toFixed(0)}-${worst.comb_filter_analysis?.affected_frequencies_hz[worst.comb_filter_analysis.affected_frequencies_hz.length - 1]?.toFixed(0)} Hz`
      };
    } else if (significantReflections.length > 0) {
      combFilteringLevel = 'moderate';
    } else if (enhancedReflections.length > 0) {
      combFilteringLevel = 'low';
    } else {
      combFilteringLevel = 'minimal';
    }
    
    // Primary issues
    const primaryIssues: string[] = [];
    if (itdGap.assessment === 'poor' || itdGap.assessment === 'short') {
      primaryIssues.push(`Short ITD gap (${itdGap.itd_ms.toFixed(1)} ms)`);
    }
    if (severeReflections.length > 0) {
      primaryIssues.push(`${severeReflections.length} severe early reflection(s)`);
    }
    if (significantReflections.length > 2) {
      primaryIssues.push(`Multiple significant reflections (${significantReflections.length})`);
    }
    if (clarityMetrics.c50_db < 0) {
      primaryIssues.push('Low clarity (C50 < 0 dB)');
    }
    
    if (primaryIssues.length === 0) {
      primaryIssues.push('No significant reflection issues detected');
    }
    
    // Overall quality
    let reflectionQuality: 'excellent' | 'good' | 'acceptable' | 'needs_improvement' | 'poor';
    if (significantReflections.length === 0 && itdGap.assessment === 'excellent') {
      reflectionQuality = 'excellent';
    } else if (severeReflections.length === 0 && itdGap.assessment !== 'poor') {
      reflectionQuality = 'good';
    } else if (severeReflections.length <= 1) {
      reflectionQuality = 'acceptable';
    } else if (severeReflections.length <= 2) {
      reflectionQuality = 'needs_improvement';
    } else {
      reflectionQuality = 'poor';
    }
    
    // Recommendations
    const recommendations = significantReflections
      .slice(0, 3)
      .map((r, i) => ({
        priority: i + 1,
        issue: `Early reflection at ${r.delay_ms.toFixed(1)} ms (${r.level_relative_db.toFixed(1)} dB)`,
        action: r.suggested_treatment?.action ?? 'Add acoustic treatment',
        impact: `Reduce comb filtering and improve clarity`
      }));
    
    const result: ImpulseResult = {
      measurement_id: validated.measurement_id,
      analysis_type: 'impulse_response_analysis',
      analysis_confidence: measurement.data_quality.confidence,
      direct_sound: directSound,
      early_reflections: enhancedReflections,
      initial_time_delay_gap: {
        ...itdGap,
        note: itdNote,
        ideal_minimum_ms: 20,
        impact: itdGap.assessment === 'poor' || itdGap.assessment === 'short'
          ? 'May cause imaging issues and coloration'
          : 'Good clarity and imaging'
      },
      reflection_pattern_analysis: {
        total_early_reflections: enhancedReflections.length,
        significant_reflections: significantReflections.length,
        average_level_db: avgLevel,
        reflection_density: density
      },
      comb_filtering_risk: {
        level: combFilteringLevel,
        primary_concern: primaryConcern,
        expected_audible_effect: combFilteringLevel === 'severe'
          ? 'Significant coloration and spectral notches'
          : combFilteringLevel === 'moderate'
            ? 'Mild coloration possible'
            : 'Minimal audible effect'
      },
      clarity_metrics: clarityMetrics,
      summary: {
        primary_issues: primaryIssues,
        reflection_quality: reflectionQuality,
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
