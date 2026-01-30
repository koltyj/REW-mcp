/**
 * Subwoofer Integration Analysis
 *
 * Analyzes phase alignment and timing between subwoofer and main speakers
 * at the crossover region.
 */
import type { FrequencyResponseData, ImpulseResponseData, ConfidenceLevel } from '../types/index.js';
export interface CrossoverAnalysis {
    detected_crossover_hz: number;
    mains_rolloff_hz: number;
    sub_rolloff_hz: number;
    overlap_range_hz: [number, number];
    phase_at_crossover_mains_deg: number;
    phase_at_crossover_sub_deg: number;
    phase_difference_deg: number;
    phase_alignment_quality: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface TimingRecommendation {
    current_delay_ms: number;
    optimal_delay_ms: number;
    adjustment_needed_ms: number;
    alignment_method_used: 'ir_peak' | 'group_delay' | 'phase_match';
    confidence: ConfidenceLevel;
}
export interface PolarityRecommendation {
    current_polarity: 'normal' | 'inverted';
    recommended_polarity: 'normal' | 'inverted';
    invert_recommended: boolean;
    expected_improvement_db: number;
    confidence: ConfidenceLevel;
}
export interface SummationPrediction {
    current_dip_at_crossover_db: number;
    predicted_dip_after_optimization_db: number;
    improvement_db: number;
}
export interface SubIntegrationAnalysis {
    crossover_analysis: CrossoverAnalysis;
    timing_recommendations: TimingRecommendation;
    polarity_recommendation: PolarityRecommendation;
    summation_prediction: SummationPrediction;
    confidence: ConfidenceLevel;
    warnings: string[];
}
/**
 * Estimate crossover frequency from mains and sub measurements
 */
export declare function estimateCrossoverFrequency(mains: FrequencyResponseData, sub: FrequencyResponseData): number;
/**
 * Analyze crossover region
 */
export declare function analyzeCrossover(mains: FrequencyResponseData, sub: FrequencyResponseData, crossoverHz?: number): CrossoverAnalysis;
/**
 * Calculate optimal delay for sub/mains alignment
 *
 * Uses group delay alignment at crossover frequency.
 */
export declare function calculateOptimalDelay(mains: FrequencyResponseData, sub: FrequencyResponseData, crossoverHz: number, currentDelayMs?: number): TimingRecommendation;
/**
 * Analyze polarity recommendation
 *
 * Determines if inverting sub polarity would improve summation at crossover.
 */
export declare function analyzePolarity(mains: FrequencyResponseData, sub: FrequencyResponseData, crossoverHz: number, currentPolarity?: 'normal' | 'inverted'): PolarityRecommendation;
/**
 * Predict combined response with given delay and polarity
 */
export declare function predictCombinedResponse(mains: FrequencyResponseData, sub: FrequencyResponseData, delayMs?: number, invertPolarity?: boolean): FrequencyResponseData;
/**
 * Main function: Analyze subwoofer integration
 */
export declare function analyzeSubIntegration(mains: FrequencyResponseData, sub: FrequencyResponseData, options?: {
    crossover_hz?: number;
    current_sub_delay_ms?: number;
    current_sub_polarity?: 'normal' | 'inverted';
}): SubIntegrationAnalysis;
/**
 * Estimate optimal delay from impulse response peaks
 */
export declare function estimateDelayFromIR(mainsIR: ImpulseResponseData, subIR: ImpulseResponseData): {
    delay_ms: number;
    confidence: ConfidenceLevel;
};
//# sourceMappingURL=sub-integration.d.ts.map