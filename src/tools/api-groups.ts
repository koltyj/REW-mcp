/**
 * Tool: rew.api_groups
 *
 * Manage measurement groups via API.
 * Create, list, update, and delete groups, and manage group membership.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiGroupsInputSchema = z.object({
  action: z.enum([
    'list', 'create', 'get', 'update', 'delete',
    'list_measurements', 'add_measurement', 'remove_measurement'
  ]).describe('Group action to perform'),

  group_id: z.string().optional()
    .describe('Group ID (required for get, update, delete, and measurement actions)'),

  group_name: z.string().optional()
    .describe('Group name (for create action)'),

  measurement_uuid: z.string().optional()
    .describe('Measurement UUID (for add_measurement, remove_measurement)'),

  data: z.unknown().optional()
    .describe('Group data (for update action)')
});

export type ApiGroupsInput = z.infer<typeof ApiGroupsInputSchema>;

export interface ApiGroupsResult {
  action: string;
  success: boolean;
  message: string;
  groups?: unknown[];
  group?: unknown;
  group_id?: string;
  measurements?: unknown[];
}

/**
 * Execute API groups tool
 */
export async function executeApiGroups(input: ApiGroupsInput): Promise<ToolResponse<ApiGroupsResult>> {
  try {
    const validated = ApiGroupsInputSchema.parse(input);
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
      case 'list': {
        const groups = await client.listGroups();

        return {
          status: 'success',
          data: {
            action: 'list',
            success: true,
            message: `${Array.isArray(groups) ? groups.length : 0} groups found`,
            groups: Array.isArray(groups) ? groups : []
          }
        };
      }

      case 'create': {
        if (!validated.group_name) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_name required for create action',
            suggestion: 'Provide a name for the new group'
          };
        }

        const result = await client.createGroup(validated.group_name);

        return {
          status: 'success',
          data: {
            action: 'create',
            success: true,
            message: `Group "${validated.group_name}" created`,
            group_id: result.id
          }
        };
      }

      case 'get': {
        if (!validated.group_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_id required for get action',
            suggestion: 'Use action: list to see available groups'
          };
        }

        const group = await client.getGroup(validated.group_id);

        return {
          status: 'success',
          data: {
            action: 'get',
            success: true,
            message: 'Group details retrieved',
            group
          }
        };
      }

      case 'update': {
        if (!validated.group_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_id required for update action',
            suggestion: 'Use action: list to see available groups'
          };
        }

        if (validated.data === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'data required for update action',
            suggestion: 'Use action: get to see current group data'
          };
        }

        const success = await client.updateGroup(validated.group_id, validated.data);

        return {
          status: 'success',
          data: {
            action: 'update',
            success,
            message: success ? 'Group updated' : 'Failed to update group'
          }
        };
      }

      case 'delete': {
        if (!validated.group_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_id required for delete action',
            suggestion: 'Use action: list to see available groups'
          };
        }

        const success = await client.deleteGroup(validated.group_id);

        return {
          status: 'success',
          data: {
            action: 'delete',
            success,
            message: success ? 'Group deleted' : 'Failed to delete group'
          }
        };
      }

      case 'list_measurements': {
        if (!validated.group_id) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_id required for list_measurements action',
            suggestion: 'Use action: list to see available groups'
          };
        }

        const measurements = await client.getGroupMeasurements(validated.group_id);

        return {
          status: 'success',
          data: {
            action: 'list_measurements',
            success: true,
            message: `${Array.isArray(measurements) ? measurements.length : 0} measurements in group`,
            measurements: Array.isArray(measurements) ? measurements : []
          }
        };
      }

      case 'add_measurement': {
        if (!validated.group_id || !validated.measurement_uuid) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_id and measurement_uuid required for add_measurement action',
            suggestion: 'Provide both the group ID and measurement UUID'
          };
        }

        const success = await client.addMeasurementToGroup(validated.group_id, validated.measurement_uuid);

        return {
          status: 'success',
          data: {
            action: 'add_measurement',
            success,
            message: success
              ? `Measurement added to group`
              : 'Failed to add measurement to group'
          }
        };
      }

      case 'remove_measurement': {
        if (!validated.group_id || !validated.measurement_uuid) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'group_id and measurement_uuid required for remove_measurement action',
            suggestion: 'Provide both the group ID and measurement UUID'
          };
        }

        const success = await client.removeMeasurementFromGroup(validated.group_id, validated.measurement_uuid);

        return {
          status: 'success',
          data: {
            action: 'remove_measurement',
            success,
            message: success
              ? 'Measurement removed from group'
              : 'Failed to remove measurement from group'
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: list, create, get, update, delete, list_measurements, add_measurement, remove_measurement'
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
