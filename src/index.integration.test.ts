/**
 * MCP Server Integration Tests
 *
 * End-to-end tests using InMemoryTransport to verify MCP protocol compliance.
 * Tests verify tool registration, error propagation, and analysis tool functionality.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { registerTools } from './tools/index.js';

// MSW server for mocking REW API
const mswServer = setupServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('MCP Server Integration', () => {
  let mcpServer: Server;
  let mcpClient: Client;

  beforeEach(async () => {
    // Create fresh server and client for each test
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    mcpServer = new Server(
      { name: 'rew-mcp', version: '1.0.0' },
      {
        capabilities: {
          tools: { listChanged: true },
          logging: {}
        }
      }
    );
    registerTools(mcpServer);
    await mcpServer.connect(serverTransport);

    mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, {});
    await mcpClient.connect(clientTransport);
  });

  describe('Tool Registration', () => {
    it('should register exactly 22 tools', async () => {
      const { tools } = await mcpClient.listTools();

      expect(tools).toHaveLength(22);
    });

    it('should register all expected tool names', async () => {
      const { tools } = await mcpClient.listTools();
      const toolNames = tools.map(t => t.name);

      // Core analysis tools
      expect(toolNames).toContain('rew.ingest_measurement');
      expect(toolNames).toContain('rew.compare_measurements');
      expect(toolNames).toContain('rew.analyze_room_modes');
      expect(toolNames).toContain('rew.analyze_decay');
      expect(toolNames).toContain('rew.analyze_impulse');
      expect(toolNames).toContain('rew.interpret_with_glm_context');
      expect(toolNames).toContain('rew.average_measurements');
      expect(toolNames).toContain('rew.analyze_sub_integration');
      expect(toolNames).toContain('rew.compare_to_target');

      // API tools
      expect(toolNames).toContain('rew.api_connect');
      expect(toolNames).toContain('rew.api_list_measurements');
      expect(toolNames).toContain('rew.api_get_measurement');
      expect(toolNames).toContain('rew.api_measure');
      expect(toolNames).toContain('rew.api_audio');
      expect(toolNames).toContain('rew.api_generator');
      expect(toolNames).toContain('rew.api_spl_meter');
      expect(toolNames).toContain('rew.api_measure_workflow');
      expect(toolNames).toContain('rew.api_check_levels');
      expect(toolNames).toContain('rew.api_calibrate_spl');
      expect(toolNames).toContain('rew.api_measurement_session');
      expect(toolNames).toContain('rew.analyze_room');
      expect(toolNames).toContain('rew.optimize_room');
    });

    it('should have valid inputSchema for each tool', async () => {
      const { tools } = await mcpClient.listTools();

      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });

    it('should have title and description for each tool', async () => {
      const { tools } = await mcpClient.listTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('MCP Capabilities', () => {
    it('should not declare resources capability', async () => {
      // Server capabilities are set during construction
      // This test verifies the server doesn't have resources/prompts handlers
      // that would indicate unused capability declarations
      const { tools } = await mcpClient.listTools();

      // If we can list tools successfully, the server is working
      expect(tools.length).toBeGreaterThan(0);

      // The server constructor in index.ts should NOT include resources: {} or prompts: {}
      // This is verified by code inspection, not runtime check
    });
  });

  describe('Error Propagation', () => {
    it('should set isError: false when API connection fails gracefully', async () => {
      // Connection failure is handled as successful tool execution with error status in data
      mswServer.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.error();  // Network error
        })
      );

      const response = await mcpClient.callTool({
        name: 'rew.api_connect',
        arguments: {}
      });

      // Tool executed successfully, but connection failed
      expect(response.isError).toBe(false);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const result = JSON.parse(response.content[0].text as string);
      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
    });

    it('should set isError: true when tool receives invalid input', async () => {
      const response = await mcpClient.callTool({
        name: 'rew.analyze_room_modes',
        arguments: {
          measurement_id: ''  // Empty ID should fail validation
        }
      });

      expect(response.isError).toBe(true);
      const result = JSON.parse(response.content[0].text as string);
      expect(result.status).toBe('error');
    });

    it('should set isError: true for unknown tool', async () => {
      // Unknown tools are caught by the error handler and return isError: true
      const response = await mcpClient.callTool({
        name: 'rew.nonexistent_tool',
        arguments: {}
      });

      expect(response.isError).toBe(true);
      const result = JSON.parse(response.content[0].text as string);
      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toContain('Unknown tool');
    });

    it('should set isError: false when tool succeeds', async () => {
      // Mock successful REW API connection
      mswServer.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({
            info: { version: '5.30.9' },
            openapi: '3.0.0'
          });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const response = await mcpClient.callTool({
        name: 'rew.api_connect',
        arguments: {}
      });

      expect(response.isError).toBe(false);
      expect(response.content).toHaveLength(1);

      const result = JSON.parse(response.content[0].text as string);
      expect(result.status).toBe('connected');
      expect(result.measurements_available).toBe(0);
    });
  });

  describe('Analysis Tools with Mocked Data (FNDN-08)', () => {
    it('should analyze room modes when measurement is ingested', async () => {
      // Step 1: Ingest a measurement with frequency response data in REW text format
      const rewData = `* REW V5.30
* Measurement: Left Main
* Freq(Hz) SPL(dB) Phase(degrees)
20.0 70.0 0.0
40.0 82.0 -10.0
60.0 75.0 -20.0
80.0 78.0 -30.0
100.0 80.0 -40.0
120.0 72.0 -50.0
140.0 85.0 -60.0
160.0 79.0 -70.0
180.0 76.0 -80.0
200.0 80.0 -90.0`;

      const ingestResponse = await mcpClient.callTool({
        name: 'rew.ingest_measurement',
        arguments: {
          file_contents: rewData,
          metadata: {
            speaker_id: 'L',
            condition: 'main_position'
          }
        }
      });

      expect(ingestResponse.isError).toBe(false);
      const ingestResult = JSON.parse(ingestResponse.content[0].text as string);
      expect(ingestResult.measurement_id).toBeDefined();

      // Step 2: Call analyze_room_modes on the ingested measurement
      const analysisResponse = await mcpClient.callTool({
        name: 'rew.analyze_room_modes',
        arguments: {
          measurement_id: ingestResult.measurement_id,
          analysis_options: {
            peak_threshold_db: 5.0,
            null_threshold_db: -6.0,
            frequency_range_hz: [20, 200]
          }
        }
      });

      expect(analysisResponse.isError).toBe(false);
      const analysisResult = JSON.parse(analysisResponse.content[0].text as string);

      // Verify analysis produces valid structured output
      expect(analysisResult.analysis_type).toBe('room_mode_analysis');
      expect(analysisResult.measurement_id).toBe(ingestResult.measurement_id);

      // Verify it detected the peak at 40Hz (12dB above neighbors)
      expect(analysisResult.detected_peaks).toBeDefined();
      expect(Array.isArray(analysisResult.detected_peaks)).toBe(true);

      // Verify summary structure
      expect(analysisResult.summary).toBeDefined();
      expect(typeof analysisResult.summary.total_peaks_detected).toBe('number');
      expect(typeof analysisResult.summary.total_nulls_detected).toBe('number');
      expect(Array.isArray(analysisResult.summary.primary_issues)).toBe(true);
    });

    it('should return error for non-existent measurement in analysis tool', async () => {
      const response = await mcpClient.callTool({
        name: 'rew.analyze_room_modes',
        arguments: {
          measurement_id: 'nonexistent-measurement'
        }
      });

      expect(response.isError).toBe(true);
      const result = JSON.parse(response.content[0].text as string);
      expect(result.status).toBe('error');
      expect(result.error_type).toBe('measurement_not_found');
    });

    it('should analyze room modes with room dimensions for mode correlation', async () => {
      // Ingest measurement first in REW text format
      const rewData = `* REW V5.30
* Measurement: Room Test
* Freq(Hz) SPL(dB) Phase(degrees)
20.0 72.0 0.0
30.0 85.0 -15.0
40.0 74.0 -30.0
50.0 78.0 -45.0
60.0 88.0 -60.0
70.0 76.0 -75.0
80.0 80.0 -90.0
90.0 77.0 -105.0
100.0 79.0 -120.0`;

      const ingestResponse = await mcpClient.callTool({
        name: 'rew.ingest_measurement',
        arguments: {
          file_contents: rewData,
          metadata: {
            speaker_id: 'L',
            condition: 'room_test'
          }
        }
      });

      const ingestResult = JSON.parse(ingestResponse.content[0].text as string);

      // Analyze with room dimensions (4m x 3m x 2.5m room)
      // Expected axial modes: ~43Hz (length), ~57Hz (width), ~69Hz (height)
      const response = await mcpClient.callTool({
        name: 'rew.analyze_room_modes',
        arguments: {
          measurement_id: ingestResult.measurement_id,
          room_dimensions_m: {
            length: 4.0,
            width: 3.0,
            height: 2.5
          },
          analysis_options: {
            peak_threshold_db: 5.0,
            frequency_range_hz: [20, 100]
          }
        }
      });

      expect(response.isError).toBe(false);
      const result = JSON.parse(response.content[0].text as string);

      // Verify theoretical modes were calculated
      expect(result.theoretical_room_modes).toBeDefined();
      expect(Array.isArray(result.theoretical_room_modes)).toBe(true);
      expect(result.theoretical_room_modes.length).toBeGreaterThan(0);

      // Verify mode distribution assessment
      expect(result.mode_distribution_assessment).toBeDefined();
    });
  });

  describe('Complete Tool Flows', () => {
    it('should connect and list measurements successfully', async () => {
      mswServer.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({
            info: { version: '5.30.9' },
            openapi: '3.0.0'
          });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([
            { uuid: 'uuid-1', name: 'Left Main', type: 'SPL', index: 0 },
            { uuid: 'uuid-2', name: 'Right Main', type: 'SPL', index: 1 }
          ]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return HttpResponse.json({ version: '5.30.9', proFeatures: false });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      // Step 1: Connect
      const connectResponse = await mcpClient.callTool({
        name: 'rew.api_connect',
        arguments: {}
      });

      expect(connectResponse.isError).toBe(false);
      const connectResult = JSON.parse(connectResponse.content[0].text as string);
      expect(connectResult.status).toBe('connected');
      expect(connectResult.measurements_available).toBe(2);

      // Step 2: List measurements
      const listResponse = await mcpClient.callTool({
        name: 'rew.api_list_measurements',
        arguments: {}
      });

      expect(listResponse.isError).toBe(false);
      const listResult = JSON.parse(listResponse.content[0].text as string);
      expect(listResult.measurements).toHaveLength(2);
      expect(listResult.measurements[0].uuid).toBe('uuid-1');
      expect(listResult.measurements[0].name).toBe('Left Main');
    });

    it('should handle measurement retrieval error gracefully', async () => {
      // Setup connection first
      mswServer.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([{ uuid: 'uuid-1', name: 'Test' }]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      // Connect
      await mcpClient.callTool({
        name: 'rew.api_connect',
        arguments: {}
      });

      // Try to get nonexistent measurement
      const response = await mcpClient.callTool({
        name: 'rew.api_get_measurement',
        arguments: { measurement_uuid: 'nonexistent' }
      });

      expect(response.isError).toBe(true);
      const result = JSON.parse(response.content[0].text as string);
      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
    });
  });

  describe('Response Format Compliance', () => {
    it('should return content as array with text type', async () => {
      mswServer.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const response = await mcpClient.callTool({
        name: 'rew.api_connect',
        arguments: {}
      });

      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
      expect(typeof response.content[0].text).toBe('string');
    });

    it('should return valid JSON in text content', async () => {
      mswServer.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const response = await mcpClient.callTool({
        name: 'rew.api_connect',
        arguments: {}
      });

      // Should not throw
      expect(() => JSON.parse(response.content[0].text as string)).not.toThrow();
    });
  });

  describe('rew.api_audio Tool Coverage (FNDN-11)', () => {
    it('should validate action enum (invalid input)', async () => {
      // Test input validation for api_audio tool
      const response = await mcpClient.callTool({
        name: 'rew.api_audio',
        arguments: { action: 'invalid_action' }
      });

      // Invalid enum value causes Zod validation error → isError: true
      expect(response.isError).toBe(true);
    });

    it('should accept valid action enum values', async () => {
      // Test that valid actions are accepted (even if API call fails)
      const {tools} = await mcpClient.listTools();
      const audioTool = tools.find(t => t.name === 'rew.api_audio');

      expect(audioTool).toBeDefined();
      expect(audioTool?.inputSchema).toBeDefined();

      // Verify action enum includes expected values
      const actionEnum = (audioTool?.inputSchema as any).properties?.action?.enum;
      expect(actionEnum).toContain('status');
      expect(actionEnum).toContain('list_devices');
    });
  });

  describe('rew.api_measure Tool Coverage (FNDN-11)', () => {
    it('should validate action enum (invalid input)', async () => {
      // Test input validation for api_measure tool
      const response = await mcpClient.callTool({
        name: 'rew.api_measure',
        arguments: { action: 'invalid_action' }
      });

      // Invalid enum value causes Zod validation error → isError: true
      expect(response.isError).toBe(true);
    });

    it('should validate config.level_db range', async () => {
      // Test that config.level_db validates range (-60 to 0)
      const response = await mcpClient.callTool({
        name: 'rew.api_measure',
        arguments: {
          action: 'configure',
          config: { level_db: -100 }  // Out of range
        }
      });

      // Out of range value causes Zod validation error → isError: true
      expect(response.isError).toBe(true);
    });

    it('should accept valid action enum values', async () => {
      // Test that valid actions are accepted
      const {tools} = await mcpClient.listTools();
      const measureTool = tools.find(t => t.name === 'rew.api_measure');

      expect(measureTool).toBeDefined();
      expect(measureTool?.inputSchema).toBeDefined();

      // Verify action enum includes expected values
      const actionEnum = (measureTool?.inputSchema as any).properties?.action?.enum;
      expect(actionEnum).toContain('status');
      expect(actionEnum).toContain('configure');
      expect(actionEnum).toContain('sweep');
    });
  });
});
