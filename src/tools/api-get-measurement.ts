/**
 * Tool: rew.api_get_measurement
 * 
 * Fetch a measurement directly from REW via API.
 * Measurement is identified by UUID, not index (per REW docs:
 * "use UUIDs as indices shift when measurements are added/removed").
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { measurementStore } from '../store/measurement.js';
import { calculateQuickStats } from '../analysis/peaks-nulls.js';
import type { StoredMeasurement, ToolResponse } from '../types/index.js';

// Input schema
export const ApiGetMeasurementInputSchema = z.object({
  measurement_uuid: z.string()
    .describe('UUID of the measurement in REW'),
  include_ir: z.boolean().default(false)
    .describe('Include impulse response data'),
  smoothing: z.enum(['none', '1/48', '1/24', '1/12', '1/6', '1/3', '1/1']).default('none')
    .describe('Frequency response smoothing'),
  store_measurement: z.boolean().default(true)
    .describe('Store the fetched measurement for further analysis'),
  metadata: z.object({
    speaker_id: z.enum(['L', 'R', 'C', 'Sub', 'Combined', 'LFE', 'SL', 'SR', 'RL', 'RR']).default('Combined'),
    condition: z.string().regex(/^[a-zA-Z0-9_]+$/).default('api_fetch'),
    notes: z.string().max(1000).optional()
  }).optional()
});

export type ApiGetMeasurementInput = z.infer<typeof ApiGetMeasurementInputSchema>;

export interface ApiGetMeasurementResult {
  measurement_id?: string;
  measurement_uuid: string;
  measurement_name: string;
  summary: {
    data_type: 'frequency_response' | 'impulse_response' | 'combined';
    frequency_range_hz: [number, number];
    data_points: number;
    has_phase_data: boolean;
    has_impulse_data: boolean;
    overall_level_db: number;
  };
  quick_stats?: {
    bass_avg_db: number;
    midrange_avg_db: number;
    treble_avg_db: number;
    variance_20_200hz_db: number;
    variance_200_2000hz_db: number;
    variance_2000_20000hz_db: number;
  };
  stored: boolean;
}

/**
 * Execute API get measurement tool
 */
export async function executeApiGetMeasurement(input: ApiGetMeasurementInput): Promise<ToolResponse<ApiGetMeasurementResult>> {
  try {
    // Validate input
    const validated = ApiGetMeasurementInputSchema.parse(input);

    // Get active API client
    const client = getActiveApiClient();
    if (!client || !client.isConnected()) {
      return {
        status: 'error',
        error_type: 'not_connected',
        message: 'Not connected to REW API',
        suggestion: 'Use rew.api_connect to establish a connection first'
      };
    }

    // Get measurement info
    const measurementData = await client.getMeasurement(validated.measurement_uuid);
    if (!measurementData) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurement not found: ${validated.measurement_uuid}`,
        suggestion: 'Use rew.api_list_measurements to see available measurements'
      };
    }

    // Get frequency response
    const smoothingMap: Record<string, string | undefined> = {
      'none': undefined,
      '1/48': '1/48',
      '1/24': '1/24',
      '1/12': '1/12',
      '1/6': '1/6',
      '1/3': '1/3',
      '1/1': '1/1'
    };

    const frequencyResponse = await client.getFrequencyResponse(validated.measurement_uuid, {
      smoothing: smoothingMap[validated.smoothing]
    });

    if (!frequencyResponse || frequencyResponse.frequencies_hz.length === 0) {
      return {
        status: 'error',
        error_type: 'no_data',
        message: 'Could not retrieve frequency response data from REW',
        suggestion: 'Ensure the measurement contains frequency response data'
      };
    }

    // Get impulse response if requested
    let impulseResponse = undefined;
    if (validated.include_ir) {
      impulseResponse = await client.getImpulseResponse(validated.measurement_uuid);
    }

    // Calculate quick stats
    const quick_stats = calculateQuickStats(frequencyResponse);

    // Determine data type
    let data_type: 'frequency_response' | 'impulse_response' | 'combined';
    if (frequencyResponse.frequencies_hz.length > 0 && impulseResponse) {
      data_type = 'combined';
    } else if (impulseResponse) {
      data_type = 'impulse_response';
    } else {
      data_type = 'frequency_response';
    }

    // Store measurement if requested
    let measurement_id: string | undefined;
    if (validated.store_measurement) {
      const metadata = validated.metadata || {
        speaker_id: 'Combined' as const,
        condition: 'api_fetch'
      };

      measurement_id = measurementStore.generateId(metadata);

      const storedMeasurement: StoredMeasurement = {
        id: measurement_id,
        metadata: {
          speaker_id: metadata.speaker_id,
          condition: metadata.condition,
          notes: metadata.notes || `Fetched from REW API: ${measurementData.name}`
        },
        timestamp: new Date().toISOString(),
        frequency_response: frequencyResponse,
        impulse_response: impulseResponse || undefined,
        quick_stats,
        data_quality: {
          confidence: 'high',
          warnings: []
        },
        parsed_file_metadata: {
          source_description: `REW API: ${measurementData.name}`,
          measurement_name: measurementData.name
        }
      };

      measurementStore.store(storedMeasurement);
    }

    // Build result
    const result: ApiGetMeasurementResult = {
      measurement_id,
      measurement_uuid: validated.measurement_uuid,
      measurement_name: measurementData.name,
      summary: {
        data_type,
        frequency_range_hz: [
          frequencyResponse.frequencies_hz[0],
          frequencyResponse.frequencies_hz[frequencyResponse.frequencies_hz.length - 1]
        ],
        data_points: frequencyResponse.frequencies_hz.length,
        has_phase_data: frequencyResponse.phase_degrees.some(p => p !== 0),
        has_impulse_data: !!impulseResponse,
        overall_level_db: frequencyResponse.spl_db.reduce((a, b) => a + b, 0) / frequencyResponse.spl_db.length
      },
      quick_stats,
      stored: validated.store_measurement
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
