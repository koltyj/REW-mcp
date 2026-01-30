/**
 * Room Modes Interpretation
 *
 * Wraps room-modes analysis with plain language summaries and recommendations.
 * Correlates theoretical modes with detected peaks when provided.
 */
import type { TheoreticalMode, RoomDimensions, DetectedPeak, Severity } from '../types/index.js';
import type { InterpretedResult } from './types.js';
export interface RoomModesData {
    theoretical_modes: TheoreticalMode[];
    schroeder_frequency_hz?: number;
    mode_spacing_quality?: 'good' | 'fair' | 'poor';
    problematic_clusters?: Array<{
        frequencies_hz: number[];
        severity: Severity;
    }>;
    mode_gaps?: Array<{
        range_hz: [number, number];
        severity: Severity;
    }>;
    correlated_peaks?: DetectedPeak[];
    dimensions_provided: boolean;
}
/**
 * Interpret room modes analysis with dimension correlation when available
 */
export declare function interpretRoomModes(peaks: DetectedPeak[], dimensions?: RoomDimensions, rt60?: number): InterpretedResult<RoomModesData>;
//# sourceMappingURL=room-modes-interpret.d.ts.map