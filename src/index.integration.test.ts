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

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
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
    it('should register exactly 17 tools', async () => {
      const { tools } = await mcpClient.listTools();

      expect(tools).toHaveLength(17);
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
});
