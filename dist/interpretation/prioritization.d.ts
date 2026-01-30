/**
 * Prioritization Engine
 *
 * Implements fixability-first scoring for issue prioritization.
 * Scoring: fixability (60%) + severity (40%)
 *
 * Philosophy: Prioritize free and effective fixes (placement) over
 * expensive treatments. Users should tackle easy wins first.
 */
import type { Recommendation, PrioritizedIssue, IssueInput, Fixability } from './types.js';
import type { Severity } from '../types/index.js';
/**
 * Prioritize issues using fixability-first scoring.
 *
 * @param issues - Array of issues to prioritize
 * @returns Sorted array with highest priority first (priority_score descending)
 *
 * @example
 * const issues = [
 *   { issue: 'SBIR null at 63Hz', severity: 'significant', fixability: 'placement', category: 'sbir' },
 *   { issue: 'Modal peak at 47Hz', severity: 'moderate', fixability: 'treatment', category: 'room_modes' }
 * ];
 * const prioritized = prioritizeIssues(issues);
 * // SBIR issue ranks higher (placement=100 vs treatment=50)
 */
export declare function prioritizeIssues(issues: IssueInput[]): PrioritizedIssue[];
/**
 * Generate context-aware recommendation based on issue category.
 *
 * @param issue - Issue input with category information
 * @returns Recommendation with action and expected impact
 *
 * Templates provide category-specific guidance:
 * - room_modes: Position adjustments to minimize modal impact
 * - sbir: Boundary distance changes to reduce interference
 * - sub_integration: Delay/phase/position for crossover summing
 * - lr_symmetry: Check placement and room asymmetries
 * - peak/null: Generic guidance for frequency response issues
 */
export declare function generateRecommendation(issue: IssueInput): Recommendation;
/**
 * Export weights for testing and documentation.
 *
 * Allows tests to verify scoring logic against known weights.
 */
export declare const WEIGHTS: {
    fixability: Record<Fixability, number>;
    severity: Record<Severity, number>;
};
//# sourceMappingURL=prioritization.d.ts.map