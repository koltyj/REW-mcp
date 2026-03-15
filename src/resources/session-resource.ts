/**
 * Session Resource Handler
 *
 * Provides read access to session state via MCP Resources.
 * URI scheme: session://{session_id}
 */

import { getSession, listActiveSessions, type SessionState } from '../session/index.js';

/**
 * Session resource data format (without full FR data)
 */
export interface SessionResourceData {
  session_id: string;
  created_at: number;
  sequence_step: string;
  measurements: Array<{
    uuid?: string;
    name: string;
    channel: 'left' | 'right' | 'sub';
    timestamp: number;
  }>;
  target_spl?: number;
  notes?: string;
}

/**
 * Read session state for resource
 *
 * @param sessionId - Session UUID
 * @returns Session state with measurement summaries (not full FR data)
 * @throws Error with code -32002 if session not found
 */
export function readSessionResource(sessionId: string): SessionResourceData {
  let session: SessionState;
  try {
    session = getSession(sessionId);
  } catch {
    const error = new Error(`Session not found: ${sessionId}`);
    (error as any).code = -32002;
    throw error;
  }

  return {
    session_id: session.session_id,
    created_at: session.created_at,
    sequence_step: session.sequence_step,
    measurements: session.measurements.map((m) => ({
      uuid: m.uuid,
      name: m.name,
      channel: m.channel,
      timestamp: m.timestamp,
    })),
    target_spl: session.target_spl,
    notes: session.notes,
  };
}

/**
 * List all active session resources for dynamic resource list
 *
 * @returns Array of resource descriptors for active sessions
 */
export function listSessionResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  const sessions = listActiveSessions();
  return sessions.map((session) => ({
    uri: `session://${session.session_id}`,
    name: `Session ${session.session_id.substring(0, 8)}`,
    description: `Measurement session created at ${new Date(session.created_at).toISOString()}, step: ${session.sequence_step}`,
    mimeType: 'application/json',
  }));
}
