#!/usr/bin/env node

/**
 * REW MCP Server
 * 
 * Model Context Protocol server for Room EQ Wizard measurement analysis.
 * 
 * Entry point: Sets up the MCP server and connects via stdio transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

/**
 * Create and start the MCP server
 */
async function main() {
  // Create server instance
  const server = new Server(
    {
      name: 'rew-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {}
      }
    }
  );

  // Register all tools
  registerTools(server);

  // Log server start
  server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('REW MCP Server running on stdio');
}

// Start the server
main().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
