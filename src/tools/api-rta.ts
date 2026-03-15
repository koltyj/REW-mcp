/**
 * Tool: rew.api_rta
 *
 * Control REW's Real-Time Analyzer (RTA) via API.
 * Start/stop the RTA, configure settings, and read captured data.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiRTAInputSchema = z.object({
  action: z.enum([
    'start', 'stop', 'capture', 'reset',
    'configure', 'read_levels', 'read_captured', 'read_distortion'
  ]).describe('RTA action to perform'),

  config: z.object({
    fft_size: z.number().optional()
      .describe('FFT size'),
    averaging: z.number().optional()
      .describe('Number of averages'),
    window: z.string().optional()
      .describe('Window function (e.g., "Hann", "Blackman-Harris")')
  }).optional()
    .describe('RTA configuration (for configure action)')
});

export type ApiRTAInput = z.infer<typeof ApiRTAInputSchema>;

export interface ApiRTAResult {
  action: string;
  success: boolean;
  message: string;
  available_commands?: string[];
  configuration?: unknown;
  levels?: unknown;
  captured_data?: unknown;
  distortion?: unknown;
}

/**
 * Execute API RTA tool
 */
export async function executeApiRTA(input: ApiRTAInput): Promise<ToolResponse<ApiRTAResult>> {
  try {
    const validated = ApiRTAInputSchema.parse(input);
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
      case 'start': {
        const result = await client.executeRTACommand('Start');

        return {
          status: 'success',
          data: {
            action: 'start',
            success: result.success,
            message: result.success ? 'RTA started' : `Failed to start RTA: HTTP ${result.status}`
          }
        };
      }

      case 'stop': {
        const result = await client.executeRTACommand('Stop');

        return {
          status: 'success',
          data: {
            action: 'stop',
            success: result.success,
            message: result.success ? 'RTA stopped' : `Failed to stop RTA: HTTP ${result.status}`
          }
        };
      }

      case 'capture': {
        const result = await client.executeRTACommand('Capture');

        return {
          status: 'success',
          data: {
            action: 'capture',
            success: result.success,
            message: result.success ? 'RTA data captured' : `Failed to capture RTA data: HTTP ${result.status}`
          }
        };
      }

      case 'reset': {
        const result = await client.executeRTACommand('Reset');

        return {
          status: 'success',
          data: {
            action: 'reset',
            success: result.success,
            message: result.success ? 'RTA reset' : `Failed to reset RTA: HTTP ${result.status}`
          }
        };
      }

      case 'configure': {
        if (validated.config) {
          const success = await client.setRTAConfiguration(validated.config);

          return {
            status: 'success',
            data: {
              action: 'configure',
              success,
              message: success ? 'RTA configuration updated' : 'Failed to update RTA configuration',
              configuration: validated.config
            }
          };
        }

        // No config provided — read current configuration
        const config = await client.getRTAConfiguration();

        return {
          status: 'success',
          data: {
            action: 'configure',
            success: true,
            message: 'Current RTA configuration',
            configuration: config
          }
        };
      }

      case 'read_levels': {
        const levels = await client.getRTALevels();

        return {
          status: 'success',
          data: {
            action: 'read_levels',
            success: true,
            message: 'RTA levels retrieved',
            levels
          }
        };
      }

      case 'read_captured': {
        const capturedData = await client.getRTACapturedData();

        return {
          status: 'success',
          data: {
            action: 'read_captured',
            success: true,
            message: 'RTA captured data retrieved',
            captured_data: capturedData
          }
        };
      }

      case 'read_distortion': {
        const distortion = await client.getRTADistortion();

        return {
          status: 'success',
          data: {
            action: 'read_distortion',
            success: true,
            message: 'RTA distortion data retrieved',
            distortion
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: start, stop, capture, reset, configure, read_levels, read_captured, read_distortion'
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
