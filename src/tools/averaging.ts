/**
 * Tool: rew.average_measurements
 * 
 * Create a spatial average from multiple measurement positions.
 * Implements REW's averaging methods: RMS (incoherent, ignores phase),
 * Vector (coherent, requires IR data), or hybrid methods.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import { averageMeasurements, AveragingMethod } from '../analysis/averaging.js';
import { calculateQuickStats } from '../analysis/peaks-nulls.js';
import type { StoredMeasurement, ToolResponse, FrequencyResponseData } from '../types/index.js';

// Input schema
export const AveragingInputSchema = z.object({
  measurement_ids: z.array(z.string()).min(2).max(16)
    .describe('IDs of measurements to average (2-16 measurements)'),
  method: z.enum(['rms', 'db', 'vector', 'rms_phase', 'db_phase']).default('rms')
    .describe('Averaging method. RMS recommended for spatial averaging (different positions). Vector requires phase/IR data.'),
  align_spl: z.boolean().default(true)
    .describe('Align SPL levels before averaging to compensate for distance differences'),
  alignment_range_hz: z.array(z.number()).length(2).default([200, 2000])
    .describe('Frequency range for SPL alignment [min, max] Hz'),
  weights: z.array(z.number().min(0).max(1)).optional()
    .describe('Optional per-measurement weights (0-1). If omitted, equal weighting is used.'),
  store_result: z.boolean().default(true)
    .describe('Store the averaged measurement for further analysis'),
  result_metadata: z.object({
    speaker_id: z.enum(['L', 'R', 'C', 'Sub', 'Combined', 'LFE', 'SL', 'SR', 'RL', 'RR']).default('Combined'),
    condition: z.string().regex(/^[a-zA-Z0-9_]+$/).default('averaged'),
    notes: z.string().max(1000).optional()
  }).optional()
});

export type AveragingInput = z.infer<typeof AveragingInputSchema>;

export interface AveragingToolResult {
  averaged_measurement_id: string | null;
  method_used: AveragingMethod;
  input_measurements: number;
  frequency_range_hz: [number, number];
  spl_alignment_applied: boolean;
  alignment_offsets_db: number[];
  quick_stats: {
    bass_avg_db: number;
    midrange_avg_db: number;
    treble_avg_db: number;
    variance_20_200hz_db: number;
    variance_200_2000hz_db: number;
    variance_2000_20000hz_db: number;
  };
  source_measurements: Array<{
    id: string;
    speaker_id: string;
    condition: string;
  }>;
  warnings: string[];
}

/**
 * Execute average measurements tool
 */
export async function executeAveraging(input: AveragingInput): Promise<ToolResponse<AveragingToolResult>> {
  try {
    // Validate input
    const validated = AveragingInputSchema.parse(input);

    // Fetch all measurements
    const measurements: StoredMeasurement[] = [];
    const missingIds: string[] = [];

    for (const id of validated.measurement_ids) {
      const measurement = measurementStore.get(id);
      if (measurement) {
        measurements.push(measurement);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurements not found: ${missingIds.join(', ')}`,
        suggestion: 'Use rew.ingest_measurement to load measurements first'
      };
    }

    if (measurements.length < 2) {
      return {
        status: 'error',
        error_type: 'insufficient_measurements',
        message: 'At least 2 measurements are required for averaging',
        suggestion: 'Provide at least 2 measurement IDs'
      };
    }

    // Extract frequency responses
    const frequencyResponses: FrequencyResponseData[] = measurements.map(m => m.frequency_response);

    // Check for valid frequency response data
    const validResponses = frequencyResponses.filter(fr => fr.frequencies_hz.length > 0);
    if (validResponses.length < 2) {
      return {
        status: 'error',
        error_type: 'insufficient_data',
        message: 'At least 2 measurements with frequency response data are required',
        suggestion: 'Ensure measurements contain frequency response data, not just impulse response'
      };
    }

    // Perform averaging
    const result = averageMeasurements(frequencyResponses, {
      method: validated.method,
      align_spl: validated.align_spl,
      alignment_frequency_range: validated.alignment_range_hz as [number, number],
      weighting: validated.weights
    });

    // Calculate quick stats for the averaged result
    const quick_stats = calculateQuickStats(result.averaged_frequency_response);

    // Store result if requested
    let averaged_measurement_id: string | null = null;
    if (validated.store_result && result.averaged_frequency_response.frequencies_hz.length > 0) {
      const metadata = validated.result_metadata || {
        speaker_id: 'Combined' as const,
        condition: 'averaged'
      };

      averaged_measurement_id = measurementStore.generateId(metadata);

      const storedMeasurement: StoredMeasurement = {
        id: averaged_measurement_id,
        metadata: {
          speaker_id: metadata.speaker_id,
          condition: metadata.condition,
          notes: metadata.notes || `Averaged from ${measurements.length} measurements using ${validated.method} method`
        },
        timestamp: new Date().toISOString(),
        frequency_response: result.averaged_frequency_response,
        impulse_response: undefined, // Averaging doesn't preserve IR
        quick_stats,
        data_quality: result.data_quality,
        parsed_file_metadata: {
          source_description: `Spatial average of ${measurements.map(m => m.id).join(', ')}`
        }
      };

      measurementStore.store(storedMeasurement);
    }

    // Prepare source measurement info
    const source_measurements = measurements.map(m => ({
      id: m.id,
      speaker_id: m.metadata.speaker_id,
      condition: m.metadata.condition
    }));

    const toolResult: AveragingToolResult = {
      averaged_measurement_id,
      method_used: result.method_used,
      input_measurements: result.input_measurements,
      frequency_range_hz: result.frequency_range_hz,
      spl_alignment_applied: result.spl_alignment_applied,
      alignment_offsets_db: result.alignment_offsets_db,
      quick_stats,
      source_measurements,
      warnings: result.warnings
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
