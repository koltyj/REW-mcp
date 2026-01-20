/**
 * Tool Registration
 * 
 * Registers all REW MCP tools with the server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { executeIngest, IngestInputSchema } from './ingest.js';
import { executeCompare, CompareInputSchema } from './compare.js';
import { executeRoomModes, RoomModesInputSchema } from './room-modes.js';
import { executeDecay, DecayInputSchema } from './decay.js';
import { executeImpulse, ImpulseInputSchema } from './impulse.js';
import { executeGLMInterpret, GLMInterpretInputSchema } from './glm-interpret.js';
import { executeAveraging, AveragingInputSchema } from './averaging.js';
import { executeSubIntegration, SubIntegrationInputSchema } from './sub-integration.js';
import { executeApiConnect, ApiConnectInputSchema } from './api-connect.js';
import { executeApiListMeasurements, ApiListMeasurementsInputSchema } from './api-list-measurements.js';
import { executeApiGetMeasurement, ApiGetMeasurementInputSchema } from './api-get-measurement.js';

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: Server): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'rew.ingest_measurement',
          description: 'Parse and store a REW measurement export for analysis. Accepts frequency response or impulse response data in REW text export format.',
          inputSchema: zodToJsonSchema(IngestInputSchema)
        },
        {
          name: 'rew.compare_measurements',
          description: 'Compare two or more REW measurements to determine what improved, worsened, or stayed the same. Supports pre/post GLM comparison, placement comparisons, and L/R symmetry analysis.',
          inputSchema: zodToJsonSchema(CompareInputSchema)
        },
        {
          name: 'rew.analyze_room_modes',
          description: 'Analyze a measurement for room modes, peaks, and nulls. Optionally correlates detected issues with theoretical room modes based on room dimensions.',
          inputSchema: zodToJsonSchema(RoomModesInputSchema)
        },
        {
          name: 'rew.analyze_decay',
          description: 'Analyze decay characteristics from impulse response data to identify frequencies with excessive ringing or resonance.',
          inputSchema: zodToJsonSchema(DecayInputSchema)
        },
        {
          name: 'rew.analyze_impulse',
          description: 'Analyze impulse response data to detect early reflections, estimate reflection paths, and assess their impact on sound quality.',
          inputSchema: zodToJsonSchema(ImpulseInputSchema)
        },
        {
          name: 'rew.interpret_with_glm_context',
          description: 'Interpret measurement analysis results considering Genelec GLM\'s capabilities and limitations. Explains what GLM can address, what requires physical solutions, and provides calibration-aware recommendations.',
          inputSchema: zodToJsonSchema(GLMInterpretInputSchema)
        },
        {
          name: 'rew.average_measurements',
          description: 'Create a spatial average from multiple measurement positions. Implements REW\'s averaging methods: RMS (incoherent, recommended for spatial averaging), Vector (coherent, requires phase data), or hybrid methods. Useful for multi-position room calibration.',
          inputSchema: zodToJsonSchema(AveragingInputSchema)
        },
        {
          name: 'rew.analyze_sub_integration',
          description: 'Analyze subwoofer integration with main speakers. Evaluates phase alignment, timing, and polarity at the crossover region. Provides delay and polarity recommendations for optimal summation.',
          inputSchema: zodToJsonSchema(SubIntegrationInputSchema)
        },
        {
          name: 'rew.api_connect',
          description: 'Connect to a running REW instance\'s REST API. REW must be launched with -api flag or have API enabled in preferences. Default port is 4735.',
          inputSchema: zodToJsonSchema(ApiConnectInputSchema)
        },
        {
          name: 'rew.api_list_measurements',
          description: 'List all measurements available in the connected REW instance. Requires prior connection via rew.api_connect.',
          inputSchema: zodToJsonSchema(ApiListMeasurementsInputSchema)
        },
        {
          name: 'rew.api_get_measurement',
          description: 'Fetch a measurement directly from REW via API. Use UUID (not index) to identify measurements, as indices shift when measurements are added/removed.',
          inputSchema: zodToJsonSchema(ApiGetMeasurementInputSchema)
        }
      ]
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      let result;
      
      switch (name) {
        case 'rew.ingest_measurement':
          result = await executeIngest(args as any);
          break;
          
        case 'rew.compare_measurements':
          result = await executeCompare(args as any);
          break;
          
        case 'rew.analyze_room_modes':
          result = await executeRoomModes(args as any);
          break;
          
        case 'rew.analyze_decay':
          result = await executeDecay(args as any);
          break;
          
        case 'rew.analyze_impulse':
          result = await executeImpulse(args as any);
          break;
          
        case 'rew.interpret_with_glm_context':
          result = await executeGLMInterpret(args as any);
          break;
          
        case 'rew.average_measurements':
          result = await executeAveraging(args as any);
          break;
          
        case 'rew.analyze_sub_integration':
          result = await executeSubIntegration(args as any);
          break;
          
        case 'rew.api_connect':
          result = await executeApiConnect(args as any);
          break;
          
        case 'rew.api_list_measurements':
          result = await executeApiListMeasurements(args as any);
          break;
          
        case 'rew.api_get_measurement':
          result = await executeApiGetMeasurement(args as any);
          break;
          
        default:
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'error',
                error_type: 'unknown_tool',
                message: `Unknown tool: ${name}`
              })
            }],
            isError: true
          };
      }
      
      // Format response per MCP specification
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.status === 'success' ? result.data : result)
        }],
        isError: result.status === 'error'
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            error_type: 'internal_error',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
          })
        }],
        isError: true
      };
    }
  });
}
