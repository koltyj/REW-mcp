/**
 * Tool: rew.api_generator
 * 
 * Control REW's signal generator via API.
 * Useful for generating test tones, pink noise, sweeps, etc.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiGeneratorInputSchema = z.object({
  action: z.enum(['status', 'start', 'stop', 'set_signal', 'set_level', 'set_frequency', 'list_signals'])
    .describe('Generator action to perform'),
  
  signal: z.string().optional()
    .describe('Signal type (for set_signal). Common: "Pink noise", "White noise", "Sine", "Sweep"'),
  
  level_db: z.number().min(-60).max(0).optional()
    .describe('Output level in dBFS (for set_level)'),
  
  frequency_hz: z.number().min(20).max(20000).optional()
    .describe('Frequency in Hz (for set_frequency, applies to tone signals)')
});

export type ApiGeneratorInput = z.infer<typeof ApiGeneratorInputSchema>;

export interface ApiGeneratorResult {
  action: string;
  success: boolean;
  message: string;
  generator_status?: {
    enabled: boolean;
    playing: boolean;
    signal?: string;
    level_db?: number;
    frequency_hz?: number;
  };
  available_signals?: string[];
  available_commands?: string[];
}

/**
 * Execute API generator tool
 */
export async function executeApiGenerator(input: ApiGeneratorInput): Promise<ToolResponse<ApiGeneratorResult>> {
  try {
    const validated = ApiGeneratorInputSchema.parse(input);
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
        const [status, signal, level, frequency, commands] = await Promise.all([
          client.getGeneratorStatus(),
          client.getGeneratorSignal(),
          client.getGeneratorLevel(),
          client.getGeneratorFrequency(),
          client.getGeneratorCommands()
        ]);

        return {
          status: 'success',
          data: {
            action: 'status',
            success: true,
            message: status?.playing ? 'Generator is playing' : 'Generator is stopped',
            generator_status: {
              enabled: status?.enabled ?? false,
              playing: status?.playing ?? false,
              signal: signal ?? status?.signal,
              level_db: level?.level ?? status?.level,
              frequency_hz: frequency ?? undefined
            },
            available_commands: commands
          }
        };
      }

      case 'list_signals': {
        const signals = await client.getGeneratorSignals();

        return {
          status: 'success',
          data: {
            action: 'list_signals',
            success: true,
            message: `${signals.length} signals available`,
            available_signals: signals
          }
        };
      }

      case 'start': {
        // REW API uses "Play" command for generator
        const success = await client.executeGeneratorCommand('Play');

        return {
          status: 'success',
          data: {
            action: 'start',
            success,
            message: success ? 'Generator started' : 'Failed to start generator'
          }
        };
      }

      case 'stop': {
        // REW API uses "Stop" command for generator
        const success = await client.executeGeneratorCommand('Stop');

        return {
          status: 'success',
          data: {
            action: 'stop',
            success,
            message: success ? 'Generator stopped' : 'Failed to stop generator'
          }
        };
      }

      case 'set_signal': {
        if (!validated.signal) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Signal type required for set_signal action',
            suggestion: 'Use action: list_signals to see available signal types'
          };
        }

        const success = await client.setGeneratorSignal(validated.signal);

        return {
          status: 'success',
          data: {
            action: 'set_signal',
            success,
            message: success 
              ? `Signal set to: ${validated.signal}`
              : `Failed to set signal. Check signal name is correct.`
          }
        };
      }

      case 'set_level': {
        if (validated.level_db === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Level required for set_level action',
            suggestion: 'Provide level_db between -60 and 0'
          };
        }

        const success = await client.setGeneratorLevel(validated.level_db, 'dBFS');

        return {
          status: 'success',
          data: {
            action: 'set_level',
            success,
            message: success 
              ? `Level set to: ${validated.level_db} dBFS`
              : `Failed to set level`
          }
        };
      }

      case 'set_frequency': {
        if (validated.frequency_hz === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Frequency required for set_frequency action',
            suggestion: 'Provide frequency_hz between 20 and 20000'
          };
        }

        const success = await client.setGeneratorFrequency(validated.frequency_hz);

        return {
          status: 'success',
          data: {
            action: 'set_frequency',
            success,
            message: success 
              ? `Frequency set to: ${validated.frequency_hz} Hz`
              : `Failed to set frequency. Current signal may not support frequency setting.`
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: status, start, stop, set_signal, set_level, set_frequency, list_signals'
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

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestion: 'Check REW API connection'
    };
  }
}
