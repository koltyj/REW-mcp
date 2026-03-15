/**
 * Tool: rew.api_measurement_commands
 *
 * Execute per-measurement commands via API.
 * Useful for running processing operations on individual measurements.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiMeasurementCommandsInputSchema = z.object({
  action: z.enum(['list_commands', 'execute'])
    .describe('Action to perform'),

  measurement_uuid: z.string()
    .describe('UUID of the measurement'),

  command: z.string().optional()
    .describe('Command to execute (for execute action)'),

  parameters: z.array(z.string()).optional()
    .describe('Parameters for the command (for execute action)')
});

export type ApiMeasurementCommandsInput = z.infer<typeof ApiMeasurementCommandsInputSchema>;

export interface ApiMeasurementCommandsResult {
  action: string;
  success: boolean;
  message: string;
  measurement_uuid: string;
  available_commands?: string[];
  command_result?: unknown;
}

/**
 * Execute API measurement commands tool
 */
export async function executeApiMeasurementCommands(input: ApiMeasurementCommandsInput): Promise<ToolResponse<ApiMeasurementCommandsResult>> {
  try {
    const validated = ApiMeasurementCommandsInputSchema.parse(input);
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
      case 'list_commands': {
        const commands = await client.getMeasurementCommands(validated.measurement_uuid);

        return {
          status: 'success',
          data: {
            action: 'list_commands',
            success: true,
            message: `${commands.length} commands available for measurement`,
            measurement_uuid: validated.measurement_uuid,
            available_commands: commands
          }
        };
      }

      case 'execute': {
        if (!validated.command) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Command required for execute action',
            suggestion: 'Use action: list_commands to see available commands'
          };
        }

        const result = await client.executeMeasurementCommand(
          validated.measurement_uuid,
          validated.command,
          validated.parameters
        );

        return {
          status: 'success',
          data: {
            action: 'execute',
            success: result.success,
            message: result.success
              ? `Command "${validated.command}" executed successfully`
              : `Command "${validated.command}" failed: HTTP ${result.status}`,
            measurement_uuid: validated.measurement_uuid,
            command_result: result.data
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: list_commands, execute'
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
