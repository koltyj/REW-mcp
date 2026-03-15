/**
 * Typed Event Bus Singleton
 *
 * Provides a strongly-typed publish/subscribe system for TUI events.
 * All event payloads are wrapped in a TuiEvent envelope with a timestamp
 * before dispatch.
 */

import type { TuiEvent, TuiEventMap, TuiEventType } from './types.js';

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

type TypedHandler<T extends TuiEventType> = (event: TuiEvent<TuiEventMap[T]>) => void;
type AnyHandler = (event: TuiEvent<TuiEventMap[TuiEventType]>) => void;

// ---------------------------------------------------------------------------
// Event Bus class
// ---------------------------------------------------------------------------

class TuiEventBus {
  private listeners = new Map<TuiEventType, Set<TypedHandler<TuiEventType>>>();
  private anyListeners = new Set<AnyHandler>();

  /**
   * Emit a typed event. Wraps the payload in a TuiEvent envelope
   * with a timestamp, then dispatches to type-specific and wildcard listeners.
   */
  emit<T extends TuiEventType>(type: T, payload: TuiEventMap[T]): void {
    const event: TuiEvent<TuiEventMap[T]> = {
      type,
      timestamp: Date.now(),
      payload,
    };

    // Dispatch to type-specific listeners
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const handler of typeListeners) {
        (handler as TypedHandler<T>)(event);
      }
    }

    // Dispatch to wildcard listeners
    for (const handler of this.anyListeners) {
      handler(event as TuiEvent<TuiEventMap[TuiEventType]>);
    }
  }

  /**
   * Register a listener for a specific event type.
   */
  on<T extends TuiEventType>(type: T, handler: TypedHandler<T>): void {
    let typeListeners = this.listeners.get(type);
    if (!typeListeners) {
      typeListeners = new Set();
      this.listeners.set(type, typeListeners);
    }
    typeListeners.add(handler as TypedHandler<TuiEventType>);
  }

  /**
   * Remove a listener for a specific event type.
   */
  off<T extends TuiEventType>(type: T, handler: TypedHandler<T>): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(handler as TypedHandler<TuiEventType>);
      if (typeListeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  /**
   * Register a wildcard listener that receives all events.
   */
  onAny(handler: AnyHandler): void {
    this.anyListeners.add(handler);
  }

  /**
   * Remove a wildcard listener.
   */
  offAny(handler: AnyHandler): void {
    this.anyListeners.delete(handler);
  }

  /**
   * Clear all listeners. Intended for testing teardown.
   */
  reset(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton + reset helper
// ---------------------------------------------------------------------------

export const tuiEventBus = new TuiEventBus();

/**
 * Reset the singleton event bus (clears all listeners).
 * Convenience helper for test teardown.
 */
export function resetEventBus(): void {
  tuiEventBus.reset();
}
