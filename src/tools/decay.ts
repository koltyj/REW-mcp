/**
 * Tool: rew.analyze_decay
 * 
 * Analyzes decay characteristics from impulse response.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import {
  estimateT60AtFrequency,
  classifyDecayCharacter,
  classifyDecaySeverity
} from '../analysis/index.js';
import type { ToolResponse, ProblematicDecay, ConfidenceLevel } from '../types/index.js';

// Input schema
export const DecayInputSchema = z.object({
  measurement_id: z.string().min(1),
  frequency_range_hz: z.tuple([
    z.number().min(1).max(2000),
    z.number().min(1).max(2000)
  ]).default([20, 500]),
  decay_threshold_seconds: z.number().min(0.1).max(2.0).default(0.4)
});

export type DecayInput = z.infer<typeof DecayInputSchema>;

export interface DecayResult {
  measurement_id: string;
  analysis_type: 'decay_analysis';
  analysis_confidence: ConfidenceLevel;
  frequency_range_analyzed_hz: [number, number];
  decay_data: {
    source: 'impulse_response' | 'waterfall' | 'computed';
    mode: string;
  };
  problematic_frequencies: ProblematicDecay[];
  acceptable_frequencies: Array<{
    frequency_hz: number;
    t60_seconds: number;
    assessment: string;
  }>;
  frequency_band_summary: Array<{
    band: string;
    range_hz: [number, number];
    avg_t60_seconds: number;
    assessment: string;
    target_t60_seconds: number;
  }>;
  overall_assessment: {
    quality: 'good' | 'acceptable' | 'needs_improvement' | 'poor';
    primary_issue_hz?: number;
    dominant_problem?: string;
    average_bass_t60_seconds: number;
  };
  recommendations: Array<{
    priority: number;
    target_frequency_hz: number;
    action: string;
    type: string;
    expected_improvement: string;
    confidence: ConfidenceLevel;
    note?: string;
  }>;
}

/**
 * Execute decay analysis tool
 */
export async function executeDecay(input: DecayInput): Promise<ToolResponse<DecayResult>> {
  try {
    const validated = DecayInputSchema.parse(input);
    
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
        suggestion: 'Decay analysis requires impulse response data. Re-export from REW with IR included.'
      };
    }
    
    const freqRange = validated.frequency_range_hz;
    const threshold = validated.decay_threshold_seconds;
    
    // Analyze frequencies at key points in the range
    const testFrequencies = [
      freqRange[0],
      ...generateLogSpacedFrequencies(freqRange[0], freqRange[1], 10),
      freqRange[1]
    ];
    
    const problematic: ProblematicDecay[] = [];
    const acceptable: Array<{ frequency_hz: number; t60_seconds: number; assessment: string }> = [];
    
    for (const freq of testFrequencies) {
      const t60 = estimateT60AtFrequency(measurement.impulse_response, freq);
      const severity = classifyDecaySeverity(t60, threshold);
      
      if (t60 > threshold && severity !== 'negligible') {
        const character = classifyDecayCharacter(t60, freq, false);
        
        problematic.push({
          frequency_hz: freq,
          t60_seconds: t60,
          severity,
          threshold_seconds: threshold,
          excess_seconds: t60 - threshold,
          decay_character: character,
          likely_cause: freq < 200 
            ? 'Room mode resonance'
            : 'Acoustic treatment insufficient or absent',
          glm_impact: 'GLM cannot address decay time - requires physical room treatment'
        });
      } else {
        acceptable.push({
          frequency_hz: freq,
          t60_seconds: t60,
          assessment: t60 < threshold * 0.8 ? 'Well controlled' : 'Acceptable'
        });
      }
    }
    
    // Band summary
    const bands = [
      { name: 'Deep Bass', range: [20, 60] as [number, number], target: 0.35 },
      { name: 'Bass', range: [60, 200] as [number, number], target: 0.3 },
      { name: 'Low-Mid', range: [200, 500] as [number, number], target: 0.25 }
    ];
    
    const bandSummary = bands.map(band => {
      const freqsInBand = testFrequencies.filter(f => f >= band.range[0] && f <= band.range[1]);
      const t60Values = freqsInBand.map(f => estimateT60AtFrequency(measurement.impulse_response!, f));
      const avgT60 = t60Values.reduce((a, b) => a + b, 0) / t60Values.length;
      
      return {
        band: band.name,
        range_hz: band.range,
        avg_t60_seconds: avgT60,
        assessment: avgT60 > band.target * 1.3 ? 'Needs improvement' : 'Acceptable',
        target_t60_seconds: band.target
      };
    });
    
    // Overall assessment
    const avgBassT60 = bandSummary.filter(b => b.band.includes('Bass'))
      .reduce((sum, b) => sum + b.avg_t60_seconds, 0) / 2;
    
    let quality: 'good' | 'acceptable' | 'needs_improvement' | 'poor';
    if (problematic.length === 0) quality = 'good';
    else if (problematic.filter(p => p.severity === 'significant').length === 0) quality = 'acceptable';
    else if (problematic.filter(p => p.severity === 'significant').length <= 2) quality = 'needs_improvement';
    else quality = 'poor';
    
    // Generate recommendations
    const recommendations = problematic
      .sort((a, b) => b.t60_seconds - a.t60_seconds)
      .slice(0, 5)
      .map((p, i) => ({
        priority: i + 1,
        target_frequency_hz: p.frequency_hz,
        action: p.frequency_hz < 200
          ? 'Add bass trapping or repositioning'
          : 'Add broadband absorption',
        type: 'acoustic_treatment',
        expected_improvement: `Reduce T60 from ${p.t60_seconds.toFixed(2)}s to ~${threshold.toFixed(2)}s`,
        confidence: 'medium' as ConfidenceLevel,
        note: p.likely_cause
      }));
    
    const result: DecayResult = {
      measurement_id: validated.measurement_id,
      analysis_type: 'decay_analysis',
      analysis_confidence: measurement.data_quality.confidence,
      frequency_range_analyzed_hz: freqRange,
      decay_data: {
        source: 'impulse_response',
        mode: 'schroeder_integration'
      },
      problematic_frequencies: problematic,
      acceptable_frequencies: acceptable,
      frequency_band_summary: bandSummary,
      overall_assessment: {
        quality,
        primary_issue_hz: problematic.length > 0 ? problematic[0].frequency_hz : undefined,
        dominant_problem: problematic.length > 0 ? problematic[0].likely_cause : undefined,
        average_bass_t60_seconds: avgBassT60
      },
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

/**
 * Generate logarithmically spaced frequencies
 */
function generateLogSpacedFrequencies(min: number, max: number, count: number): number[] {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const step = (logMax - logMin) / (count + 1);
  
  const frequencies: number[] = [];
  for (let i = 1; i <= count; i++) {
    frequencies.push(Math.pow(10, logMin + i * step));
  }
  
  return frequencies;
}
