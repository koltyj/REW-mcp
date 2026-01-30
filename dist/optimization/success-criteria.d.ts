/**
 * Success Criteria Evaluation
 *
 * Evaluates progress toward +-3dB target with zone-based classification.
 * Provides separate evaluations for smoothness, L/R balance, and sub integration.
 */
import type { StoredMeasurement } from '../types/index.js';
export type SuccessZone = 'good' | 'acceptable' | 'needs_work';
export interface ZoneEvaluation {
    zone: SuccessZone;
    variance_db: number;
    target_db: number;
    message: string;
}
export interface BalanceEvaluation {
    zone: SuccessZone;
    max_deviation_db: number;
    target_db: number;
    message: string;
}
export interface SuccessCriteriaResult {
    smoothness: ZoneEvaluation;
    lr_balance: BalanceEvaluation;
    sub_integration: ZoneEvaluation;
    overall_zone: SuccessZone;
    should_stop: boolean;
    progress_summary: string;
    limitation_note?: string;
}
export interface SuccessCriteriaOptions {
    leftMeasurement?: StoredMeasurement;
    rightMeasurement?: StoredMeasurement;
    subMeasurement?: StoredMeasurement;
}
/**
 * Evaluate success criteria with zone-based classification.
 *
 * Zone thresholds (per CONTEXT.md and RESEARCH.md):
 * - Smoothness (40-200 Hz variance):
 *   - good: <= 3 dB (+-3 dB target)
 *   - acceptable: <= 5 dB (+-4-5 dB)
 *   - needs_work: > 5 dB
 * - L/R Balance (max deviation):
 *   - good: <= 1 dB (excellent)
 *   - acceptable: <= 2 dB (good to fair)
 *   - needs_work: > 2 dB
 * - Sub Integration (40-100 Hz variance):
 *   - good: <= 4 dB
 *   - acceptable: <= 6 dB
 *   - needs_work: > 6 dB
 */
export declare function evaluateSuccessCriteria(measurement: StoredMeasurement, options?: SuccessCriteriaOptions): SuccessCriteriaResult;
//# sourceMappingURL=success-criteria.d.ts.map