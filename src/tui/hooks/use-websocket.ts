/**
 * WebSocket connection hook for the TUI client.
 *
 * Connects to the TUI event bridge, parses incoming JSON as TuiEvent,
 * and handles reconnection with exponential backoff.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import WebSocket from 'ws';
import type { TuiEvent } from '../../events/types.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketOptions {
  host: string;
  port: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onEvent?: (event: TuiEvent<unknown>) => void;
}

export interface UseWebSocketResult {
  status: ConnectionStatus;
  lastEvent: TuiEvent<unknown> | null;
  error: string | null;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketResult {
  const {
    host,
    port,
    reconnectInterval = 2000,
    maxReconnectAttempts = 10,
    onEvent,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<TuiEvent<unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onEventRef = useRef(onEvent);

  // Keep callback ref current without triggering reconnects.
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const url = `ws://${host}:${port}`;
    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.on('open', () => {
      if (!mountedRef.current) return;
      attemptRef.current = 0;
      setStatus('connected');
      setError(null);
    });

    ws.on('message', (data: WebSocket.Data) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(data.toString()) as TuiEvent<unknown>;
        setLastEvent(parsed);
        onEventRef.current?.(parsed);
      } catch {
        // Ignore malformed messages.
      }
    });

    ws.on('close', () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setStatus('disconnected');

      if (attemptRef.current < maxReconnectAttempts) {
        const delay = reconnectInterval * Math.pow(2, attemptRef.current);
        attemptRef.current += 1;
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    });

    ws.on('error', (err: Error) => {
      if (!mountedRef.current) return;
      setError(err.message);
      setStatus('error');
      // 'close' will fire after 'error', triggering reconnect logic.
    });
  }, [host, port, reconnectInterval, maxReconnectAttempts]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.removeAllListeners();
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { status, lastEvent, error };
}
