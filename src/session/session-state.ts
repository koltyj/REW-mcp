/**
 * Session State Management
 *
 * Provides concurrent session isolation and persistence across tool calls
 * for measurement workflow orchestration.
 */

import { randomUUID } from 'crypto';

/**
 * Individual measurement within a session
 */
export interface SessionMeasurement {
  uuid?: string;              // REW measurement UUID, assigned after measurement
  name: string;               // Auto-generated name (e.g., "Left Speaker")
  channel: 'left' | 'right' | 'sub';
  timestamp: number;          // Unix timestamp (ms)
}

/**
 * Session state for measurement workflow
 */
export interface SessionState {
  session_id: string;                   // UUID
  created_at: number;                   // Unix timestamp (ms)
  sequence_step: 'idle' | 'measuring_left' | 'measuring_right' | 'measuring_sub' | 'complete';
  measurements: SessionMeasurement[];
  target_spl?: number;                  // Optional, from calibration (dB SPL)
  notes?: string;                       // User description
}

/**
 * Module-level Map storage for active sessions
 */
const activeSessions = new Map<string, SessionState>();

/**
 * Create a new measurement session
 *
 * @param notes - Optional user description of the session
 * @returns Newly created session state
 */
export function createSession(notes?: string): SessionState {
  const session: SessionState = {
    session_id: randomUUID(),
    created_at: Date.now(),
    sequence_step: 'idle',
    measurements: [],
    notes
  };

  activeSessions.set(session.session_id, session);
  return session;
}

/**
 * Retrieve an active session by ID
 *
 * @param sessionId - Session UUID
 * @returns Session state
 * @throws Error if session not found
 */
export function getSession(sessionId: string): SessionState {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(
      `Session not found: ${sessionId}. Use get_status tool to list active sessions.`
    );
  }
  return session;
}

/**
 * Update an existing session with partial updates
 *
 * @param sessionId - Session UUID
 * @param updates - Partial session state to merge
 * @returns Updated session state
 * @throws Error if session not found
 */
export function updateSession(
  sessionId: string,
  updates: Partial<SessionState>
): SessionState {
  const existing = getSession(sessionId);

  // Clone to avoid mutation
  const updated: SessionState = {
    ...existing,
    ...updates,
    // Preserve session_id and created_at
    session_id: existing.session_id,
    created_at: existing.created_at,
    // Deep clone measurements array if provided
    measurements: updates.measurements
      ? [...updates.measurements]
      : existing.measurements
  };

  activeSessions.set(sessionId, updated);
  return updated;
}

/**
 * List all active sessions
 *
 * @returns Array of session states, sorted by created_at descending (most recent first)
 */
export function listActiveSessions(): SessionState[] {
  const sessions = Array.from(activeSessions.values());
  return sessions.sort((a, b) => b.created_at - a.created_at);
}

/**
 * End a session and remove from active sessions
 *
 * @param sessionId - Session UUID
 */
export function endSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}
