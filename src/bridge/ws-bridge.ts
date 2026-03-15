/**
 * WebSocket Bridge
 *
 * Bridges the internal TUI event bus to external WebSocket clients.
 * Starts a ws server, forwards all bus events as JSON, maintains a
 * last-known-state cache, and runs periodic health-check heartbeats.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { tuiEventBus } from '../events/index.js';
import { getActiveApiClient } from '../tools/api-connect.js';
import type { TuiEvent, TuiEventMap, TuiEventType } from '../events/types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BridgeOptions {
  port?: number;
  host?: string;
  heartbeatIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let wss: WebSocketServer | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let busHandler: ((event: TuiEvent<TuiEventMap[TuiEventType]>) => void) | null = null;

/**
 * Cache of the latest event per event type.
 * Sent as a snapshot to newly connecting clients.
 */
const lastKnownState = new Map<string, TuiEvent<unknown>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastToClients(data: unknown): void {
  if (!wss) return;
  const json = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

function sendSnapshot(client: WebSocket): void {
  if (lastKnownState.size === 0) return;

  const snapshot: Record<string, TuiEvent<unknown>> = {};
  for (const [key, value] of lastKnownState) {
    snapshot[key] = value;
  }

  client.send(JSON.stringify({
    type: 'snapshot',
    timestamp: Date.now(),
    payload: snapshot,
  }));
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

async function runHeartbeat(): Promise<void> {
  const client = getActiveApiClient();
  if (!client) return;

  const start = Date.now();
  try {
    const result = await client.healthCheck();
    const latencyMs = Date.now() - start;

    const event: TuiEvent<TuiEventMap['health:heartbeat']> = {
      type: 'health:heartbeat',
      timestamp: Date.now(),
      payload: {
        server_responding: result.server_responding,
        openapi_available: result.openapi_available,
        api_version: result.api_version,
        error: result.error,
        suggestion: result.suggestion,
        latency_ms: latencyMs,
      },
    };

    lastKnownState.set('health:heartbeat', event);
    broadcastToClients(event);
    // Also emit on the bus so other local consumers get it
    tuiEventBus.emit('health:heartbeat', event.payload);
  } catch {
    // Silently swallow — next heartbeat will try again
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the WebSocket bridge.
 *
 * Listens for all events on the TUI event bus and forwards them as JSON
 * to connected WebSocket clients. Sends a snapshot of cached state to
 * each new client. Runs a periodic health-check heartbeat.
 */
export function startBridge(options: BridgeOptions = {}): Promise<void> {
  const port = options.port ?? parseInt(process.env.REW_TUI_PORT ?? '52380', 10);
  const host = options.host ?? '127.0.0.1';
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;

  return new Promise<void>((resolve, reject) => {
    if (wss) {
      resolve();
      return;
    }

    wss = new WebSocketServer({ port, host });

    wss.on('error', (err) => {
      reject(err);
    });

    wss.on('listening', () => {
      // Subscribe to all bus events
      busHandler = (event: TuiEvent<TuiEventMap[TuiEventType]>) => {
        lastKnownState.set(event.type, event as TuiEvent<unknown>);
        broadcastToClients(event);
      };
      tuiEventBus.onAny(busHandler);

      // Start heartbeat polling
      heartbeatTimer = setInterval(() => {
        void runHeartbeat();
      }, heartbeatIntervalMs);

      resolve();
    });

    // Send snapshot to new clients
    wss.on('connection', (client) => {
      sendSnapshot(client);
    });
  });
}

/**
 * Stop the WebSocket bridge.
 *
 * Clears the heartbeat timer, unsubscribes from the bus, closes all
 * client connections, and shuts down the server.
 */
export function stopBridge(): Promise<void> {
  return new Promise<void>((resolve) => {
    // Clear heartbeat
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    // Unsubscribe from bus
    if (busHandler) {
      tuiEventBus.offAny(busHandler);
      busHandler = null;
    }

    // Clear cached state
    lastKnownState.clear();

    // Close server and all clients
    if (wss) {
      for (const client of wss.clients) {
        client.close();
      }
      wss.close(() => {
        wss = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
