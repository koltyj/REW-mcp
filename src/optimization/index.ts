/**
 * Optimization Module
 *
 * Exports placement recommendation types and generation functions,
 * plus validation and success criteria for optimization workflow.
 */

// Re-export placement recommendation types
export type {
  OptimizationElement,
  RecommendationConfidence,
  PlacementRecommendation,
  SubRecommendationDetail
} from './types.js';

// Re-export placement recommendation functions
export {
  generatePlacementRecommendation,
  generateSubRecommendation,
  generateListeningPositionRecommendation,
  determineElement
} from './recommendations.js';

// Re-export validation types
export type {
  ImprovementType,
  ValidationResult,
  TargetIssue
} from './validation.js';

// Re-export validation functions
export {
  validateAdjustment,
  getUnchangedThreshold
} from './validation.js';

// Re-export success criteria types
export type {
  SuccessZone,
  ZoneEvaluation,
  BalanceEvaluation,
  SuccessCriteriaResult,
  SuccessCriteriaOptions
} from './success-criteria.js';

// Re-export success criteria functions
export {
  evaluateSuccessCriteria
} from './success-criteria.js';
