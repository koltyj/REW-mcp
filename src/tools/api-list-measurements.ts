/**
 * Tool: rew.api_list_measurements
 * 
 * List all measurements available in the connected REW instance.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import type { ToolResponse } from '../types/index.js';

// Input schema (no required parameters)
export const ApiListMeasurementsInputSchema = z.object({
  filter_type: z.enum(['all', 'frequency_response', 'impulse_response']).default('all')
    .describe('Filter by measurement type')
});

export type ApiListMeasurementsInput = z.infer<typeof ApiListMeasurementsInputSchema>;

export interface MeasurementListItem {
  uuid: string;
  name: string;
  index: number;
  type: string;
  has_ir: boolean;
  has_fr: boolean;
}

export interface ApiListMeasurementsResult {
  connected: boolean;
  measurement_count: number;
  measurements: MeasurementListItem[];
}

/**
 * Execute API list measurements tool
 */
export async function executeApiListMeasurements(input: ApiListMeasurementsInput): Promise<ToolResponse<ApiListMeasurementsResult>> {
  try {
    // Validate input
    const validated = ApiListMeasurementsInputSchema.parse(input);

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

    // List measurements
    const measurements = await client.listMeasurements();

    // Filter if requested
    let filteredMeasurements = measurements;
    if (validated.filter_type === 'frequency_response') {
      filteredMeasurements = measurements.filter(m => m.has_fr);
    } else if (validated.filter_type === 'impulse_response') {
      filteredMeasurements = measurements.filter(m => m.has_ir);
    }

    return {
      status: 'success',
      data: {
        connected: true,
        measurement_count: filteredMeasurements.length,
        measurements: filteredMeasurements
      }
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
