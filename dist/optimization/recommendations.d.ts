/**
 * Recommendation Generation Functions
 *
 * Generates element-specific placement recommendations with physics-based reasoning
 * from detected acoustic issues.
 */
import type { PrioritizedIssue } from '../interpretation/types.js';
import type { RoomDimensions } from '../types/index.js';
import type { PlacementRecommendation, SubRecommendationDetail, OptimizationElement } from './types.js';
interface PhaseInfo {
    is_inverted: boolean;
    phase_difference_deg: number;
    expected_improvement_db?: number;
}
/**
 * Determine which element should be adjusted based on issue category and frequency.
 */
export declare function determineElement(issue: PrioritizedIssue): OptimizationElement;
/**
 * Generate placement recommendation from a prioritized issue.
 *
 * Uses physics-based reasoning to provide actionable guidance:
 * - SBIR: Quarter-wavelength formula for boundary distance
 * - Room modes: Position adjustment to avoid mode nulls
 * - Peaks: Boundary distance changes
 * - Nulls: Repositioning (not EQ - can't boost nulls)
 */
export declare function generatePlacementRecommendation(issue: PrioritizedIssue): PlacementRecommendation;
/**
 * Generate detailed subwoofer recommendation with phase, boundary, and crossover context.
 *
 * More detailed than monitor recommendations:
 * - Includes phase flip guidance if phase inversion detected
 * - Explains boundary loading physics (+3dB per boundary)
 * - Provides crossover-related context for integration
 */
export declare function generateSubRecommendation(issue: PrioritizedIssue, phaseInfo?: PhaseInfo): SubRecommendationDetail;
/**
 * Generate listening position recommendation with room dimension awareness.
 *
 * Uses 38% rule when dimensions available:
 * - Optimal listening position is ~38% of room length from front wall
 * - Avoids common modal nulls at 1/4, 1/2, 3/4 room positions
 *
 * Without dimensions: Generic guidance to move forward/backward.
 */
export declare function generateListeningPositionRecommendation(issue: PrioritizedIssue, roomDimensions?: RoomDimensions): PlacementRecommendation;
export {};
//# sourceMappingURL=recommendations.d.ts.map