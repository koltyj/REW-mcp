/**
 * Optimization Module
 *
 * Exports placement recommendation types and generation functions,
 * plus validation and success criteria for optimization workflow.
 */
export type { OptimizationElement, RecommendationConfidence, PlacementRecommendation, SubRecommendationDetail } from './types.js';
export { generatePlacementRecommendation, generateSubRecommendation, generateListeningPositionRecommendation, determineElement } from './recommendations.js';
export type { ImprovementType, ValidationResult, TargetIssue } from './validation.js';
export { validateAdjustment, getUnchangedThreshold } from './validation.js';
export type { SuccessZone, ZoneEvaluation, BalanceEvaluation, SuccessCriteriaResult, SuccessCriteriaOptions } from './success-criteria.js';
export { evaluateSuccessCriteria } from './success-criteria.js';
//# sourceMappingURL=index.d.ts.map