/**
 * Interpretation Infrastructure Types
 *
 * Shared interfaces for recommendations, interpreted results, and prioritization.
 */
import type { ConfidenceLevel, Severity } from '../types/index.js';
/**
 * Fixability categories for issue prioritization.
 *
 * - placement: Free speaker/sub position adjustments (highest priority)
 * - settings: Level, delay, phase adjustments (easy to change)
 * - treatment: Requires acoustic panels or bass traps (costs money)
 * - unfixable: Informational only (structural room modes, deep nulls)
 */
export type Fixability = 'placement' | 'settings' | 'treatment' | 'unfixable';
/**
 * Actionable recommendation with priority and impact assessment.
 */
export interface Recommendation {
    /** Plain language action: "Move subwoofer 6 inches from rear wall" */
    action: string;
    /** Expected outcome: "Should reduce 63Hz null by 3-6 dB" */
    expected_impact: string;
    /** Priority rank (1 = highest, assigned after scoring) */
    priority: number;
    /** How easy/expensive to fix */
    fixability: Fixability;
    /** Analysis category: 'room_modes', 'sbir', 'sub_integration', 'lr_symmetry' */
    category: string;
}
/**
 * Generic wrapper for analysis results with interpretation.
 *
 * Used by all analysis modules to return:
 * - Original technical data
 * - Plain language summary
 * - Actionable recommendations
 * - Overall severity and confidence
 */
export interface InterpretedResult<T> {
    /** Original analysis data (peaks, modes, reflections, etc.) */
    data: T;
    /** Plain language summary for non-technical users */
    summary: string;
    /** Actionable suggestions sorted by priority */
    recommendations: Recommendation[];
    /** Overall severity assessment */
    severity: Severity;
    /** Analysis confidence level */
    confidence: ConfidenceLevel;
}
/**
 * Prioritized issue with scoring metadata.
 *
 * Output of prioritization engine - includes both issue details
 * and calculated priority score for ranking.
 */
export interface PrioritizedIssue {
    /** Issue description */
    issue: string;
    /** Impact severity */
    severity: Severity;
    /** How easy to fix */
    fixability: Fixability;
    /** Combined priority score (0-100, higher = more urgent) */
    priority_score: number;
    /** Analysis category */
    category: string;
    /** Generated recommendation */
    recommendation: Recommendation;
}
/**
 * Input for prioritization engine.
 *
 * Simpler interface for feeding issues into scoring logic.
 */
export interface IssueInput {
    issue: string;
    severity: Severity;
    fixability: Fixability;
    category: string;
}
//# sourceMappingURL=types.d.ts.map