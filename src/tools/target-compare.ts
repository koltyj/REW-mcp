/**
 * Tool: rew.compare_to_target
 * 
 * Compare a measurement against a target response curve.
 * Supports flat, house curves, and REW room curve with LF rise and HF fall.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import {
  getBuiltInCurve,
  createCustomCurve,
  calculateTargetDeviation,
  type TargetDeviationResult
} from '../analysis/target-curves.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const TargetCompareInputSchema = z.object({
  measurement_id: z.string()
    .describe('ID of the measurement to compare'),
  target_type: z.enum(['flat', 'rew_room_curve', 'harman', 'bk_house', 'custom']).default('flat')
    .describe('Target curve type: flat, rew_room_curve (LF rise + HF fall), harman, bk_house, or custom'),
  custom_curve_points: z.array(
    z.object({
      frequency_hz: z.number().min(1).max(30000),
      level_db: z.number().min(-50).max(50)
    })
  ).optional()
    .describe('Custom target curve points (frequency/dB pairs). Required if target_type is "custom".'),
  alignment_frequency_hz: z.number().min(100).max(10000).default(1000)
    .describe('Frequency at which to align measurement to target'),
  evaluation_range_hz: z.array(z.number()).length(2).default([20, 20000])
    .describe('Frequency range for evaluation [min, max]')
});

export type TargetCompareInput = z.infer<typeof TargetCompareInputSchema>;

export interface TargetCompareToolResult {
  measurement_id: string;
  analysis_type: 'target_comparison';
  target_used: string;
  alignment_offset_db: number;
  deviation_statistics: {
    average_deviation_db: number;
    max_positive_deviation_db: number;
    max_negative_deviation_db: number;
    rms_deviation_db: number;
  };
  by_band: Array<{
    band_name: string;
    range_hz: [number, number];
    average_deviation_db: number;
    assessment: string;
  }>;
  worst_deviations: Array<{
    frequency_hz: number;
    deviation_db: number;
    type: 'peak' | 'null';
  }>;
  overall_grade: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor';
  recommendations: string[];
}

/**
 * Generate recommendations based on deviation analysis
 */
function generateRecommendations(result: TargetDeviationResult): string[] {
  const recommendations: string[] = [];
  const { deviation_statistics, by_band, worst_deviations } = result;
  
  // Overall level
  if (Math.abs(deviation_statistics.average_deviation_db) > 2) {
    recommendations.push(
      `Average response is ${Math.abs(deviation_statistics.average_deviation_db).toFixed(1)} dB ` +
      `${deviation_statistics.average_deviation_db > 0 ? 'above' : 'below'} target - ` +
      `consider overall level adjustment`
    );
  }
  
  // Band-specific recommendations
  for (const band of by_band) {
    if (band.assessment === 'poor' || band.assessment === 'needs_work') {
      if (band.average_deviation_db > 0) {
        recommendations.push(
          `${band.band_name} (${band.range_hz[0]}-${band.range_hz[1]} Hz) is ` +
          `${band.average_deviation_db.toFixed(1)} dB above target - ` +
          (band.range_hz[1] <= 200 
            ? 'consider bass trapping or repositioning' 
            : 'consider EQ cut or absorption')
        );
      } else {
        recommendations.push(
          `${band.band_name} (${band.range_hz[0]}-${band.range_hz[1]} Hz) is ` +
          `${Math.abs(band.average_deviation_db).toFixed(1)} dB below target - ` +
          (band.range_hz[1] <= 200 
            ? 'may indicate bass null (positioning issue)' 
            : 'may need EQ boost or investigate cause')
        );
      }
    }
  }
  
  // Worst deviations
  const significantDeviations = worst_deviations.filter(d => Math.abs(d.deviation_db) > 6);
  if (significantDeviations.length > 0) {
    for (const dev of significantDeviations.slice(0, 3)) {
      const freqStr = dev.frequency_hz < 1000 
        ? `${dev.frequency_hz} Hz` 
        : `${(dev.frequency_hz / 1000).toFixed(1)} kHz`;
      
      if (dev.type === 'peak') {
        recommendations.push(
          `Significant peak at ${freqStr} (${dev.deviation_db.toFixed(1)} dB above target)`
        );
      } else {
        recommendations.push(
          `Significant null at ${freqStr} (${Math.abs(dev.deviation_db).toFixed(1)} dB below target)`
        );
      }
    }
  }
  
  // Grade-based summary
  if (result.overall_grade === 'excellent') {
    recommendations.push('Response closely matches target - no significant action needed');
  } else if (result.overall_grade === 'good') {
    recommendations.push('Response is close to target with minor deviations');
  }
  
  return recommendations;
}

/**
 * Execute target compare tool
 */
export async function executeTargetCompare(input: TargetCompareInput): Promise<ToolResponse<TargetCompareToolResult>> {
  try {
    // Validate input
    const validated = TargetCompareInputSchema.parse(input);

    // Get measurement
    const measurement = measurementStore.get(validated.measurement_id);
    if (!measurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurement not found: ${validated.measurement_id}`,
        suggestion: 'Use rew.ingest_measurement to load the measurement first'
      };
    }

    // Check for frequency response data
    if (measurement.frequency_response.frequencies_hz.length === 0) {
      return {
        status: 'error',
        error_type: 'insufficient_data',
        message: 'Measurement has no frequency response data',
        suggestion: 'Ensure the measurement contains frequency response data'
      };
    }

    // Get or create target curve
    let targetCurve;
    if (validated.target_type === 'custom') {
      if (!validated.custom_curve_points || validated.custom_curve_points.length < 2) {
        return {
          status: 'error',
          error_type: 'validation_error',
          message: 'Custom curve requires at least 2 frequency/dB points',
          suggestion: 'Provide custom_curve_points array with frequency_hz and level_db values'
        };
      }
      targetCurve = createCustomCurve('Custom', validated.custom_curve_points);
    } else {
      targetCurve = getBuiltInCurve(validated.target_type);
    }

    // Calculate deviation
    const result = calculateTargetDeviation(
      measurement.frequency_response,
      targetCurve,
      {
        alignment_frequency_hz: validated.alignment_frequency_hz,
        evaluation_range_hz: validated.evaluation_range_hz as [number, number]
      }
    );

    // Generate recommendations
    const recommendations = generateRecommendations(result);

    // Build tool result
    const toolResult: TargetCompareToolResult = {
      measurement_id: validated.measurement_id,
      analysis_type: 'target_comparison',
      target_used: result.target_used,
      alignment_offset_db: result.alignment_offset_db,
      deviation_statistics: {
        average_deviation_db: result.deviation_statistics.average_deviation_db,
        max_positive_deviation_db: result.deviation_statistics.max_positive_deviation_db,
        max_negative_deviation_db: result.deviation_statistics.max_negative_deviation_db,
        rms_deviation_db: result.deviation_statistics.rms_deviation_db
      },
      by_band: result.by_band.map(b => ({
        band_name: b.band_name,
        range_hz: b.range_hz,
        average_deviation_db: b.average_deviation_db,
        assessment: b.assessment
      })),
      worst_deviations: result.worst_deviations,
      overall_grade: result.overall_grade,
      recommendations
    };

    return {
      status: 'success',
      data: toolResult
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
