/**
 * Tool: rew.api_measurement_eq
 *
 * Manage per-measurement EQ settings via API.
 * Control equaliser, filters, target settings, and match-target for individual measurements.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiMeasurementEQInputSchema = z.object({
  action: z.enum([
    'get_equaliser', 'set_equaliser',
    'get_filters', 'set_filters',
    'get_target', 'set_target',
    'predicted_response', 'filter_response',
    'match_target'
  ]).describe('EQ action to perform'),

  measurement_uuid: z.string()
    .describe('UUID of the measurement'),

  equaliser: z.unknown().optional()
    .describe('Equaliser configuration (for set_equaliser)'),

  filters: z.array(z.unknown()).optional()
    .describe('Filter array (for set_filters)'),

  target_settings: z.unknown().optional()
    .describe('Target settings (for set_target)')
});

export type ApiMeasurementEQInput = z.infer<typeof ApiMeasurementEQInputSchema>;

export interface ApiMeasurementEQResult {
  action: string;
  success: boolean;
  message: string;
  measurement_uuid: string;
  equaliser?: unknown;
  filters?: unknown[];
  target_settings?: unknown;
  response_data?: unknown;
}

/**
 * Execute API measurement EQ tool
 */
export async function executeApiMeasurementEQ(input: ApiMeasurementEQInput): Promise<ToolResponse<ApiMeasurementEQResult>> {
  try {
    const validated = ApiMeasurementEQInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    const uuid = validated.measurement_uuid;

    switch (validated.action) {
      case 'get_equaliser': {
        const equaliser = await client.getMeasurementEqualiser(uuid);

        return {
          status: 'success',
          data: {
            action: 'get_equaliser',
            success: true,
            message: 'Equaliser settings retrieved',
            measurement_uuid: uuid,
            equaliser
          }
        };
      }

      case 'set_equaliser': {
        if (validated.equaliser === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Equaliser configuration required for set_equaliser action',
            suggestion: 'Use action: get_equaliser to see current configuration'
          };
        }

        const success = await client.setMeasurementEqualiser(uuid, validated.equaliser);

        return {
          status: 'success',
          data: {
            action: 'set_equaliser',
            success,
            message: success ? 'Equaliser updated' : 'Failed to update equaliser',
            measurement_uuid: uuid
          }
        };
      }

      case 'get_filters': {
        const filters = await client.getMeasurementFilters(uuid);

        return {
          status: 'success',
          data: {
            action: 'get_filters',
            success: true,
            message: `${Array.isArray(filters) ? filters.length : 0} filters retrieved`,
            measurement_uuid: uuid,
            filters: Array.isArray(filters) ? filters : []
          }
        };
      }

      case 'set_filters': {
        if (!validated.filters) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Filters array required for set_filters action',
            suggestion: 'Use action: get_filters to see current filters'
          };
        }

        const success = await client.setMeasurementFilters(uuid, validated.filters);

        return {
          status: 'success',
          data: {
            action: 'set_filters',
            success,
            message: success ? 'Filters updated' : 'Failed to update filters',
            measurement_uuid: uuid
          }
        };
      }

      case 'get_target': {
        const targetSettings = await client.getMeasurementTargetSettings(uuid);

        return {
          status: 'success',
          data: {
            action: 'get_target',
            success: true,
            message: 'Target settings retrieved',
            measurement_uuid: uuid,
            target_settings: targetSettings
          }
        };
      }

      case 'set_target': {
        if (validated.target_settings === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Target settings required for set_target action',
            suggestion: 'Use action: get_target to see current settings'
          };
        }

        const success = await client.setMeasurementTargetSettings(uuid, validated.target_settings);

        return {
          status: 'success',
          data: {
            action: 'set_target',
            success,
            message: success ? 'Target settings updated' : 'Failed to update target settings',
            measurement_uuid: uuid
          }
        };
      }

      case 'predicted_response': {
        const response = await client.getEQPredictedResponse(uuid);

        return {
          status: 'success',
          data: {
            action: 'predicted_response',
            success: true,
            message: 'EQ predicted response retrieved',
            measurement_uuid: uuid,
            response_data: response
          }
        };
      }

      case 'filter_response': {
        const response = await client.getEQFilterResponse(uuid);

        return {
          status: 'success',
          data: {
            action: 'filter_response',
            success: true,
            message: 'EQ filter response retrieved',
            measurement_uuid: uuid,
            response_data: response
          }
        };
      }

      case 'match_target': {
        const result = await client.matchTarget(uuid);

        return {
          status: 'success',
          data: {
            action: 'match_target',
            success: result.success,
            message: result.success
              ? 'Target matching completed'
              : 'Target matching failed',
            measurement_uuid: uuid
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: get_equaliser, set_equaliser, get_filters, set_filters, get_target, set_target, predicted_response, filter_response, match_target'
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
