/**
 * History Resource Handler
 *
 * Provides read access to measurement history for a session via MCP Resources.
 * URI scheme: history://{session_id}
 */
/**
 * Measurement summary in history
 */
export interface MeasurementSummary {
    measurement_id?: string;
    channel: 'left' | 'right' | 'sub';
    timestamp: number;
    summary: {
        variance_40_200hz?: number;
        peak_spl_db?: number;
        frequency_range?: [number, number];
    };
}
/**
 * History resource data format
 */
export interface HistoryResourceData {
    session_id: string;
    measurements: MeasurementSummary[];
}
/**
 * Read measurement history for a session
 *
 * @param sessionId - Session UUID
 * @returns Measurement history with summaries
 * @throws Error with code -32002 if session not found
 */
export declare function readHistoryResource(sessionId: string): HistoryResourceData;
//# sourceMappingURL=history-resource.d.ts.map