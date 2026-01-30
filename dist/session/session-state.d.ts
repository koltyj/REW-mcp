/**
 * Session State Management
 *
 * Provides concurrent session isolation and persistence across tool calls
 * for measurement workflow orchestration.
 */
/**
 * Individual measurement within a session
 */
export interface SessionMeasurement {
    uuid?: string;
    name: string;
    channel: 'left' | 'right' | 'sub';
    timestamp: number;
}
/**
 * Session state for measurement workflow
 */
export interface SessionState {
    session_id: string;
    created_at: number;
    sequence_step: 'idle' | 'measuring_left' | 'measuring_right' | 'measuring_sub' | 'complete';
    measurements: SessionMeasurement[];
    target_spl?: number;
    notes?: string;
}
/**
 * Create a new measurement session
 *
 * @param notes - Optional user description of the session
 * @returns Newly created session state
 */
export declare function createSession(notes?: string): SessionState;
/**
 * Retrieve an active session by ID
 *
 * @param sessionId - Session UUID
 * @returns Session state
 * @throws Error if session not found
 */
export declare function getSession(sessionId: string): SessionState;
/**
 * Update an existing session with partial updates
 *
 * @param sessionId - Session UUID
 * @param updates - Partial session state to merge
 * @returns Updated session state
 * @throws Error if session not found
 */
export declare function updateSession(sessionId: string, updates: Partial<SessionState>): SessionState;
/**
 * List all active sessions
 *
 * @returns Array of session states, sorted by created_at descending (most recent first)
 */
export declare function listActiveSessions(): SessionState[];
/**
 * End a session and remove from active sessions
 *
 * @param sessionId - Session UUID
 */
export declare function endSession(sessionId: string): void;
/**
 * Clear all active sessions (for testing)
 */
export declare function clearAllSessions(): void;
//# sourceMappingURL=session-state.d.ts.map