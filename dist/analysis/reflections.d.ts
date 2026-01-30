/**
 * Reflection Analysis
 *
 * Detects early reflections from impulse response.
 */
import type { ImpulseResponseData, EarlyReflection, ConfidenceLevel } from '../types/index.js';
/**
 * Find direct sound peak
 */
export declare function findDirectSound(ir: ImpulseResponseData): {
    arrival_time_ms: number;
    level_db: number;
    peak_sample_index: number;
};
/**
 * Detect reflections after direct sound
 */
export declare function detectReflections(ir: ImpulseResponseData, options?: {
    max_reflection_time_ms?: number;
    threshold_db?: number;
}): EarlyReflection[];
/**
 * Estimate reflecting surface
 */
export declare function estimateReflectingSurface(pathDifferenceM: number, _speakerToListenerDistanceM?: number): {
    surface: string;
    confidence: ConfidenceLevel;
    reasoning: string;
};
/**
 * Analyze comb filtering from a reflection
 */
export declare function analyzeCombFiltering(delayMs: number): {
    affected_frequencies_hz: number[];
    first_null_hz: number;
    pattern: string;
};
/**
 * Calculate Initial Time Delay (ITD) gap
 */
export declare function calculateITDGap(_directArrivalMs: number, reflections: EarlyReflection[]): {
    itd_ms: number;
    assessment: 'excellent' | 'good' | 'acceptable' | 'short' | 'poor';
};
export interface EnhancedReflectionAnalysis {
    direct_sound: {
        arrival_time_ms: number;
        level_db: number;
    };
    reflections: Array<{
        delay_ms: number;
        level_relative_db: number;
        estimated_distance_m: number;
        likely_surface: string;
        severity: 'severe' | 'significant' | 'moderate' | 'minor' | 'negligible';
        comb_filter_affected_hz: number[];
    }>;
    clarity_metrics: {
        c50_db: number;
        c80_db: number;
        d50: number;
        itd_gap_ms: number;
        clarity_assessment: 'excellent' | 'good' | 'acceptable' | 'problematic';
    };
    comb_filtering_analysis: {
        risk_level: 'severe' | 'moderate' | 'mild' | 'negligible';
        primary_reflection_delay_ms: number;
        affected_frequencies_hz: number[];
    };
    overall_assessment: string;
}
/**
 * Calculate C50 (speech clarity)
 *
 * C50 = 10 * log10(E_0_50ms / E_50ms_inf)
 * Per industry standard (ISO 3382)
 */
export declare function calculateC50(ir: ImpulseResponseData): number;
/**
 * Calculate C80 (music clarity)
 *
 * C80 = 10 * log10(E_0_80ms / E_80ms_inf)
 */
export declare function calculateC80(ir: ImpulseResponseData): number;
/**
 * Calculate D50 (Definition)
 *
 * D50 = E_0_50ms / E_total
 * Returns ratio between 0 and 1
 */
export declare function calculateD50(ir: ImpulseResponseData): number;
/**
 * Estimate reflecting surface from delay
 *
 * Per REW docs: timing "indicates additional distance sound traveled"
 */
export declare function estimateSurfaceFromDelay(delayMs: number, roomDimensions?: {
    length: number;
    width: number;
    height: number;
}): string;
/**
 * Calculate comb filter frequencies
 *
 * f_null = (2n-1) * c / (2 * path_difference)
 * f_peak = n * c / path_difference
 */
export declare function calculateCombFrequencies(pathDifferenceM: number, maxFrequencyHz?: number): {
    nulls_hz: number[];
    peaks_hz: number[];
};
/**
 * Perform enhanced reflection analysis
 *
 * Combines reflection detection with clarity metrics and comb filtering analysis
 */
export declare function performEnhancedReflectionAnalysis(ir: ImpulseResponseData, options?: {
    max_reflection_time_ms?: number;
    threshold_db?: number;
    room_dimensions?: {
        length: number;
        width: number;
        height: number;
    };
}): EnhancedReflectionAnalysis;
//# sourceMappingURL=reflections.d.ts.map