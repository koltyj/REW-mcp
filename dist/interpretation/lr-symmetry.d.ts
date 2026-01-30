/**
 * L/R Symmetry Interpretation
 *
 * Analyzes stereo channel symmetry with tiered deviation ratings
 * and imaging impact assessment (ANLZ-03).
 */
import type { FrequencyResponseData, ConfidenceLevel, Severity } from '../types/index.js';
export type SymmetryRating = 'excellent' | 'good' | 'fair' | 'poor';
export type ImagingImpact = 'none' | 'minor' | 'moderate' | 'significant';
export interface BandSymmetry {
    band_name: string;
    frequency_range_hz: [number, number];
    left_avg_db: number;
    left_variance_db: number;
    right_avg_db: number;
    right_variance_db: number;
    level_deviation_db: number;
    variance_deviation_db: number;
    deviation_percentage: number;
    rating: SymmetryRating;
    imaging_impact: ImagingImpact;
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
export interface LRSymmetryData {
    overall_rating: SymmetryRating;
    overall_imaging_impact: ImagingImpact;
    asymmetry_score: number;
    band_symmetry: BandSymmetry[];
    worst_band: BandSymmetry | null;
}
/**
 * Interpret L/R symmetry with tiered deviation ratings
 *
 * Analyzes stereo channel symmetry across frequency bands:
 * - Bass: 60-200 Hz
 * - Midrange: 200-2000 Hz
 * - Upper Midrange: 2000-6000 Hz
 * - Treble: 6000-20000 Hz
 *
 * Rating thresholds:
 * - <1 dB deviation = excellent
 * - 1-2 dB = good
 * - 2-3 dB = fair
 * - >3 dB = poor
 *
 * Imaging impact thresholds:
 * - <1 dB level AND <2 dB variance = none
 * - <2 dB level AND <4 dB variance = minor
 * - <3 dB level AND <6 dB variance = moderate
 * - otherwise = significant
 */
export declare function interpretLRSymmetry(left: FrequencyResponseData, right: FrequencyResponseData): InterpretedResult<LRSymmetryData>;
//# sourceMappingURL=lr-symmetry.d.ts.map