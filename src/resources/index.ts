/**
 * Resource Registration
 *
 * Registers all MCP resources for session state, measurement data,
 * and recommendations access.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Session list is accessed via listSessionResources from session-resource.js
import { readSessionResource, listSessionResources } from './session-resource.js';
import { readMeasurementResource } from './measurement-resource.js';
import { readRecommendationsResource } from './recommendations-resource.js';
import { readHistoryResource } from './history-resource.js';

/**
 * Register all resources with the MCP server
 */
export function registerResources(server: Server): void {
  // List resources handler - returns dynamic list of active session resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const sessionResources = listSessionResources();
    return {
      resources: sessionResources,
    };
  });

  // List resource templates handler - returns URI templates for resource types
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: 'session://{session_id}',
          name: 'Measurement Session',
          description: 'Access session state including measurements and sequence progress',
          mimeType: 'application/json',
        },
        {
          uriTemplate: 'measurement://{measurement_id}',
          name: 'Measurement Data',
          description: 'Access full measurement data including frequency response arrays',
          mimeType: 'application/json',
        },
        {
          uriTemplate: 'recommendations://{session_id}',
          name: 'Session Recommendations',
          description: 'Access recommendations for a measurement session',
          mimeType: 'application/json',
        },
        {
          uriTemplate: 'history://{session_id}',
          name: 'Measurement History',
          description: 'Access measurement history and summaries for a session',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Read resource handler - parses URI and delegates to specific handlers
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Parse URI scheme and path
    const match = uri.match(/^(\w+):\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    const [, scheme, path] = match;

    let contents: { uri: string; mimeType: string; text: string };

    switch (scheme) {
      case 'session': {
        const data = readSessionResource(path);
        contents = {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        };
        break;
      }

      case 'measurement': {
        const data = readMeasurementResource(path);
        contents = {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        };
        break;
      }

      case 'recommendations': {
        const data = readRecommendationsResource(path);
        contents = {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        };
        break;
      }

      case 'history': {
        const data = readHistoryResource(path);
        contents = {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        };
        break;
      }

      default:
        throw new Error(`Unknown resource scheme: ${scheme}`);
    }

    return {
      contents: [contents],
    };
  });
}
