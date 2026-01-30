/**
 * Session Resource Handler
 *
 * Provides read access to session state via MCP Resources.
 * URI scheme: session://{session_id}
 */
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
export declare function readSessionResource(sessionId: string): SessionResourceData;
/**
 * List all active session resources for dynamic resource list
 *
 * @returns Array of resource descriptors for active sessions
 */
export declare function listSessionResources(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}>;
//# sourceMappingURL=session-resource.d.ts.map