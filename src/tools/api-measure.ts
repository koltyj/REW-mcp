/**
 * Tool: rew.api_measure
 * 
 * Control REW measurements via API.
 * Note: Automated sweep measurements require REW Pro license.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';
import { type SweepConfig } from '../api/schemas.js';

// Input schema for measure commands
export const ApiMeasureInputSchema = z.object({
  action: z.enum(['status', 'sweep', 'spl', 'cancel', 'configure'])
    .describe('Measurement action to perform'),
  
  // Configuration options (for action: configure or sweep)
  config: z.object({
    level_db: z.number().min(-60).max(0).optional()
      .describe('Measurement level in dBFS'),
    start_freq_hz: z.number().min(1).max(20000).optional()
      .describe('Sweep start frequency in Hz'),
    end_freq_hz: z.number().min(100).max(48000).optional()
      .describe('Sweep end frequency in Hz'),
    sweep_length: z.number().optional()
      .describe('Sweep length in samples'),
    notes: z.string().optional()
      .describe('Notes to attach to the measurement'),
    name_prefix: z.string().optional()
      .describe('Prefix for measurement name')
  }).optional()
    .describe('Measurement configuration options')
});

export type ApiMeasureInput = z.infer<typeof ApiMeasureInputSchema>;

export interface ApiMeasureResult {
  action: string;
  success: boolean;
  message: string;
  current_config?: {
    level_db?: number;
    level_unit?: string;
    sweep_start_hz?: number;
    sweep_end_hz?: number;
    sweep_length?: number;
  };
  available_commands?: string[];
  pro_license_required?: boolean;
}

/**
 * Execute API measure tool
 */
export async function executeApiMeasure(input: ApiMeasureInput): Promise<ToolResponse<ApiMeasureResult>> {
  try {
    const validated = ApiMeasureInputSchema.parse(input);
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
      case 'status': {
        // Get current measurement status and configuration
        const [level, sweepConfig, commands] = await Promise.all([
          client.getMeasureLevel(),
          client.getSweepConfig(),
          client.getMeasureCommands()
        ]);

        return {
          status: 'success',
          data: {
            action: 'status',
            success: true,
            message: 'Measurement status retrieved',
            current_config: {
              level_db: level?.level,
              level_unit: level?.unit,
              sweep_start_hz: sweepConfig?.startFreq,
              sweep_end_hz: sweepConfig?.endFreq,
              sweep_length: sweepConfig?.length
            },
            available_commands: commands
          }
        };
      }

      case 'configure': {
        const config = validated.config;
        if (!config) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Configuration options required for configure action',
            suggestion: 'Provide config object with level_db, start_freq_hz, etc.'
          };
        }

        const results: string[] = [];

        // Set level if provided
        if (config.level_db !== undefined) {
          const levelSet = await client.setMeasureLevel(config.level_db, 'dBFS');
          results.push(`Level: ${levelSet ? 'set' : 'failed'}`);
        }

        // Set sweep config if any freq params provided
        if (config.start_freq_hz !== undefined || config.end_freq_hz !== undefined || config.sweep_length !== undefined) {
          const sweepConfig: SweepConfig = {};
          if (config.start_freq_hz !== undefined) sweepConfig.startFreq = config.start_freq_hz;
          if (config.end_freq_hz !== undefined) sweepConfig.endFreq = config.end_freq_hz;
          if (config.sweep_length !== undefined) sweepConfig.length = config.sweep_length;

          const sweepSet = await client.setSweepConfig(sweepConfig);
          results.push(`Sweep config: ${sweepSet ? 'set' : 'failed'}`);
        }

        // Set notes if provided
        if (config.notes !== undefined) {
          const notesSet = await client.setMeasureNotes(config.notes);
          results.push(`Notes: ${notesSet ? 'set' : 'failed'}`);
        }

        return {
          status: 'success',
          data: {
            action: 'configure',
            success: true,
            message: `Configuration updated: ${results.join(', ')}`
          }
        };
      }

      case 'sweep': {
        // Apply any config first
        if (validated.config) {
          if (validated.config.level_db !== undefined) {
            await client.setMeasureLevel(validated.config.level_db, 'dBFS');
          }
          if (validated.config.notes !== undefined) {
            await client.setMeasureNotes(validated.config.notes);
          }
        }

        // Trigger sweep measurement
        const result = await client.executeMeasureCommand('Measure');

        if (!result.success) {
          // Check if it's a pro license issue
          const isPro = result.status === 403 || 
            (typeof result.data === 'string' && result.data.toLowerCase().includes('pro'));

          return {
            status: 'success',
            data: {
              action: 'sweep',
              success: false,
              message: isPro 
                ? 'Automated sweep measurements require REW Pro license'
                : `Measurement command failed: HTTP ${result.status}`,
              pro_license_required: isPro
            }
          };
        }

        return {
          status: 'success',
          data: {
            action: 'sweep',
            success: true,
            message: result.status === 202 
              ? 'Sweep measurement started (running asynchronously)'
              : 'Sweep measurement completed'
          }
        };
      }

      case 'spl': {
        // Trigger SPL measurement
        const result = await client.executeMeasureCommand('SPL');

        return {
          status: 'success',
          data: {
            action: 'spl',
            success: result.success,
            message: result.success 
              ? 'SPL measurement started'
              : `SPL measurement failed: HTTP ${result.status}`
          }
        };
      }

      case 'cancel': {
        // Cancel current measurement
        const result = await client.executeMeasureCommand('Cancel');

        return {
          status: 'success',
          data: {
            action: 'cancel',
            success: result.success,
            message: result.success 
              ? 'Measurement cancelled'
              : 'No measurement to cancel or cancel failed'
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: status, sweep, spl, cancel, configure'
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
