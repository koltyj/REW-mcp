/**
 * Peak and Null Detection
 *
 * Detects peaks (local maxima) and nulls (local minima) in frequency response data.
 */
import type { DetectedPeak, DetectedNull, FrequencyResponseData } from '../types/index.js';
/**
 * Detect peaks in frequency response
 */
export declare function detectPeaks(fr: FrequencyResponseData, options?: {
    threshold_db?: number;
    min_frequency_hz?: number;
    max_frequency_hz?: number;
}): DetectedPeak[];
/**
 * Detect nulls in frequency response
 */
export declare function detectNulls(fr: FrequencyResponseData, options?: {
    threshold_db?: number;
    min_frequency_hz?: number;
    max_frequency_hz?: number;
}): DetectedNull[];
/**
 * Calculate quick statistics for frequency bands
 */
export declare function calculateQuickStats(fr: FrequencyResponseData): {
    bass_avg_db: number;
    midrange_avg_db: number;
    treble_avg_db: number;
    variance_20_200hz_db: number;
    variance_200_2000hz_db: number;
    variance_2000_20000hz_db: number;
};
//# sourceMappingURL=peaks-nulls.d.ts.map