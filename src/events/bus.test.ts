/**
 * Unit tests for the TUI Event Bus singleton.
 *
 * Covers: emit/receive, timestamp envelope, multiple listeners,
 * off() removal, onAny() wildcard, and singleton identity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tuiEventBus, resetEventBus } from './bus.js';
import type { TuiEvent, HealthHeartbeatPayload, WorkflowSessionStartedPayload } from './types.js';

describe('TuiEventBus', () => {
  beforeEach(() => {
    resetEventBus();
  });

  describe('emit and receive typed events', () => {
    it('should deliver a typed event to a registered listener', () => {
      const received: TuiEvent<HealthHeartbeatPayload>[] = [];

      tuiEventBus.on('health:heartbeat', (evt) => {
        received.push(evt);
      });

      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: true,
        latency_ms: 42,
      });

      expect(received).toHaveLength(1);
      expect(received[0].payload.server_responding).toBe(true);
      expect(received[0].payload.latency_ms).toBe(42);
    });

    it('should not deliver events of a different type', () => {
      const received: unknown[] = [];

      tuiEventBus.on('health:heartbeat', (evt) => {
        received.push(evt);
      });

      tuiEventBus.emit('workflow:session_started', {
        session_id: 'abc',
        created_at: Date.now(),
      });

      expect(received).toHaveLength(0);
    });
  });

  describe('timestamp inclusion', () => {
    it('should wrap payload in TuiEvent envelope with timestamp', () => {
      let captured: TuiEvent<WorkflowSessionStartedPayload> | undefined;

      tuiEventBus.on('workflow:session_started', (evt) => {
        captured = evt;
      });

      const beforeEmit = Date.now();
      tuiEventBus.emit('workflow:session_started', {
        session_id: 'sess-1',
        created_at: 1000,
      });
      const afterEmit = Date.now();

      expect(captured).toBeDefined();
      expect(captured!.type).toBe('workflow:session_started');
      expect(captured!.timestamp).toBeGreaterThanOrEqual(beforeEmit);
      expect(captured!.timestamp).toBeLessThanOrEqual(afterEmit);
      expect(captured!.payload.session_id).toBe('sess-1');
    });
  });

  describe('multiple listeners', () => {
    it('should dispatch to all registered listeners for the same type', () => {
      const calls: number[] = [];

      tuiEventBus.on('health:heartbeat', () => calls.push(1));
      tuiEventBus.on('health:heartbeat', () => calls.push(2));
      tuiEventBus.on('health:heartbeat', () => calls.push(3));

      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: false,
        latency_ms: 10,
      });

      expect(calls).toEqual([1, 2, 3]);
    });
  });

  describe('off() — remove listener', () => {
    it('should stop delivering events after off() is called', () => {
      const received: unknown[] = [];
      const handler = (evt: TuiEvent<HealthHeartbeatPayload>) => {
        received.push(evt);
      };

      tuiEventBus.on('health:heartbeat', handler);
      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: true,
        latency_ms: 1,
      });
      expect(received).toHaveLength(1);

      tuiEventBus.off('health:heartbeat', handler);
      tuiEventBus.emit('health:heartbeat', {
        server_responding: false,
        openapi_available: false,
        latency_ms: 2,
      });
      expect(received).toHaveLength(1); // no new delivery
    });

    it('should not throw when removing a handler that was never registered', () => {
      const handler = () => {};
      expect(() => tuiEventBus.off('health:heartbeat', handler)).not.toThrow();
    });
  });

  describe('onAny() — wildcard listener', () => {
    it('should receive events of any type', () => {
      const received: string[] = [];

      tuiEventBus.onAny((evt) => {
        received.push(evt.type);
      });

      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: true,
        latency_ms: 5,
      });

      tuiEventBus.emit('workflow:session_started', {
        session_id: 'x',
        created_at: Date.now(),
      });

      expect(received).toEqual(['health:heartbeat', 'workflow:session_started']);
    });

    it('should stop receiving after offAny()', () => {
      const received: string[] = [];
      const handler = (evt: TuiEvent<unknown>) => {
        received.push(evt.type);
      };

      tuiEventBus.onAny(handler);
      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: true,
        latency_ms: 1,
      });
      expect(received).toHaveLength(1);

      tuiEventBus.offAny(handler);
      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: true,
        latency_ms: 2,
      });
      expect(received).toHaveLength(1);
    });
  });

  describe('singleton identity', () => {
    it('should return the same instance across imports', async () => {
      // Re-import to verify singleton behavior
      const { tuiEventBus: bus2 } = await import('./bus.js');
      expect(bus2).toBe(tuiEventBus);
    });
  });

  describe('reset()', () => {
    it('should clear all type-specific and wildcard listeners', () => {
      const received: unknown[] = [];

      tuiEventBus.on('health:heartbeat', () => received.push('typed'));
      tuiEventBus.onAny(() => received.push('any'));

      tuiEventBus.reset();

      tuiEventBus.emit('health:heartbeat', {
        server_responding: true,
        openapi_available: true,
        latency_ms: 1,
      });

      expect(received).toHaveLength(0);
    });
  });
});
