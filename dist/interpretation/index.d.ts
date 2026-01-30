/**
 * Interpretation Layer
 *
 * Wraps analysis modules with plain language summaries and prioritized recommendations.
 */
export * from './types.js';
export * from './prioritization.js';
export { interpretRoomModes, type RoomModesData } from './room-modes-interpret.js';
export { interpretPeaksNulls, classifySBIR, type SBIRClassification, type PeaksNullsData } from './peaks-nulls-interpret.js';
export { interpretSubIntegration, detectPhaseInversion, type PhaseInversionDetection, type SubIntegrationData } from './sub-integration-interpret.js';
export { interpretLRSymmetry, type SymmetryRating, type ImagingImpact, type BandSymmetry, type LRSymmetryData } from './lr-symmetry.js';
export { compareGLMCalibration, analyzePostOnly, detectOvercorrection, detectOvercorrectionWithComparison, generateGLMSummary, type GLMComparisonResult } from './glm-comparison.js';
//# sourceMappingURL=index.d.ts.map