/**
 * Optimization Module
 *
 * Exports placement recommendation types and generation functions.
 */

// Re-export types
export type {
  OptimizationElement,
  RecommendationConfidence,
  PlacementRecommendation,
  SubRecommendationDetail
} from './types.js';

// Re-export functions
export {
  generatePlacementRecommendation,
  generateSubRecommendation,
  generateListeningPositionRecommendation,
  determineElement
} from './recommendations.js';
