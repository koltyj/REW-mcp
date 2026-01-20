/**
 * Tool: rew.analyze_sub_integration
 * 
 * Analyze subwoofer integration with main speakers.
 * Evaluates phase alignment, timing, and polarity at the crossover region.
 * Provides delay and polarity recommendations for optimal summation.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import { 
  analyzeSubIntegration,
  estimateDelayFromIR,
  predictCombinedResponse,
  type SubIntegrationAnalysis 
} from '../analysis/sub-integration.js';
import { calculateQuickStats } from '../analysis/peaks-nulls.js';
import type { StoredMeasurement, ToolResponse } from '../types/index.js';

// Input schema
export const SubIntegrationInputSchema = z.object({
  mains_measurement_id: z.string()
    .describe('Measurement ID for main speakers only (no sub)'),
  sub_measurement_id: z.string()
    .describe('Measurement ID for subwoofer only (no mains)'),
  combined_measurement_id: z.string().optional()
    .describe('Optional: Measurement ID for mains + sub combined'),
  crossover_hz: z.number().min(40).max(200).optional()
    .describe('Crossover frequency in Hz. If omitted, will estimate from measurements.'),
  current_sub_delay_ms: z.number().default(0)
    .describe('Current delay applied to subwoofer (for reference)'),
  current_sub_polarity: z.enum(['normal', 'inverted']).default('normal')
    .describe('Current polarity setting of subwoofer'),
  store_predicted_combined: z.boolean().default(false)
    .describe('Store the predicted optimized combined response for further analysis')
});

export type SubIntegrationInput = z.infer<typeof SubIntegrationInputSchema>;

export interface SubIntegrationToolResult {
  analysis_type: 'sub_integration';
  crossover_analysis: {
    detected_crossover_hz: number;
    mains_rolloff_hz: number;
    sub_rolloff_hz: number;
    overlap_range_hz: [number, number];
    phase_at_crossover_mains_deg: number;
    phase_at_crossover_sub_deg: number;
    phase_difference_deg: number;
    phase_alignment_quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  timing_recommendations: {
    current_delay_ms: number;
    optimal_delay_ms: number;
    adjustment_needed_ms: number;
    alignment_method_used: string;
  };
  polarity_recommendation: {
    current_polarity: string;
    recommended_polarity: string;
    invert_recommended: boolean;
    expected_improvement_db: number;
  };
  summation_prediction: {
    current_dip_at_crossover_db: number;
    predicted_dip_after_optimization_db: number;
    improvement_db: number;
  };
  ir_based_delay?: {
    estimated_delay_ms: number;
    confidence: string;
  };
  predicted_combined_measurement_id?: string;
  confidence: string;
  warnings: string[];
  recommendations: string[];
}

/**
 * Generate human-readable recommendations
 */
function generateRecommendations(analysis: SubIntegrationAnalysis): string[] {
  const recommendations: string[] = [];
  
  const { crossover_analysis, timing_recommendations, polarity_recommendation, summation_prediction } = analysis;
  
  // Timing recommendation
  if (Math.abs(timing_recommendations.adjustment_needed_ms) >= 0.5) {
    const direction = timing_recommendations.adjustment_needed_ms > 0 ? 'Add' : 'Reduce';
    const amount = Math.abs(timing_recommendations.adjustment_needed_ms);
    recommendations.push(
      `${direction} ${amount} ms delay to subwoofer for better phase alignment at crossover`
    );
  }
  
  // Polarity recommendation
  if (polarity_recommendation.invert_recommended) {
    recommendations.push(
      `Invert subwoofer polarity for approximately ${polarity_recommendation.expected_improvement_db} dB improvement at crossover`
    );
  }
  
  // Phase alignment
  if (crossover_analysis.phase_alignment_quality === 'poor') {
    recommendations.push(
      'Consider repositioning subwoofer - current phase alignment is poor and may not be fully correctable with delay alone'
    );
  } else if (crossover_analysis.phase_alignment_quality === 'fair') {
    recommendations.push(
      'Phase alignment is acceptable but could be improved with subwoofer repositioning'
    );
  }
  
  // Crossover frequency
  if (crossover_analysis.detected_crossover_hz < 60) {
    recommendations.push(
      `Crossover frequency (${crossover_analysis.detected_crossover_hz} Hz) is quite low - ensure mains can produce adequate output in this range`
    );
  } else if (crossover_analysis.detected_crossover_hz > 120) {
    recommendations.push(
      `Crossover frequency (${crossover_analysis.detected_crossover_hz} Hz) is relatively high - subwoofer may be localizable`
    );
  }
  
  // Expected improvement
  if (summation_prediction.improvement_db > 0) {
    recommendations.push(
      `Applying recommended settings should reduce crossover dip by approximately ${summation_prediction.improvement_db} dB`
    );
  }
  
  // Verification
  recommendations.push(
    'After making adjustments, take a new combined measurement to verify improvement'
  );
  
  return recommendations;
}

/**
 * Execute sub integration analysis tool
 */
export async function executeSubIntegration(input: SubIntegrationInput): Promise<ToolResponse<SubIntegrationToolResult>> {
  try {
    // Validate input
    const validated = SubIntegrationInputSchema.parse(input);

    // Fetch measurements
    const mainsMeasurement = measurementStore.get(validated.mains_measurement_id);
    const subMeasurement = measurementStore.get(validated.sub_measurement_id);
    
    if (!mainsMeasurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Mains measurement not found: ${validated.mains_measurement_id}`,
        suggestion: 'Use rew.ingest_measurement to load the mains measurement first'
      };
    }
    
    if (!subMeasurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Sub measurement not found: ${validated.sub_measurement_id}`,
        suggestion: 'Use rew.ingest_measurement to load the sub measurement first'
      };
    }
    
    // Validate frequency data exists
    if (mainsMeasurement.frequency_response.frequencies_hz.length === 0) {
      return {
        status: 'error',
        error_type: 'insufficient_data',
        message: 'Mains measurement has no frequency response data',
        suggestion: 'Ensure the measurement contains frequency response data'
      };
    }
    
    if (subMeasurement.frequency_response.frequencies_hz.length === 0) {
      return {
        status: 'error',
        error_type: 'insufficient_data',
        message: 'Sub measurement has no frequency response data',
        suggestion: 'Ensure the measurement contains frequency response data'
      };
    }
    
    // Run analysis
    const analysis = analyzeSubIntegration(
      mainsMeasurement.frequency_response,
      subMeasurement.frequency_response,
      {
        crossover_hz: validated.crossover_hz,
        current_sub_delay_ms: validated.current_sub_delay_ms,
        current_sub_polarity: validated.current_sub_polarity
      }
    );
    
    // Generate recommendations
    const recommendations = generateRecommendations(analysis);
    
    // Optionally estimate delay from IR
    let irBasedDelay: { estimated_delay_ms: number; confidence: string } | undefined;
    if (mainsMeasurement.impulse_response && subMeasurement.impulse_response) {
      const irDelay = estimateDelayFromIR(
        mainsMeasurement.impulse_response,
        subMeasurement.impulse_response
      );
      irBasedDelay = {
        estimated_delay_ms: irDelay.delay_ms,
        confidence: irDelay.confidence
      };
    }
    
    // Optionally store predicted combined response
    let predictedCombinedId: string | undefined;
    if (validated.store_predicted_combined) {
      const optimizedCombined = predictCombinedResponse(
        mainsMeasurement.frequency_response,
        subMeasurement.frequency_response,
        analysis.timing_recommendations.optimal_delay_ms,
        analysis.polarity_recommendation.recommended_polarity === 'inverted'
      );
      
      predictedCombinedId = measurementStore.generateId({
        speaker_id: 'Combined',
        condition: 'predicted_optimized'
      });
      
      const storedMeasurement: StoredMeasurement = {
        id: predictedCombinedId,
        metadata: {
          speaker_id: 'Combined',
          condition: 'predicted_optimized',
          notes: `Predicted combined response with ${analysis.timing_recommendations.optimal_delay_ms}ms delay and ${analysis.polarity_recommendation.recommended_polarity} polarity`
        },
        timestamp: new Date().toISOString(),
        frequency_response: optimizedCombined,
        quick_stats: calculateQuickStats(optimizedCombined),
        data_quality: { confidence: 'medium', warnings: [{ type: 'predicted', message: 'This is a predicted response, not a measurement', severity: 'info' }] },
        parsed_file_metadata: {
          source_description: `Predicted from ${validated.mains_measurement_id} + ${validated.sub_measurement_id}`
        }
      };
      
      measurementStore.store(storedMeasurement);
    }
    
    // Build result
    const result: SubIntegrationToolResult = {
      analysis_type: 'sub_integration',
      crossover_analysis: {
        detected_crossover_hz: analysis.crossover_analysis.detected_crossover_hz,
        mains_rolloff_hz: analysis.crossover_analysis.mains_rolloff_hz,
        sub_rolloff_hz: analysis.crossover_analysis.sub_rolloff_hz,
        overlap_range_hz: analysis.crossover_analysis.overlap_range_hz,
        phase_at_crossover_mains_deg: Math.round(analysis.crossover_analysis.phase_at_crossover_mains_deg * 10) / 10,
        phase_at_crossover_sub_deg: Math.round(analysis.crossover_analysis.phase_at_crossover_sub_deg * 10) / 10,
        phase_difference_deg: Math.round(analysis.crossover_analysis.phase_difference_deg * 10) / 10,
        phase_alignment_quality: analysis.crossover_analysis.phase_alignment_quality
      },
      timing_recommendations: {
        current_delay_ms: analysis.timing_recommendations.current_delay_ms,
        optimal_delay_ms: analysis.timing_recommendations.optimal_delay_ms,
        adjustment_needed_ms: analysis.timing_recommendations.adjustment_needed_ms,
        alignment_method_used: analysis.timing_recommendations.alignment_method_used
      },
      polarity_recommendation: {
        current_polarity: analysis.polarity_recommendation.current_polarity,
        recommended_polarity: analysis.polarity_recommendation.recommended_polarity,
        invert_recommended: analysis.polarity_recommendation.invert_recommended,
        expected_improvement_db: analysis.polarity_recommendation.expected_improvement_db
      },
      summation_prediction: analysis.summation_prediction,
      ir_based_delay: irBasedDelay,
      predicted_combined_measurement_id: predictedCombinedId,
      confidence: analysis.confidence,
      warnings: analysis.warnings,
      recommendations
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
        message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`,
        suggestion: 'Check that all required fields are provided and valid'
      };
    }

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestion: 'Check server logs for details'
    };
  }
}
