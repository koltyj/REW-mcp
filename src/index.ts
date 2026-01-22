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
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

/**
 * Create and start the MCP server
 */
async function main() {
  // Create server instance
  // Per MCP spec 2025-06-18: capabilities should declare specific options
  const server = new Server(
    {
      name: 'rew-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {
          listChanged: true  // Indicate tool list can change dynamically
        },
        prompts: {
          listChanged: true
        },
        resources: {
          subscribe: true,
          listChanged: true
        },
        logging: {}
      }
    }
  );

  // Register all tools
  registerTools(server);

  // Register all resources
  registerResources(server);

  // Register all prompts
  registerPrompts(server);

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
