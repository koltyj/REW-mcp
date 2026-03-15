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
 * Fixability weights (per CONTEXT.md decisions).
 *
 * - placement: 100 (free speaker/sub movement - highest priority)
 * - settings: 75 (easy level/delay/phase adjustments)
 * - treatment: 50 (requires acoustic panels/bass traps - costs money)
 * - unfixable: 10 (informational only - structural room issues)
 */
const FIXABILITY_WEIGHTS: Record<Fixability, number> = {
  placement: 100,
  settings: 75,
  treatment: 50,
  unfixable: 10,
};

/**
 * Severity weights.
 *
 * Maps severity levels to numeric scores for prioritization calculation.
 */
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  significant: 100,
  moderate: 60,
  minor: 30,
  negligible: 10,
};

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
export function prioritizeIssues(issues: IssueInput[]): PrioritizedIssue[] {
  const prioritized = issues.map((issue) => {
    // Combined score: fixability (60%) + severity (40%)
    const score =
      FIXABILITY_WEIGHTS[issue.fixability] * 0.6 + SEVERITY_WEIGHTS[issue.severity] * 0.4;

    return {
      ...issue,
      priority_score: Math.round(score),
      recommendation: generateRecommendation(issue),
    };
  });

  // Sort by priority score descending (highest first)
  return prioritized.sort((a, b) => b.priority_score - a.priority_score);
}

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
export function generateRecommendation(issue: IssueInput): Recommendation {
  // Generate context-aware recommendation based on category
  const templates: Record<string, { action: string; impact: string }> = {
    room_modes: {
      action: 'Adjust listening position or speaker placement to minimize modal impact',
      impact: 'May reduce modal peak/null by 3-6 dB',
    },
    sbir: {
      action: 'Move speaker away from nearby boundary',
      impact: 'Can reduce boundary interference null by 3-10 dB',
    },
    sub_integration: {
      action: 'Adjust subwoofer delay, phase, or position',
      impact: 'Can improve crossover summing by 3-6 dB',
    },
    lr_symmetry: {
      action: 'Check speaker placement symmetry or room asymmetries',
      impact: 'Can improve stereo imaging and channel balance',
    },
    peak: {
      action: 'Consider acoustic treatment or EQ cut',
      impact: 'Can reduce peak by applying correction',
    },
    null: {
      action: 'Reposition speakers or listening position',
      impact: 'Nulls cannot be boosted - position change may help',
    },
  };

  const template = templates[issue.category] || {
    action: `Address ${issue.issue}`,
    impact: 'Improvement depends on specific fix applied',
  };

  return {
    action: template.action,
    expected_impact: template.impact,
    priority: 0, // Will be set by caller based on sorted position
    fixability: issue.fixability,
    category: issue.category,
  };
}

/**
 * Export weights for testing and documentation.
 *
 * Allows tests to verify scoring logic against known weights.
 */
export const WEIGHTS = {
  fixability: FIXABILITY_WEIGHTS,
  severity: SEVERITY_WEIGHTS,
};
