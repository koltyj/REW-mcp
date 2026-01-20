/**
 * Tool: rew.api_connect
 * 
 * Connect to a running REW instance's REST API.
 * REW must be launched with -api flag or have API enabled in preferences.
 */

import { z } from 'zod';
import { createREWApiClient, REWApiClient } from '../api/rew-client.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiConnectInputSchema = z.object({
  port: z.number().int().min(1025).max(65535).default(4735)
    .describe('REW API port (default 4735)'),
  timeout_ms: z.number().int().min(1000).max(60000).default(10000)
    .describe('Connection timeout in milliseconds'),
  host: z.string().default('127.0.0.1')
    .describe('Host address (default localhost)')
});

export type ApiConnectInput = z.infer<typeof ApiConnectInputSchema>;

export interface ApiConnectResult {
  status: 'connected' | 'error';
  rew_version?: string;
  measurements_available: number;
  api_capabilities: {
    pro_features: boolean;
    blocking_mode: boolean;
  };
  error_message?: string;
}

// Store active client connection
let activeClient: REWApiClient | null = null;

/**
 * Get the active API client (for use by other tools)
 */
export function getActiveApiClient(): REWApiClient | null {
  return activeClient;
}

/**
 * Execute API connect tool
 */
export async function executeApiConnect(input: ApiConnectInput): Promise<ToolResponse<ApiConnectResult>> {
  try {
    // Validate input
    const validated = ApiConnectInputSchema.parse(input);

    // Disconnect existing client if any
    if (activeClient) {
      activeClient.disconnect();
    }

    // Create new client
    activeClient = createREWApiClient({
      host: validated.host,
      port: validated.port,
      timeout: validated.timeout_ms
    });

    // Attempt connection
    const connectionStatus = await activeClient.connect();

    if (!connectionStatus.connected) {
      activeClient = null;
      
      return {
        status: 'success',
        data: {
          status: 'error',
          measurements_available: 0,
          api_capabilities: {
            pro_features: false,
            blocking_mode: false
          },
          error_message: connectionStatus.error_message || 'Failed to connect to REW API'
        }
      };
    }

    return {
      status: 'success',
      data: {
        status: 'connected',
        rew_version: connectionStatus.rew_version,
        measurements_available: connectionStatus.measurements_available,
        api_capabilities: connectionStatus.api_capabilities
      }
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`,
        suggestion: 'Check that port and timeout values are within valid ranges'
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
