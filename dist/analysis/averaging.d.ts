/**
 * Measurement Averaging
 *
 * Implements REW's averaging methods per official documentation.
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/graph_allspl.html
 */
import type { FrequencyResponseData, ImpulseResponseData, DataQuality } from '../types/index.js';
export type AveragingMethod = 'rms' | 'db' | 'vector' | 'rms_phase' | 'db_phase';
export interface AveragingOptions {
    method: AveragingMethod;
    align_spl?: boolean;
    alignment_frequency_range?: [number, number];
    weighting?: number[];
}
export interface MeasurementWithIR {
    frequency_response: FrequencyResponseData;
    impulse_response: ImpulseResponseData;
}
export interface AveragingResult {
    averaged_frequency_response: FrequencyResponseData;
    method_used: AveragingMethod;
    input_measurements: number;
    frequency_range_hz: [number, number];
    spl_alignment_applied: boolean;
    alignment_offsets_db: number[];
    data_quality: DataQuality;
    warnings: string[];
}
/**
 * Align SPL before averaging (per REW docs)
 *
 * "remove overall level differences due to different source distances"
 */
export declare function alignSPL(measurements: FrequencyResponseData[], frequencyRange?: [number, number]): {
    aligned: FrequencyResponseData[];
    offsets_db: number[];
};
/**
 * RMS Average (per REW docs)
 *
 * "converts dB values to linear magnitudes, squares them, sums and
 * divides by the number of measurements, then takes the square root
 * and converts back to dB"
 *
 * Phase is not taken into account - measurements are treated as incoherent.
 */
export declare function rmsAverage(measurements: FrequencyResponseData[], weights?: number[]): FrequencyResponseData;
/**
 * dB Average
 *
 * Simple arithmetic average of dB values.
 * Useful for target curve derivation with smoothed data.
 */
export declare function dbAverage(measurements: FrequencyResponseData[], weights?: number[]): FrequencyResponseData;
/**
 * Vector Average (per REW docs)
 *
 * "averages the currently selected traces taking into account both
 * magnitude and phase"
 *
 * Note: "can exhibit magnitude dips due to phase cancellations"
 * Requires IR data per docs.
 */
export declare function vectorAverage(measurements: FrequencyResponseData[], weights?: number[]): FrequencyResponseData;
/**
 * RMS Average with Phase (hybrid method)
 *
 * Uses RMS for magnitude but also averages phase.
 * Useful for position averaging with phase information.
 */
export declare function rmsPhaseAverage(measurements: FrequencyResponseData[], weights?: number[]): FrequencyResponseData;
/**
 * Main averaging function - applies specified method
 */
export declare function averageMeasurements(measurements: FrequencyResponseData[], options: AveragingOptions): AveragingResult;
//# sourceMappingURL=averaging.d.ts.map