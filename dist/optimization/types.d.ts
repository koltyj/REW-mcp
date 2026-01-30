/**
 * Optimization Types
 *
 * Type definitions for placement recommendations and optimization guidance.
 */
import type { Severity } from '../types/index.js';
/**
 * Element that can be optimized through placement adjustments.
 */
export type OptimizationElement = 'monitors' | 'subwoofer' | 'listening_position';
/**
 * Confidence level for recommendation.
 */
export type RecommendationConfidence = 'high' | 'medium' | 'low';
/**
 * Placement recommendation with physics-based reasoning.
 *
 * Generated from detected acoustic issues to provide actionable guidance
 * for improving frequency response through position adjustments.
 */
export interface PlacementRecommendation {
    /** What to move (monitors, subwoofer, or listening position) */
    element: OptimizationElement;
    /** Directional guidance ("Move monitors away from wall") */
    action: string;
    /** Physics context ("SBIR null at 125Hz from quarter-wavelength cancellation") */
    reason: string;
    /** How certain we are about this recommendation */
    confidence: RecommendationConfidence;
    /** What to expect ("May reduce null by 3-6 dB") */
    expected_improvement: string;
    /** Frequency being addressed */
    issue_frequency_hz: number;
    /** Severity of the issue being addressed */
    issue_severity: Severity;
    /** Category (sbir, room_modes, sub_integration, lr_symmetry) */
    issue_category: string;
}
/**
 * Subwoofer recommendation with additional detail.
 *
 * Extends PlacementRecommendation with subwoofer-specific guidance
 * including phase, boundary loading, and crossover context.
 */
export interface SubRecommendationDetail extends PlacementRecommendation {
    /** Phase flip guidance if applicable */
    phase_suggestion?: string;
    /** Corner placement context (e.g., "+3dB per boundary") */
    boundary_loading?: string;
    /** Crossover-related guidance for integration */
    crossover_context?: string;
}
//# sourceMappingURL=types.d.ts.map