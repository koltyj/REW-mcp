/**
 * Tool: rew.api_import
 *
 * Import measurement data into REW via API.
 * Supports frequency response files/data, impulse response files/data, RTA files, and sweep recordings.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiImportInputSchema = z.object({
  action: z.enum([
    'frequency_response_file', 'frequency_response_data',
    'impulse_response_file', 'impulse_response_data',
    'rta_file', 'sweep_recording'
  ]).describe('Import action to perform'),

  file_path: z.string().optional()
    .describe('File path for file-based imports'),

  data: z.object({
    frequencies: z.array(z.number()).optional()
      .describe('Frequency array (for frequency_response_data)'),
    magnitudes: z.array(z.number()).optional()
      .describe('Magnitude array (for frequency_response_data)'),
    phases: z.array(z.number()).optional()
      .describe('Phase array (for frequency_response_data)'),
    samples: z.array(z.number()).optional()
      .describe('Sample array (for impulse_response_data)'),
    sample_rate: z.number().optional()
      .describe('Sample rate in Hz (for impulse_response_data)')
  }).optional()
    .describe('Data for data-based imports')
});

export type ApiImportInput = z.infer<typeof ApiImportInputSchema>;

export interface ApiImportResult {
  action: string;
  success: boolean;
  message: string;
  uuid?: string;
}

/**
 * Execute API import tool
 */
export async function executeApiImport(input: ApiImportInput): Promise<ToolResponse<ApiImportResult>> {
  try {
    const validated = ApiImportInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    switch (validated.action) {
      case 'frequency_response_file': {
        if (!validated.file_path) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'file_path required for frequency_response_file action',
            suggestion: 'Provide the path to a frequency response file'
          };
        }

        const result = await client.importFrequencyResponseFile(validated.file_path);

        return {
          status: 'success',
          data: {
            action: 'frequency_response_file',
            success: result.success,
            message: result.success
              ? `Frequency response imported${result.uuid ? ` (UUID: ${result.uuid})` : ''}`
              : 'Failed to import frequency response file',
            uuid: result.uuid
          }
        };
      }

      case 'frequency_response_data': {
        if (!validated.data?.frequencies || !validated.data?.magnitudes) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'data.frequencies and data.magnitudes required for frequency_response_data action',
            suggestion: 'Provide arrays of frequencies and magnitudes'
          };
        }

        const result = await client.importFrequencyResponseData({
          frequencies: validated.data.frequencies,
          magnitudes: validated.data.magnitudes,
          phases: validated.data.phases
        });

        return {
          status: 'success',
          data: {
            action: 'frequency_response_data',
            success: result.success,
            message: result.success
              ? `Frequency response data imported (${validated.data.frequencies.length} points)${result.uuid ? ` UUID: ${result.uuid}` : ''}`
              : 'Failed to import frequency response data',
            uuid: result.uuid
          }
        };
      }

      case 'impulse_response_file': {
        if (!validated.file_path) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'file_path required for impulse_response_file action',
            suggestion: 'Provide the path to an impulse response file'
          };
        }

        const result = await client.importImpulseResponseFile(validated.file_path);

        return {
          status: 'success',
          data: {
            action: 'impulse_response_file',
            success: result.success,
            message: result.success
              ? `Impulse response imported${result.uuid ? ` (UUID: ${result.uuid})` : ''}`
              : 'Failed to import impulse response file',
            uuid: result.uuid
          }
        };
      }

      case 'impulse_response_data': {
        if (!validated.data?.samples || !validated.data?.sample_rate) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'data.samples and data.sample_rate required for impulse_response_data action',
            suggestion: 'Provide sample array and sample rate'
          };
        }

        const result = await client.importImpulseResponseData({
          samples: validated.data.samples,
          sampleRate: validated.data.sample_rate
        });

        return {
          status: 'success',
          data: {
            action: 'impulse_response_data',
            success: result.success,
            message: result.success
              ? `Impulse response data imported (${validated.data.samples.length} samples @ ${validated.data.sample_rate} Hz)${result.uuid ? ` UUID: ${result.uuid}` : ''}`
              : 'Failed to import impulse response data',
            uuid: result.uuid
          }
        };
      }

      case 'rta_file': {
        if (!validated.file_path) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'file_path required for rta_file action',
            suggestion: 'Provide the path to an RTA file'
          };
        }

        const result = await client.importRTAFile(validated.file_path);

        return {
          status: 'success',
          data: {
            action: 'rta_file',
            success: result.success,
            message: result.success
              ? 'RTA file imported'
              : 'Failed to import RTA file'
          }
        };
      }

      case 'sweep_recording': {
        if (!validated.file_path) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'file_path required for sweep_recording action',
            suggestion: 'Provide the path to a sweep recording file'
          };
        }

        const result = await client.importSweepRecording(validated.file_path);

        return {
          status: 'success',
          data: {
            action: 'sweep_recording',
            success: result.success,
            message: result.success
              ? `Sweep recording imported${result.uuid ? ` (UUID: ${result.uuid})` : ''}`
              : 'Failed to import sweep recording',
            uuid: result.uuid
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: frequency_response_file, frequency_response_data, impulse_response_file, impulse_response_data, rta_file, sweep_recording'
        };
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`,
        suggestion: 'Check input parameters'
      };
    }

    if (error instanceof REWApiError) {
      return {
        status: 'error',
        error_type: error.code.toLowerCase(),
        message: error.message,
        suggestion: error.code === 'CONNECTION_REFUSED'
          ? 'Ensure REW is running with API enabled'
          : 'Check REW application for errors'
      };
    }

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestion: 'Check REW API connection'
    };
  }
}
