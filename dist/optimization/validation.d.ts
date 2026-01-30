/**
 * Optimization Validation
 *
 * Validates that placement adjustments improved response through pre/post comparison.
 * Provides actionable next steps based on improvement classification.
 */
import type { StoredMeasurement } from '../types/index.js';
export type ImprovementType = 'success' | 'partial' | 'unchanged' | 'worsened';
export interface ValidationResult {
    improvement_type: ImprovementType;
    metric_name: string;
    pre_value_db: number;
    post_value_db: number;
    improvement_db: number;
    improvement_percent: number;
    summary: string;
    next_action: string;
    explanation: string;
}
export interface TargetIssue {
    frequency_hz: number;
    category: string;
}
/**
 * Validate that an adjustment improved the response.
 *
 * Classification rules:
 * - Success: 50%+ reduction in deviation (proportional threshold)
 * - Unchanged: <1/2/3 dB based on issue size (context-dependent)
 * - Partial: Between unchanged and success
 * - Worsened: improvement_percent < -10
 */
export declare function validateAdjustment(preMeasurement: StoredMeasurement, postMeasurement: StoredMeasurement, targetIssue: TargetIssue): ValidationResult;
/**
 * Get context-dependent unchanged threshold.
 *
 * Small issues (<6 dB): <1 dB change = unchanged
 * Medium issues (6-10 dB): <2 dB change = unchanged
 * Large issues (>10 dB): <3 dB change = unchanged
 */
export declare function getUnchangedThreshold(deviation_db: number): number;
//# sourceMappingURL=validation.d.ts.map