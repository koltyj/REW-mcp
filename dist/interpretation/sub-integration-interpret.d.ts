/**
 * Subwoofer Integration Interpretation
 *
 * Wraps sub-integration analysis with plain language summaries and
 * explicit phase inversion detection (ANLZ-04, ANLZ-05).
 */
import type { SubIntegrationAnalysis, CrossoverAnalysis, PolarityRecommendation } from '../analysis/sub-integration.js';
import type { ConfidenceLevel, Severity } from '../types/index.js';
export interface PhaseInversionDetection {
    is_inverted: boolean;
    phase_difference_deg: number;
    confidence: ConfidenceLevel;
    explanation: string;
    expected_improvement_db?: number;
}
export interface Recommendation {
    action: string;
    expected_impact: string;
    priority: number;
    fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
    category: string;
}
export interface InterpretedResult<T> {
    data: T;
    summary: string;
    recommendations: Recommendation[];
    severity: Severity;
    confidence: ConfidenceLevel;
}
export interface SubIntegrationData {
    analysis: SubIntegrationAnalysis;
    phase_inversion: PhaseInversionDetection;
}
/**
 * Detect phase inversion based on phase difference at crossover
 *
 * Phase inversion is detected when phase difference is 150-210 degrees (near 180°).
 * This is distinct from normal phase misalignment.
 */
export declare function detectPhaseInversion(crossover: CrossoverAnalysis, polarity: PolarityRecommendation): PhaseInversionDetection;
/**
 * Interpret sub integration analysis with plain language summary
 *
 * Wraps existing SubIntegrationAnalysis with:
 * - Explicit phase inversion detection (150-210 degree range)
 * - Plain language summaries for crossover, timing, and polarity
 * - Prioritized recommendations (settings fixes before placement)
 */
export declare function interpretSubIntegration(analysis: SubIntegrationAnalysis): InterpretedResult<SubIntegrationData>;
//# sourceMappingURL=sub-integration-interpret.d.ts.map