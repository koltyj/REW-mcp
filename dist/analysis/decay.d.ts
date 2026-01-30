/**
 * Decay Time Analysis
 *
 * Estimates T60/T30/T20/Topt/EDT decay times from waterfall data or impulse response.
 * Implements ISO 3382-1:2009 compliant measurement methods.
 *
 * References:
 * - ISO 3382-1:2009 - Acoustics - Measurement of room acoustic parameters
 * - ISO 3382-2:2008 - Reverberation time in ordinary rooms
 * - https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html
 * - https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60decay.html
 *
 * ISO 3382 Compliance Notes:
 * - T20: Slope measured from -5 dB to -25 dB, extrapolated by factor of 3 to 60 dB
 * - T30: Slope measured from -5 dB to -35 dB, extrapolated by factor of 2 to 60 dB
 * - EDT: Slope measured from 0 dB to -10 dB, extrapolated by factor of 6 to 60 dB
 */
import type { ImpulseResponseData, DecayCharacter, Severity, ConfidenceLevel } from '../types/index.js';
/**
 * Schroeder curve representation
 */
export interface SchroederCurve {
    time_ms: number[];
    energy_db: number[];
    sample_rate_hz: number;
}
/**
 * RT60 result structure with multiple measurement methods
 */
export interface RT60Result {
    frequency_hz: number;
    t20_seconds: number | null;
    t30_seconds: number | null;
    topt_seconds: number | null;
    edt_seconds: number | null;
    confidence: ConfidenceLevel;
    noise_floor_db: number;
}
/**
 * RT60 band summary
 */
export interface RT60BandResult {
    center_frequency_hz: number;
    bandwidth: string;
    t20_seconds: number | null;
    t30_seconds: number | null;
    topt_seconds: number | null;
    edt_seconds: number | null;
    assessment: 'excellent' | 'good' | 'acceptable' | 'problematic' | 'severe';
    target_seconds: number;
    deviation_seconds: number;
}
/**
 * Calculate Schroeder Integral (backward-integrated energy decay curve)
 *
 * Note: This function calculates the Schroeder curve (integrated energy),
 * not the raw ETC (Energy Time Curve). The ETC is h²(t), while this returns
 * the backward integral ∫[t,∞] h²(τ)dτ used for RT60 calculations per ISO 3382.
 *
 * The function name is kept as generateETC for backward compatibility,
 * but it actually returns the Schroeder integral.
 *
 * @alias calculateSchroederIntegral
 */
export declare function generateETC(ir: ImpulseResponseData): {
    time_ms: number[];
    energy_db: number[];
};
/**
 * Build Schroeder Curve (per REW docs)
 *
 * "a plot of the energy (squared values) of the impulse response
 * that is backwards integrated"
 */
export declare function buildSchroederCurve(ir: ImpulseResponseData): SchroederCurve;
/**
 * Calculate EDT (Early Decay Time) per ISO 3382-1:2009
 *
 * Measures slope from 0 dB to -10 dB on the Schroeder curve,
 * then extrapolates by factor of 6 to estimate 60 dB decay time.
 *
 * ISO 3382 Reference: EDT is derived from the initial 10 dB of decay
 * and is more sensitive to early reflections than T20/T30.
 */
export declare function calculateEDT(schroeder: SchroederCurve): number | null;
/**
 * Calculate T20 per ISO 3382-1:2009
 *
 * Measures slope between -5 dB and -25 dB on the Schroeder curve,
 * then extrapolates by factor of 3 to estimate 60 dB decay time.
 *
 * ISO 3382 Reference: T20 uses a 20 dB evaluation range starting 5 dB
 * below the initial level to avoid the influence of the direct sound.
 */
export declare function calculateT20(schroeder: SchroederCurve): number | null;
/**
 * Calculate T30 per ISO 3382-1:2009
 *
 * Measures slope between -5 dB and -35 dB on the Schroeder curve,
 * then extrapolates by factor of 2 to estimate 60 dB decay time.
 *
 * ISO 3382 Reference: T30 uses a 30 dB evaluation range and is the
 * preferred method when the decay curve has sufficient dynamic range.
 */
export declare function calculateT30(schroeder: SchroederCurve): number | null;
/**
 * Calculate Topt (per REW docs)
 *
 * REW's adaptive measure that "uses a start point based on the intersection
 * of the EDT and T30 regression lines"
 *
 * Implementation:
 * 1. Calculate EDT regression line (0 to -10 dB)
 * 2. Calculate T30 regression line (-5 to -35 dB)
 * 3. Find intersection of these lines to get the optimal start point
 * 4. Use T30 end point (-35 dB or noise floor) as end point
 * 5. Extrapolate to 60 dB decay
 */
export declare function calculateTopt(schroeder: SchroederCurve): number | null;
/**
 * Estimate noise floor from end of decay curve
 */
export declare function estimateNoiseFloor(schroeder: SchroederCurve): number;
/**
 * Calculate full RT60 result with all methods
 */
export declare function calculateRT60Full(ir: ImpulseResponseData, frequencyHz?: number): RT60Result;
/**
 * Estimate T60 from energy decay curve (legacy function)
 * T60 is the time for sound to decay by 60 dB
 */
export declare function estimateT60(time_ms: number[], energy_db: number[]): number | null;
/**
 * Get target RT60 based on room volume (per REW docs)
 *
 * Target values from REW documentation:
 * - Small rooms (<50 m³): 0.3 seconds
 * - Larger rooms (up to 200 m³): 0.4–0.6 seconds
 */
export declare function getTargetRT60(roomVolumeM3?: number): number;
/**
 * Assess RT60 quality relative to target
 */
export declare function assessRT60Quality(measured: number, target: number): 'excellent' | 'good' | 'acceptable' | 'problematic' | 'severe';
/**
 * Estimate T60 for specific frequency band using bandpass filtering
 *
 * Per ISO 3382-1 and REW methodology:
 * 1. Apply bandpass filter centered at the target frequency
 * 2. Build Schroeder curve from filtered impulse response
 * 3. Calculate T30 from the filtered decay
 *
 * @param ir - Impulse response data
 * @param frequency_hz - Center frequency for analysis
 * @param bandwidth - Filter bandwidth in octaves (default: 1)
 */
export declare function estimateT60AtFrequency(ir: ImpulseResponseData, frequency_hz: number, bandwidth?: number): number;
/**
 * Calculate RT60 results for standard octave or third-octave bands
 */
export declare function calculateRT60Bands(ir: ImpulseResponseData, resolution?: 'octave' | 'third_octave' | 'sixth_octave', frequencyRange?: [number, number], targetRT60?: number): RT60BandResult[];
/**
 * Classify decay character
 */
export declare function classifyDecayCharacter(t60: number, frequency_hz: number, hasCorrelatedPeak: boolean): DecayCharacter;
/**
 * Classify decay severity
 */
export declare function classifyDecaySeverity(t60: number, threshold: number): Severity;
/**
 * Alias for generateETC - calculates Schroeder integral
 * Preferred name for semantic accuracy
 */
export declare const calculateSchroederIntegral: typeof generateETC;
/**
 * Calculate clarity metrics from impulse response
 */
export declare function calculateClarityMetrics(ir: ImpulseResponseData): {
    c50_db: number;
    c80_db: number;
    d50_percent: number;
    assessment: string;
};
//# sourceMappingURL=decay.d.ts.map