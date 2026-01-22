/**
 * Interpretation Layer
 *
 * Wraps analysis modules with plain language summaries and prioritized recommendations.
 */

// Core types and prioritization
export * from './types.js';
export * from './prioritization.js';

// Room modes interpretation
export {
  interpretRoomModes,
  type RoomModesData
} from './room-modes-interpret.js';

// Peaks and nulls interpretation with SBIR classification
export {
  interpretPeaksNulls,
  classifySBIR,
  type SBIRClassification,
  type PeaksNullsData
} from './peaks-nulls-interpret.js';

// Sub integration interpretation
export {
  interpretSubIntegration,
  detectPhaseInversion,
  type PhaseInversionDetection,
  type SubIntegrationData
} from './sub-integration-interpret.js';

// L/R symmetry interpretation
export {
  interpretLRSymmetry,
  type SymmetryRating,
  type ImagingImpact,
  type BandSymmetry,
  type LRSymmetryData
} from './lr-symmetry.js';
