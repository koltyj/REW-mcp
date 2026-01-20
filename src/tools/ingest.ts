/**
 * Tool: rew.ingest_measurement
 * 
 * Parses and stores REW measurement data.
 */

import { z } from 'zod';
import { parseREWExport } from '../parser/index.js';
import { measurementStore } from '../store/measurement.js';
import { calculateQuickStats } from '../analysis/index.js';
import type { StoredMeasurement, IngestResult, ToolResponse } from '../types/index.js';

// Input schema
export const IngestInputSchema = z.object({
  file_contents: z.string().min(1, 'File contents cannot be empty'),
  metadata: z.object({
    speaker_id: z.enum(['L', 'R', 'C', 'Sub', 'Combined', 'LFE', 'SL', 'SR', 'RL', 'RR']),
    condition: z.string().regex(/^[a-zA-Z0-9_]+$/, 'Condition must be alphanumeric with underscores'),
    mic_position_id: z.string().optional(),
    notes: z.string().max(1000).optional()
  })
});

export type IngestInput = z.infer<typeof IngestInputSchema>;

/**
 * Execute ingest measurement tool
 */
export async function executeIngest(input: IngestInput): Promise<ToolResponse<IngestResult>> {
  try {
    // Validate input
    const validated = IngestInputSchema.parse(input);
    
    // Parse the file
    const parsed = parseREWExport(validated.file_contents);
    
    // Check if we have valid data
    if (parsed.frequency_response.frequencies_hz.length === 0 && !parsed.impulse_response) {
      return {
        status: 'error',
        error_type: 'parse_error',
        message: 'No valid frequency response or impulse response data found in file',
        suggestion: 'Ensure the file is a valid REW text export (Frequency Response or Impulse Response)'
      };
    }
    
    // Generate ID and create stored measurement
    const id = measurementStore.generateId(validated.metadata);
    
    // Calculate quick stats (if we have frequency response)
    let quick_stats;
    if (parsed.frequency_response.frequencies_hz.length > 0) {
      quick_stats = calculateQuickStats(parsed.frequency_response);
    } else {
      // No frequency response, provide defaults
      quick_stats = {
        bass_avg_db: 0,
        midrange_avg_db: 0,
        treble_avg_db: 0,
        variance_20_200hz_db: 0,
        variance_200_2000hz_db: 0,
        variance_2000_20000hz_db: 0
      };
    }
    
    const measurement: StoredMeasurement = {
      id,
      metadata: validated.metadata,
      timestamp: new Date().toISOString(),
      frequency_response: parsed.frequency_response,
      impulse_response: parsed.impulse_response,
      quick_stats,
      data_quality: parsed.data_quality,
      parsed_file_metadata: parsed.parsed_metadata
    };
    
    // Store the measurement
    measurementStore.store(measurement);
    
    // Prepare result
    const hasFR = parsed.frequency_response.frequencies_hz.length > 0;
    const hasIR = !!parsed.impulse_response;
    
    let data_type: 'frequency_response' | 'impulse_response' | 'combined';
    if (hasFR && hasIR) data_type = 'combined';
    else if (hasIR) data_type = 'impulse_response';
    else data_type = 'frequency_response';
    
    const result: IngestResult = {
      measurement_id: id,
      summary: {
        data_type,
        frequency_range_hz: (hasFR && parsed.frequency_response.frequencies_hz.length > 0)
          ? [
              parsed.frequency_response.frequencies_hz[0],
              parsed.frequency_response.frequencies_hz[parsed.frequency_response.frequencies_hz.length - 1]
            ]
          : [0, 0],
        data_points: parsed.frequency_response.frequencies_hz.length,
        points_per_octave: hasFR ? calculatePointsPerOctave(parsed.frequency_response.frequencies_hz) : 0,
        has_phase_data: parsed.frequency_response.phase_degrees.some(p => p !== 0),
        has_impulse_data: hasIR,
        overall_level_db: hasFR
          ? parsed.frequency_response.spl_db.reduce((a, b) => a + b, 0) / parsed.frequency_response.spl_db.length
          : 0
      },
      quick_stats,
      data_quality: parsed.data_quality,
      parsed_file_metadata: parsed.parsed_metadata
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

/**
 * Calculate points per octave from frequency array
 */
function calculatePointsPerOctave(frequencies: number[]): number {
  if (frequencies.length < 10) return 0;
  
  // Find a one-octave span and count points
  const startFreq = frequencies[Math.floor(frequencies.length / 3)];
  const endFreq = startFreq * 2;
  
  let count = 0;
  for (const freq of frequencies) {
    if (freq >= startFreq && freq <= endFreq) count++;
  }
  
  return count;
}
