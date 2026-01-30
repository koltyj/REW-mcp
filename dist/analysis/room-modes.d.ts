/**
 * Room Mode Calculation and Analysis
 *
 * Calculates theoretical room modes and correlates with detected peaks.
 */
import type { TheoreticalMode, RoomDimensions, DetectedPeak, ModeCorrelation } from '../types/index.js';
/**
 * Calculate all theoretical room modes
 */
export declare function calculateTheoreticalModes(dimensions: RoomDimensions, maxFrequency?: number): TheoreticalMode[];
/**
 * Correlate a peak with theoretical modes
 */
export declare function correlatePeakWithModes(peakFreq: number, theoreticalModes: TheoreticalMode[], tolerancePercent?: number): ModeCorrelation | undefined;
/**
 * Correlate all peaks with modes
 */
export declare function correlatePeaksWithModes(peaks: DetectedPeak[], theoreticalModes: TheoreticalMode[]): DetectedPeak[];
/**
 * Calculate Schroeder frequency
 * Below this frequency, room modes dominate; above it, the room is more diffuse
 */
export declare function calculateSchroederFrequency(dimensions: RoomDimensions, rt60?: number): number;
/**
 * Assess mode distribution quality
 */
export declare function assessModeDistribution(theoreticalModes: TheoreticalMode[]): {
    mode_spacing_quality: 'good' | 'fair' | 'poor';
    problematic_clusters: Array<{
        frequencies_hz: number[];
        severity: 'significant' | 'moderate' | 'minor';
    }>;
    mode_gaps: Array<{
        range_hz: [number, number];
        severity: 'significant' | 'moderate' | 'minor';
    }>;
};
//# sourceMappingURL=room-modes.d.ts.map