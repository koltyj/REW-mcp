/**
 * Unit tests for the WebSocket bridge.
 *
 * Covers: start/accept connections, event forwarding, snapshot on connect,
 * multiple clients, and clean shutdown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { startBridge, stopBridge } from './ws-bridge.js';
import { tuiEventBus, resetEventBus } from '../events/index.js';

const TEST_PORT = 52399;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;

/** Open a WS client and wait for the connection to be established. */
function openClient(skip?: () => never): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' && skip) {
        skip();
      }
      reject(error);
    });
  });
}

/** Read the next JSON message from a WS client. */
function nextMessage(ws: WebSocket, timeoutMs = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      ws.off('message', handleMessage);
      ws.off('error', handleError);
      ws.off('close', handleClose);
    };
    const handleMessage = (data: WebSocket.RawData): void => {
      cleanup();
      resolve(JSON.parse(data.toString()));
    };
    const handleError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const handleClose = (): void => {
      cleanup();
      reject(new Error('socket closed before message'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout waiting for WS message'));
    }, timeoutMs);
    ws.once('message', handleMessage);
    ws.once('error', handleError);
    ws.once('close', handleClose);
  });
}

async function startBridgeOrSkip(skip: () => never): Promise<void> {
  try {
    await startBridge({ port: TEST_PORT });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      skip();
    }
    throw error;
  }
}

describe('WebSocket Bridge', () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(async () => {
    await stopBridge();
  });

  // ---------- 1. Start and accept connections ----------

  it('should start and accept a WebSocket connection', async ({ skip }) => {
    await startBridgeOrSkip(skip);
    const ws = await openClient(skip);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // ---------- 2. Forward bus events to connected clients ----------

  it('should forward bus events to connected clients', async ({ skip }) => {
    await startBridgeOrSkip(skip);
    const ws = await openClient(skip);

    const msgPromise = nextMessage(ws);

    tuiEventBus.emit('health:heartbeat', {
      server_responding: true,
      openapi_available: true,
      latency_ms: 7,
    });

    const msg = (await msgPromise) as { type: string; payload: { latency_ms: number } };
    expect(msg.type).toBe('health:heartbeat');
    expect(msg.payload.latency_ms).toBe(7);

    ws.close();
  });

  // ---------- 3. Snapshot on initial connection ----------

  it('should send a snapshot to a newly connected client', async ({ skip }) => {
    await startBridgeOrSkip(skip);

    // Emit an event before any client connects — it gets cached
    tuiEventBus.emit('workflow:session_started', {
      session_id: 'snap-1',
      created_at: 1000,
    });

    // Small delay to let internal caching settle
    await new Promise((r) => setTimeout(r, 50));

    // Register the message listener eagerly — before the open event fires —
    // because the server sends the snapshot as soon as the WS handshake
    // completes, which races with the client-side 'open' event.
    const { ws, firstMessage } = await new Promise<{
      ws: WebSocket;
      firstMessage: Promise<unknown>;
    }>((resolve, reject) => {
      const client = new WebSocket(WS_URL);
      const msgPromise = nextMessage(client);
      client.on('open', () => resolve({ ws: client, firstMessage: msgPromise }));
      client.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          void msgPromise.catch(() => {});
          skip();
        }
        reject(error);
      });
    });

    const msg = (await firstMessage) as {
      type: string;
      payload: Record<string, { type: string; payload: { session_id: string } }>;
    };

    expect(msg.type).toBe('snapshot');
    expect(msg.payload['workflow:session_started']).toBeDefined();
    expect(msg.payload['workflow:session_started'].payload.session_id).toBe('snap-1');

    ws.close();
  });

  // ---------- 4. Multiple clients receive same event ----------

  it('should forward events to all connected clients', async ({ skip }) => {
    await startBridgeOrSkip(skip);

    const ws1 = await openClient(skip);
    const ws2 = await openClient(skip);

    const p1 = nextMessage(ws1);
    const p2 = nextMessage(ws2);

    tuiEventBus.emit('health:api_error', {
      code: 'TIMEOUT',
      httpStatus: 408,
      message: 'timed out',
    });

    const [m1, m2] = (await Promise.all([p1, p2])) as Array<{ type: string }>;
    expect(m1.type).toBe('health:api_error');
    expect(m2.type).toBe('health:api_error');

    ws1.close();
    ws2.close();
  });

  // ---------- 5. Clean stop ----------

  it('should not accept connections after stopBridge()', async ({ skip }) => {
    await startBridgeOrSkip(skip);
    await stopBridge();

    await expect(openClient(skip)).rejects.toThrow();
  });
});
