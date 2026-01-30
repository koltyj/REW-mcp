/**
 * Recommendations Resource Handler
 *
 * Provides read access to session recommendations via MCP Resources.
 * URI scheme: recommendations://{session_id}
 */
/**
 * Recommendations resource data format
 */
export interface RecommendationsResourceData {
    session_id: string;
    current_recommendation: null;
    tried_recommendations: [];
    validation_status: null;
}
/**
 * Read recommendations for a session
 *
 * Note: Full recommendation tracking would require extending session state.
 * This returns a placeholder structure for the resource protocol.
 *
 * @param sessionId - Session UUID
 * @returns Recommendations placeholder structure
 * @throws Error with code -32002 if session not found
 */
export declare function readRecommendationsResource(sessionId: string): RecommendationsResourceData;
//# sourceMappingURL=recommendations-resource.d.ts.map