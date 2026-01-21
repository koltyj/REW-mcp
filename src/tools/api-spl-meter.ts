/**
 * Tool: rew.api_spl_meter
 * 
 * Control REW's SPL meter via API.
 * Useful for live level monitoring with various weightings (A, C, Z).
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiSPLMeterInputSchema = z.object({
  action: z.enum(['start', 'stop', 'read', 'configure'])
    .describe('SPL meter action to perform'),
  
  meter_id: z.number().int().min(1).max(4).default(1)
    .describe('SPL meter ID (1-4, REW Pro supports up to 4 meters)'),
  
  config: z.object({
    mode: z.enum(['SPL', 'Leq', 'SEL']).optional()
      .describe('Display mode'),
    weighting: z.enum(['A', 'C', 'Z']).optional()
      .describe('Frequency weighting (A=human hearing, C=flat low freq, Z=unweighted)'),
    filter: z.enum(['Slow', 'Fast', 'Impulse']).optional()
      .describe('Time weighting filter')
  }).optional()
    .describe('SPL meter configuration')
});

export type ApiSPLMeterInput = z.infer<typeof ApiSPLMeterInputSchema>;

export interface ApiSPLMeterResult {
  action: string;
  success: boolean;
  message: string;
  meter_id: number;
  levels?: {
    spl_db: number;
    leq_db: number;
    sel_db: number;
    weighting: string;
    filter: string;
    elapsed_time_s?: number;
  };
  config?: {
    mode?: string;
    weighting?: string;
    filter?: string;
  };
}

/**
 * Execute API SPL meter tool
 */
export async function executeApiSPLMeter(input: ApiSPLMeterInput): Promise<ToolResponse<ApiSPLMeterResult>> {
  try {
    const validated = ApiSPLMeterInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    const meterId = validated.meter_id;

    switch (validated.action) {
      case 'start': {
        // Configure first if config provided
        if (validated.config) {
          await client.setSPLMeterConfig(meterId, validated.config);
        }

        const success = await client.executeSPLMeterCommand(meterId, 'Start');

        return {
          status: 'success',
          data: {
            action: 'start',
            success,
            message: success 
              ? `SPL meter ${meterId} started`
              : `Failed to start SPL meter ${meterId}`,
            meter_id: meterId
          }
        };
      }

      case 'stop': {
        const success = await client.executeSPLMeterCommand(meterId, 'Stop');

        return {
          status: 'success',
          data: {
            action: 'stop',
            success,
            message: success 
              ? `SPL meter ${meterId} stopped`
              : `Failed to stop SPL meter ${meterId}`,
            meter_id: meterId
          }
        };
      }

      case 'read': {
        const levels = await client.getSPLMeterLevels(meterId);

        if (!levels) {
          return {
            status: 'success',
            data: {
              action: 'read',
              success: false,
              message: `Failed to read SPL meter ${meterId}. Meter may not be running.`,
              meter_id: meterId
            }
          };
        }

        return {
          status: 'success',
          data: {
            action: 'read',
            success: true,
            message: `SPL: ${levels.spl.toFixed(1)} dB${levels.weighting}`,
            meter_id: meterId,
            levels: {
              spl_db: levels.spl,
              leq_db: levels.leq,
              sel_db: levels.sel,
              weighting: levels.weighting,
              filter: levels.filter
            }
          }
        };
      }

      case 'configure': {
        if (!validated.config) {
          // Just read current config
          const config = await client.getSPLMeterConfig(meterId);

          return {
            status: 'success',
            data: {
              action: 'configure',
              success: true,
              message: 'Current SPL meter configuration',
              meter_id: meterId,
              config: config || {}
            }
          };
        }

        const success = await client.setSPLMeterConfig(meterId, validated.config);

        return {
          status: 'success',
          data: {
            action: 'configure',
            success,
            message: success 
              ? `SPL meter ${meterId} configured`
              : `Failed to configure SPL meter ${meterId}`,
            meter_id: meterId,
            config: validated.config
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: start, stop, read, configure'
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
      const suggestionMap: Record<string, string> = {
        'NOT_FOUND': 'Check REW application for errors',
        'CONNECTION_REFUSED': 'Ensure REW is running with API enabled. Check Preferences → API → Start',
        'TIMEOUT': 'REW took too long to respond. Check if REW is busy or frozen',
        'INTERNAL_ERROR': 'Check REW application for errors',
        'INVALID_RESPONSE': 'Check REW application for errors'
      };

      return {
        status: 'error',
        error_type: error.code.toLowerCase(),
        message: error.message,
        suggestion: suggestionMap[error.code] || 'Check REW application for errors'
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
