/**
 * Tool: rew.compare_measurements
 * 
 * Compares two or more measurements.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import type { ToolResponse, FrequencyBandAnalysis, ComparisonType, AssessmentVerdict, ConfidenceLevel } from '../types/index.js';
import { tuiEventBus } from '../events/index.js';

// Input schema
export const CompareInputSchema = z.object({
  measurement_ids: z.array(z.string()).min(2).max(10),
  comparison_type: z.enum(['before_after', 'placement_comparison', 'lr_symmetry', 'with_without_sub']),
  reference_measurement_id: z.string().optional(),
  frequency_range_hz: z.tuple([
    z.number().min(1).max(30000),
    z.number().min(1).max(30000)
  ]).optional()
});

export type CompareInput = z.infer<typeof CompareInputSchema>;

export interface CompareResult {
  comparison_id: string;
  comparison_type: ComparisonType;
  measurements_compared: Array<{
    id: string;
    role: string;
    condition: string;
  }>;
  frequency_band_analysis: FrequencyBandAnalysis[];
  overall_assessment: {
    verdict: AssessmentVerdict;
    confidence: ConfidenceLevel;
    improvement_score: number;
    summary: {
      bands_improved: number;
      bands_regressed: number;
      bands_unchanged: number;
    };
  };
  analysis_confidence: ConfidenceLevel;
  analysis_limitations: string[];
}

/**
 * Calculate average SPL in a frequency band
 */
function calculateBandAverage(
  frequencies: number[],
  spl: number[],
  minFreq: number,
  maxFreq: number
): { avg: number; variance: number } {
  const values: number[] = [];
  
  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
      values.push(spl[i]);
    }
  }
  
  if (values.length === 0) return { avg: 0, variance: 0 };
  
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const variance = max - min;
  
  return { avg, variance };
}

/**
 * Assess band comparison
 */
function assessBandChange(
  _levelDelta: number,
  varianceDelta: number
): { verdict: AssessmentVerdict; reason: string } {
  // Positive levelDelta means louder (could be good or bad)
  // Negative varianceDelta means smoother (always good)
  
  // Significant improvement in variance
  if (varianceDelta < -3) {
    return {
      verdict: 'improved',
      reason: `Variance reduced by ${Math.abs(varianceDelta).toFixed(1)} dB - significantly smoother response`
    };
  }
  
  // Modest improvement
  if (varianceDelta < -1.5) {
    return {
      verdict: 'slightly_improved',
      reason: `Variance reduced by ${Math.abs(varianceDelta).toFixed(1)} dB - smoother response`
    };
  }
  
  // Significant regression
  if (varianceDelta > 3) {
    return {
      verdict: 'regressed',
      reason: `Variance increased by ${varianceDelta.toFixed(1)} dB - rougher response`
    };
  }
  
  // Modest regression
  if (varianceDelta > 1.5) {
    return {
      verdict: 'slightly_regressed',
      reason: `Variance increased by ${varianceDelta.toFixed(1)} dB`
    };
  }
  
  // No significant change
  return {
    verdict: 'unchanged',
    reason: `Minimal change in variance (${varianceDelta.toFixed(1)} dB)`
  };
}

/**
 * Execute compare measurements tool
 */
export async function executeCompare(input: CompareInput): Promise<ToolResponse<CompareResult>> {
  try {
    const validated = CompareInputSchema.parse(input);
    
    // Get all measurements
    const measurements = validated.measurement_ids.map(id => measurementStore.get(id));
    
    // Check all exist
    const missingIds = validated.measurement_ids.filter((_id, i) => !measurements[i]);
    if (missingIds.length > 0) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurements not found: ${missingIds.join(', ')}`,
        suggestion: 'Ensure all measurements have been ingested first'
      };
    }
    
    // Determine reference measurement
    let refIndex = 0;
    if (validated.reference_measurement_id) {
      refIndex = validated.measurement_ids.indexOf(validated.reference_measurement_id);
      if (refIndex === -1) {
        return {
          status: 'error',
          error_type: 'validation_error',
          message: 'Reference measurement ID not in measurement_ids list'
        };
      }
    }
    
    const refMeasurement = measurements[refIndex]!;
    const compMeasurement = measurements[refIndex === 0 ? 1 : 0]!;
    
    // Frequency bands to analyze
    const bands: Array<{ name: string; range: [number, number] }> = [
      { name: 'Deep Bass', range: [20, 60] },
      { name: 'Bass', range: [60, 200] },
      { name: 'Lower Midrange', range: [200, 500] },
      { name: 'Midrange', range: [500, 2000] },
      { name: 'Upper Midrange', range: [2000, 6000] },
      { name: 'Treble', range: [6000, 20000] }
    ];
    
    const freqRange = validated.frequency_range_hz;
    const bandAnalysis: FrequencyBandAnalysis[] = [];
    
    for (const band of bands) {
      // Skip if outside requested range
      if (freqRange && (band.range[1] < freqRange[0] || band.range[0] > freqRange[1])) {
        continue;
      }
      
      const refStats = calculateBandAverage(
        refMeasurement.frequency_response.frequencies_hz,
        refMeasurement.frequency_response.spl_db,
        band.range[0],
        band.range[1]
      );
      
      const compStats = calculateBandAverage(
        compMeasurement.frequency_response.frequencies_hz,
        compMeasurement.frequency_response.spl_db,
        band.range[0],
        band.range[1]
      );
      
      const levelDelta = compStats.avg - refStats.avg;
      const varianceDelta = compStats.variance - refStats.variance;
      
      const assessment = assessBandChange(levelDelta, varianceDelta);
      
      bandAnalysis.push({
        band_name: band.name,
        frequency_range_hz: band.range,
        reference_avg_db: refStats.avg,
        reference_variance_db: refStats.variance,
        comparison_avg_db: compStats.avg,
        comparison_variance_db: compStats.variance,
        level_delta_db: levelDelta,
        variance_delta_db: varianceDelta,
        assessment: assessment.verdict,
        assessment_reason: assessment.reason
      });
    }
    
    // Overall assessment
    const improved = bandAnalysis.filter(b => b.assessment === 'improved' || b.assessment === 'slightly_improved').length;
    const regressed = bandAnalysis.filter(b => b.assessment === 'regressed' || b.assessment === 'slightly_regressed').length;
    const unchanged = bandAnalysis.filter(b => b.assessment === 'unchanged').length;
    
    let overallVerdict: AssessmentVerdict;
    if (improved > regressed * 2) overallVerdict = 'improved';
    else if (improved > regressed) overallVerdict = 'slightly_improved';
    else if (regressed > improved * 2) overallVerdict = 'regressed';
    else if (regressed > improved) overallVerdict = 'slightly_regressed';
    else if (improved > 0 && regressed > 0) overallVerdict = 'mixed';
    else overallVerdict = 'unchanged';
    
    const improvementScore = (improved - regressed) / bandAnalysis.length;
    const normalizedScore = Math.max(0, Math.min(1, (improvementScore + 1) / 2));
    
    // Measurement roles
    const measurementsCompared = validated.measurement_ids.map((measurementId, i) => ({
      id: measurementId,
      role: i === refIndex ? 'reference' : 'comparison',
      condition: measurements[i]!.metadata.condition
    }));
    
    const result: CompareResult = {
      comparison_id: `comp_${Date.now()}`,
      comparison_type: validated.comparison_type,
      measurements_compared: measurementsCompared,
      frequency_band_analysis: bandAnalysis,
      overall_assessment: {
        verdict: overallVerdict,
        confidence: 'high',
        improvement_score: normalizedScore,
        summary: {
          bands_improved: improved,
          bands_regressed: regressed,
          bands_unchanged: unchanged
        }
      },
      analysis_confidence: refMeasurement.data_quality.confidence,
      analysis_limitations: [
        ...refMeasurement.data_quality.warnings.map(w => w.message),
        ...compMeasurement.data_quality.warnings.map(w => w.message)
      ]
    };
    
    tuiEventBus.emit('analysis:comparison_complete', {
      comparison_type: result.comparison_type,
      overall_assessment: result.overall_assessment,
      frequency_band_analysis: result.frequency_band_analysis,
      analysis_confidence: result.analysis_confidence,
      analysis_limitations: result.analysis_limitations,
    });

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
