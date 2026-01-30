/**
 * GLM Comparison and Interpretation
 *
 * Compares pre-GLM and post-GLM measurements to classify corrections.
 * Provides both full comparison mode and post-only heuristic mode.
 */
import type { StoredMeasurement, ConfidenceLevel, GLMCorrection, GLMBeyondScope } from '../types/index.js';
export interface GLMComparisonResult {
    glm_successes: GLMCorrection[];
    glm_persistent: GLMBeyondScope[];
    glm_observations: Array<{
        observation: string;
        explanation: string;
        is_expected: boolean;
    }>;
    overcorrection_indicators: {
        bass_flatness: {
            detected: boolean;
            variance_db: number;
            threshold_db: number;
        };
        null_revelation: {
            detected: boolean;
            contrast_increase_db: number;
        };
    };
    mode: 'full_comparison' | 'post_only_heuristic';
    confidence: ConfidenceLevel;
}
/**
 * Compare pre-GLM and post-GLM measurements to classify corrections.
 *
 * Classification rules:
 * - Success: 50%+ reduction in deviation (proportional threshold)
 * - Unchanged: <1/2/3 dB change based on issue size (context-dependent)
 * - Partial: Between unchanged and success
 */
export declare function compareGLMCalibration(preMeasurement: StoredMeasurement, postMeasurement: StoredMeasurement): GLMComparisonResult;
/**
 * Analyze post-GLM measurement without baseline (heuristic mode).
 *
 * Uses GLM physics to infer likely behavior:
 * - Deep nulls (>10 dB) = beyond scope (GLM doesn't boost)
 * - Flat bass regions = likely GLM success
 * - Narrow peaks remaining = GLM may not have addressed
 */
export declare function analyzePostOnly(postMeasurement: StoredMeasurement): GLMComparisonResult;
/**
 * Detect overcorrection indicators with full comparison.
 *
 * Bass flatness: Unnaturally flat sub-bass (<2 dB variance below 40 Hz)
 * Null revelation: Nulls appear deeper post-GLM due to surrounding peak reduction
 */
export declare function detectOvercorrectionWithComparison(preMeasurement: StoredMeasurement, postMeasurement: StoredMeasurement): GLMComparisonResult['overcorrection_indicators'];
/**
 * Detect overcorrection indicators (post-only mode).
 *
 * Bass flatness: Can detect from post measurement alone
 * Null revelation: Cannot detect without pre-GLM comparison
 */
export declare function detectOvercorrection(postMeasurement: StoredMeasurement): GLMComparisonResult['overcorrection_indicators'];
/**
 * Generate plain language summary from GLM comparison result.
 */
export declare function generateGLMSummary(result: GLMComparisonResult): string;
//# sourceMappingURL=glm-comparison.d.ts.map