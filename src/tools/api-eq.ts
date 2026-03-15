/**
 * Tool: rew.api_eq
 *
 * Manage global EQ defaults and settings via API.
 * Control equalisers, manufacturers, defaults, and house curve.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiEQInputSchema = z.object({
  action: z.enum([
    'list_equalisers', 'list_manufacturers',
    'get_defaults', 'set_defaults',
    'get_house_curve', 'set_house_curve'
  ]).describe('EQ management action to perform'),

  defaults: z.unknown().optional()
    .describe('EQ defaults configuration (for set_defaults)'),

  house_curve: z.unknown().optional()
    .describe('House curve configuration (for set_house_curve)')
});

export type ApiEQInput = z.infer<typeof ApiEQInputSchema>;

export interface ApiEQResult {
  action: string;
  success: boolean;
  message: string;
  equalisers?: unknown[];
  manufacturers?: string[];
  defaults?: unknown;
  house_curve?: unknown;
}

/**
 * Execute API EQ tool
 */
export async function executeApiEQ(input: ApiEQInput): Promise<ToolResponse<ApiEQResult>> {
  try {
    const validated = ApiEQInputSchema.parse(input);
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
      case 'list_equalisers': {
        const equalisers = await client.getEqualisers();

        return {
          status: 'success',
          data: {
            action: 'list_equalisers',
            success: true,
            message: `${Array.isArray(equalisers) ? equalisers.length : 0} equalisers available`,
            equalisers: Array.isArray(equalisers) ? equalisers : []
          }
        };
      }

      case 'list_manufacturers': {
        const manufacturers = await client.getEQManufacturers();

        return {
          status: 'success',
          data: {
            action: 'list_manufacturers',
            success: true,
            message: `${manufacturers.length} manufacturers available`,
            manufacturers
          }
        };
      }

      case 'get_defaults': {
        const defaults = await client.getEQDefaults();

        return {
          status: 'success',
          data: {
            action: 'get_defaults',
            success: true,
            message: 'EQ defaults retrieved',
            defaults
          }
        };
      }

      case 'set_defaults': {
        if (validated.defaults === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Defaults configuration required for set_defaults action',
            suggestion: 'Use action: get_defaults to see current configuration'
          };
        }

        const success = await client.setEQDefaults(validated.defaults);

        return {
          status: 'success',
          data: {
            action: 'set_defaults',
            success,
            message: success ? 'EQ defaults updated' : 'Failed to update EQ defaults'
          }
        };
      }

      case 'get_house_curve': {
        const houseCurve = await client.getHouseCurve();

        return {
          status: 'success',
          data: {
            action: 'get_house_curve',
            success: true,
            message: 'House curve retrieved',
            house_curve: houseCurve
          }
        };
      }

      case 'set_house_curve': {
        if (validated.house_curve === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'House curve configuration required for set_house_curve action',
            suggestion: 'Use action: get_house_curve to see current configuration'
          };
        }

        const success = await client.setHouseCurve(validated.house_curve);

        return {
          status: 'success',
          data: {
            action: 'set_house_curve',
            success,
            message: success ? 'House curve updated' : 'Failed to update house curve'
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: list_equalisers, list_manufacturers, get_defaults, set_defaults, get_house_curve, set_house_curve'
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
