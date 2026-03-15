#!/usr/bin/env node

/**
 * TUI entry point.
 *
 * Parses CLI arguments (--host, --port, --help) and renders the
 * App component using ink.
 */

import { render } from 'ink';
import { App } from './app.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { host: string; port: number; help: boolean } {
  let host = 'localhost';
  let port = 52380;
  let help = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--host' && i + 1 < argv.length) {
      host = argv[++i]!;
    } else if (arg?.startsWith('--host=')) {
      host = arg.slice('--host='.length);
    } else if (arg === '--port' && i + 1 < argv.length) {
      port = Number(argv[++i]);
    } else if (arg?.startsWith('--port=')) {
      port = Number(arg.slice('--port='.length));
    }
  }

  return { host, port, help };
}

const { host, port, help } = parseArgs(process.argv);

if (help) {
  const usage = `
rew-mcp-tui - REW MCP TUI Dashboard

Usage:
  rew-mcp-tui [options]

Options:
  --host <host>   WebSocket host (default: localhost)
  --port <port>   WebSocket port (default: 52380)
  --help, -h      Show this help message
`;
  process.stdout.write(usage);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const instance = render(<App host={host} port={port} />);

void instance.waitUntilExit();
