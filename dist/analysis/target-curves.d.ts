/**
 * Target Curve Analysis
 *
 * Compare measurements against target response curves.
 * Supports REW-compatible house curve format.
 *
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/eqwindow.html
 */
import type { FrequencyResponseData } from '../types/index.js';
export interface TargetCurvePoint {
    frequency_hz: number;
    level_db: number;
}
export interface TargetCurve {
    name: string;
    points: TargetCurvePoint[];
    interpolation: 'linear' | 'log';
}
export interface TargetDeviationStatistics {
    average_deviation_db: number;
    max_positive_deviation_db: number;
    max_negative_deviation_db: number;
    rms_deviation_db: number;
    max_positive_frequency_hz: number;
    max_negative_frequency_hz: number;
}
export interface BandDeviation {
    band_name: string;
    range_hz: [number, number];
    average_deviation_db: number;
    max_deviation_db: number;
    assessment: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor';
}
export interface WorstDeviation {
    frequency_hz: number;
    deviation_db: number;
    type: 'peak' | 'null';
}
export interface TargetDeviationResult {
    target_used: string;
    alignment_offset_db: number;
    deviation_statistics: TargetDeviationStatistics;
    by_band: BandDeviation[];
    worst_deviations: WorstDeviation[];
    overall_grade: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor';
}
/**
 * Flat target curve - 0 dB across all frequencies
 */
export declare const FLAT_CURVE: TargetCurve;
/**
 * REW Room Curve with LF rise and HF fall
 * Per REW EQ Window documentation
 */
export declare const REW_ROOM_CURVE: TargetCurve;
/**
 * Harman target curve approximation
 * ~3 dB bass shelf, slight downward tilt above 1 kHz
 */
export declare const HARMAN_CURVE: TargetCurve;
/**
 * B&K House Curve (studio mixing reference)
 */
export declare const BK_HOUSE_CURVE: TargetCurve;
/**
 * Get a built-in target curve by name
 */
export declare function getBuiltInCurve(name: 'flat' | 'rew_room_curve' | 'harman' | 'bk_house'): TargetCurve;
/**
 * Parse REW house curve file format
 *
 * Per REW docs: "Custom offset curves loaded from text files
 * with frequency/dB pairs"
 */
export declare function parseHouseCurve(content: string): TargetCurve;
/**
 * Interpolate target curve level at a specific frequency
 */
export declare function interpolateTargetLevel(curve: TargetCurve, frequency: number): number;
/**
 * Calculate alignment offset to match measurement level to target
 */
export declare function calculateAlignmentOffset(measurement: FrequencyResponseData, target: TargetCurve, alignmentFrequencyHz?: number): number;
/**
 * Calculate deviation from target
 */
export declare function calculateTargetDeviation(measurement: FrequencyResponseData, target: TargetCurve, options?: {
    alignment_frequency_hz?: number;
    evaluation_range_hz?: [number, number];
}): TargetDeviationResult;
/**
 * Create a custom target curve from points
 */
export declare function createCustomCurve(name: string, points: TargetCurvePoint[], interpolation?: 'linear' | 'log'): TargetCurve;
//# sourceMappingURL=target-curves.d.ts.map