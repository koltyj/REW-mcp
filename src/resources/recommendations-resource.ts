/**
 * Recommendations Resource Handler
 *
 * Provides read access to session recommendations via MCP Resources.
 * URI scheme: recommendations://{session_id}
 */

import { getSession, type SessionState } from '../session/index.js';

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
export function readRecommendationsResource(sessionId: string): RecommendationsResourceData {
  let session: SessionState;
  try {
    session = getSession(sessionId);
  } catch (e) {
    const error = new Error(`Session not found: ${sessionId}`);
    (error as any).code = -32002;
    throw error;
  }

  // Placeholder structure - full recommendation tracking is out of scope
  return {
    session_id: session.session_id,
    current_recommendation: null,
    tried_recommendations: [],
    validation_status: null,
  };
}
