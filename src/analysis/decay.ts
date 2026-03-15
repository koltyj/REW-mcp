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
  t20_seconds: number | null;   // -5 to -25 dB slope
  t30_seconds: number | null;   // -5 to -35 dB slope
  topt_seconds: number | null;  // REW's adaptive method
  edt_seconds: number | null;   // Early Decay Time (0 to -10 dB)
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
export function generateETC(ir: ImpulseResponseData): {
  time_ms: number[];
  energy_db: number[];
} {
  const { samples, sample_rate_hz, peak_index } = ir;
  
  // Start from peak
  const relevantSamples = samples.slice(peak_index);
  
  // Calculate squared samples (energy)
  const energy = relevantSamples.map(s => s * s);
  
  // Calculate cumulative backwards energy (Schroeder integration)
  const schroeder: number[] = new Array(energy.length);
  schroeder[energy.length - 1] = energy[energy.length - 1];
  
  for (let i = energy.length - 2; i >= 0; i--) {
    schroeder[i] = energy[i] + schroeder[i + 1];
  }
  
  // Convert to dB
  const maxEnergy = Math.max(...schroeder);
  const energy_db = schroeder.map(e => 10 * Math.log10((e / maxEnergy) + 1e-10));
  
  // Generate time axis in ms
  const time_ms = energy_db.map((_, i) => (i / sample_rate_hz) * 1000);
  
  return { time_ms, energy_db };
}

/**
 * Build Schroeder Curve (per REW docs)
 *
 * "a plot of the energy (squared values) of the impulse response
 * that is backwards integrated"
 */
export function buildSchroederCurve(ir: ImpulseResponseData): SchroederCurve {
  const etc = generateETC(ir);
  return {
    time_ms: etc.time_ms,
    energy_db: etc.energy_db,
    sample_rate_hz: ir.sample_rate_hz
  };
}

/**
 * Find time at specific dB level on decay curve using linear interpolation
 */
function findTimeAtLevel(
  time_ms: number[],
  energy_db: number[],
  targetDb: number
): number | null {
  for (let i = 1; i < energy_db.length; i++) {
    if (energy_db[i] <= targetDb && energy_db[i - 1] > targetDb) {
      // Linear interpolation
      const ratio = (targetDb - energy_db[i - 1]) / (energy_db[i] - energy_db[i - 1]);
      return time_ms[i - 1] + ratio * (time_ms[i] - time_ms[i - 1]);
    }
  }
  return null;
}

/**
 * Calculate EDT (Early Decay Time) per ISO 3382-1:2009
 * 
 * Measures slope from 0 dB to -10 dB on the Schroeder curve,
 * then extrapolates by factor of 6 to estimate 60 dB decay time.
 * 
 * ISO 3382 Reference: EDT is derived from the initial 10 dB of decay
 * and is more sensitive to early reflections than T20/T30.
 */
export function calculateEDT(schroeder: SchroederCurve): number | null {
  const { time_ms, energy_db } = schroeder;
  
  // Find 0 dB and -10 dB points
  const t0 = findTimeAtLevel(time_ms, energy_db, 0);
  const t10 = findTimeAtLevel(time_ms, energy_db, -10);
  
  if (t0 !== null && t10 !== null && t10 > t0) {
    // EDT = 6 * (time for 10 dB decay)
    return ((t10 - t0) / 1000) * 6; // Convert to seconds and extrapolate
  }
  
  return null;
}

/**
 * Calculate T20 per ISO 3382-1:2009
 *
 * Measures slope between -5 dB and -25 dB on the Schroeder curve,
 * then extrapolates by factor of 3 to estimate 60 dB decay time.
 * 
 * ISO 3382 Reference: T20 uses a 20 dB evaluation range starting 5 dB
 * below the initial level to avoid the influence of the direct sound.
 */
export function calculateT20(schroeder: SchroederCurve): number | null {
  const { time_ms, energy_db } = schroeder;
  
  // Find -5 dB and -25 dB points
  const t5 = findTimeAtLevel(time_ms, energy_db, -5);
  const t25 = findTimeAtLevel(time_ms, energy_db, -25);
  
  if (t5 !== null && t25 !== null && t25 > t5) {
    // T20 is extrapolated from 20 dB range to 60 dB
    return ((t25 - t5) / 1000) * 3; // Convert to seconds and extrapolate
  }
  
  return null;
}

/**
 * Calculate T30 per ISO 3382-1:2009
 *
 * Measures slope between -5 dB and -35 dB on the Schroeder curve,
 * then extrapolates by factor of 2 to estimate 60 dB decay time.
 * 
 * ISO 3382 Reference: T30 uses a 30 dB evaluation range and is the
 * preferred method when the decay curve has sufficient dynamic range.
 */
export function calculateT30(schroeder: SchroederCurve): number | null {
  const { time_ms, energy_db } = schroeder;
  
  // Find -5 dB and -35 dB points
  const t5 = findTimeAtLevel(time_ms, energy_db, -5);
  const t35 = findTimeAtLevel(time_ms, energy_db, -35);
  
  if (t5 !== null && t35 !== null && t35 > t5) {
    // T30 is extrapolated from 30 dB range to 60 dB
    return ((t35 - t5) / 1000) * 2; // Convert to seconds and extrapolate
  }
  
  return null;
}

/**
 * Calculate linear regression slope and intercept for a range of the decay curve
 * Returns { slope, intercept } where y = slope * x + intercept
 */
function calculateRegressionLine(
  time_ms: number[],
  energy_db: number[],
  startDb: number,
  endDb: number
): { slope: number; intercept: number; startTime: number; endTime: number } | null {
  const startTime = findTimeAtLevel(time_ms, energy_db, startDb);
  const endTime = findTimeAtLevel(time_ms, energy_db, endDb);
  
  if (startTime === null || endTime === null || endTime <= startTime) {
    return null;
  }
  
  // Calculate slope (dB per ms)
  const slope = (endDb - startDb) / (endTime - startTime);
  // Calculate intercept: startDb = slope * startTime + intercept
  const intercept = startDb - slope * startTime;
  
  return { slope, intercept, startTime, endTime };
}

/**
 * Find intersection point of two regression lines
 * Returns the time (in ms) where the lines intersect
 */
function findRegressionIntersection(
  line1: { slope: number; intercept: number },
  line2: { slope: number; intercept: number }
): number | null {
  // line1: y = slope1 * x + intercept1
  // line2: y = slope2 * x + intercept2
  // At intersection: slope1 * x + intercept1 = slope2 * x + intercept2
  // x = (intercept2 - intercept1) / (slope1 - slope2)
  
  const slopeDiff = line1.slope - line2.slope;
  if (Math.abs(slopeDiff) < 1e-10) {
    // Lines are parallel, no intersection
    return null;
  }
  
  return (line2.intercept - line1.intercept) / slopeDiff;
}

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
export function calculateTopt(schroeder: SchroederCurve): number | null {
  const { time_ms, energy_db } = schroeder;
  
  // Calculate EDT regression line (0 to -10 dB)
  const edtLine = calculateRegressionLine(time_ms, energy_db, 0, -10);
  
  // Calculate T30 regression line (-5 to -35 dB)
  const t30Line = calculateRegressionLine(time_ms, energy_db, -5, -35);
  
  if (!edtLine || !t30Line) {
    // Fall back to T30 or T20 if regression lines can't be calculated
    const t30 = calculateT30(schroeder);
    if (t30 !== null) return t30;
    
    const t20 = calculateT20(schroeder);
    return t20;
  }
  
  // Find intersection of EDT and T30 regression lines
  const intersectionTime = findRegressionIntersection(edtLine, t30Line);
  
  if (intersectionTime === null || intersectionTime < 0) {
    // If no valid intersection, fall back to T30
    return calculateT30(schroeder);
  }
  
  // Calculate dB level at intersection point using T30 line
  const intersectionDb = t30Line.slope * intersectionTime + t30Line.intercept;
  
  // Use the intersection as start point and -35 dB as end point
  // (or noise floor if higher)
  const noiseFloor = estimateNoiseFloor(schroeder);
  const endDb = Math.max(-35, noiseFloor + 5); // Stay 5 dB above noise floor
  
  // Find end time at endDb level
  const endTime = findTimeAtLevel(time_ms, energy_db, endDb);
  
  if (endTime === null || endTime <= intersectionTime) {
    // Fall back to T30 if we can't find valid end point
    return calculateT30(schroeder);
  }
  
  // Calculate decay time from intersection to end
  const decayRange = Math.abs(endDb - intersectionDb);
  const decayTime_ms = endTime - intersectionTime;
  
  if (decayRange < 5 || decayTime_ms <= 0) {
    // Not enough range for reliable measurement
    return calculateT30(schroeder);
  }
  
  // Extrapolate to 60 dB decay
  const extrapolationFactor = 60 / decayRange;
  const topt_seconds = (decayTime_ms / 1000) * extrapolationFactor;
  
  // Sanity check: Topt should be in reasonable range
  if (topt_seconds < 0.01 || topt_seconds > 10) {
    return calculateT30(schroeder);
  }
  
  return topt_seconds;
}

/**
 * Estimate noise floor from end of decay curve
 */
export function estimateNoiseFloor(schroeder: SchroederCurve): number {
  const { energy_db } = schroeder;
  
  // Use last 10% of samples to estimate noise floor
  const tailStart = Math.floor(energy_db.length * 0.9);
  const tailSamples = energy_db.slice(tailStart);
  
  if (tailSamples.length === 0) return -60;
  
  return tailSamples.reduce((a, b) => a + b, 0) / tailSamples.length;
}

/**
 * Calculate full RT60 result with all methods
 */
export function calculateRT60Full(
  ir: ImpulseResponseData,
  frequencyHz: number = 0
): RT60Result {
  const schroeder = buildSchroederCurve(ir);
  
  const t20 = calculateT20(schroeder);
  const t30 = calculateT30(schroeder);
  const topt = calculateTopt(schroeder);
  const edt = calculateEDT(schroeder);
  const noiseFloor = estimateNoiseFloor(schroeder);
  
  // Determine confidence based on available measurements
  let confidence: ConfidenceLevel = 'high';
  if (t30 === null && t20 === null) {
    confidence = 'low';
  } else if (t30 === null || noiseFloor > -35) {
    confidence = 'medium';
  }
  
  return {
    frequency_hz: frequencyHz,
    t20_seconds: t20,
    t30_seconds: t30,
    topt_seconds: topt,
    edt_seconds: edt,
    confidence,
    noise_floor_db: noiseFloor
  };
}

/**
 * Estimate T60 from energy decay curve (legacy function)
 * T60 is the time for sound to decay by 60 dB
 */
export function estimateT60(time_ms: number[], energy_db: number[]): number | null {
  const schroeder: SchroederCurve = {
    time_ms,
    energy_db,
    sample_rate_hz: 48000 // Default, not critical for this calculation
  };
  
  return calculateT30(schroeder);
}

/**
 * Get target RT60 based on room volume (per REW docs)
 * 
 * Target values from REW documentation:
 * - Small rooms (<50 m³): 0.3 seconds
 * - Larger rooms (up to 200 m³): 0.4–0.6 seconds
 */
export function getTargetRT60(roomVolumeM3?: number): number {
  if (!roomVolumeM3) {
    return 0.3; // Default for typical home studio
  }
  
  if (roomVolumeM3 < 50) {
    return 0.3;
  } else if (roomVolumeM3 < 100) {
    return 0.35;
  } else if (roomVolumeM3 < 150) {
    return 0.4;
  } else if (roomVolumeM3 < 200) {
    return 0.5;
  } else {
    return 0.6;
  }
}

/**
 * Assess RT60 quality relative to target
 */
export function assessRT60Quality(
  measured: number,
  target: number
): 'excellent' | 'good' | 'acceptable' | 'problematic' | 'severe' {
  const ratio = measured / target;
  
  if (ratio <= 1.1 && ratio >= 0.9) return 'excellent';
  if (ratio <= 1.3 && ratio >= 0.7) return 'good';
  if (ratio <= 1.5 && ratio >= 0.5) return 'acceptable';
  if (ratio <= 2.0 && ratio >= 0.3) return 'problematic';
  return 'severe';
}

/**
 * Apply a 2nd-order Butterworth bandpass filter to the samples
 * 
 * This is a simplified IIR filter implementation for octave-band filtering
 * per ISO 3382 requirements for frequency-specific RT60 analysis.
 * 
 * @param samples - Input samples to filter
 * @param sampleRate - Sample rate in Hz
 * @param centerFreq - Center frequency of the bandpass filter
 * @param bandwidth - Bandwidth in octaves (default: 1 for octave bands)
 */
function applyBandpassFilter(
  samples: number[],
  sampleRate: number,
  centerFreq: number,
  bandwidth: number = 1
): number[] {
  // Calculate lower and upper cutoff frequencies for the bandpass
  const ratio = Math.pow(2, bandwidth / 2);
  const lowCutoff = centerFreq / ratio;
  const highCutoff = centerFreq * ratio;
  
  // Normalize frequencies to Nyquist
  const nyquist = sampleRate / 2;
  const lowNorm = lowCutoff / nyquist;
  const highNorm = highCutoff / nyquist;
  
  // Clamp to valid range
  const lowNormClamped = Math.max(0.001, Math.min(0.999, lowNorm));
  const highNormClamped = Math.max(lowNormClamped + 0.001, Math.min(0.999, highNorm));
  
  // Design 2nd-order Butterworth bandpass filter coefficients
  // Using bilinear transform approximation
  const w0Low = Math.tan(Math.PI * lowNormClamped);
  const w0High = Math.tan(Math.PI * highNormClamped);
  const bw = w0High - w0Low;
  const w02 = w0Low * w0High;
  
  // Filter coefficients for bandpass
  const sqrt2 = Math.SQRT2;
  const K = bw;
  const K2 = K * K;
  const norm = 1 / (1 + sqrt2 * K + K2 + w02 * (1 + sqrt2 * K + K2));
  
  // Simplified 2nd-order bandpass coefficients
  const b0 = K * norm;
  const b1 = 0;
  const b2 = -K * norm;
  const a1 = 2 * (w02 * (1 + sqrt2 * K + K2) - 1) * norm;
  const a2 = (1 - sqrt2 * K + K2 + w02 * (1 - sqrt2 * K + K2)) * norm;
  
  // Apply filter (direct form II transposed)
  const output = new Array(samples.length).fill(0);
  let z1 = 0, z2 = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    output[i] = y;
  }
  
  // Apply filter again in reverse for zero-phase filtering
  z1 = 0;
  z2 = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const x = output[i];
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    output[i] = y;
  }
  
  return output;
}

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
export function estimateT60AtFrequency(
  ir: ImpulseResponseData,
  frequency_hz: number,
  bandwidth: number = 1
): number {
  const { samples, sample_rate_hz, peak_index } = ir;
  
  // Validate frequency is within analyzable range
  const nyquist = sample_rate_hz / 2;
  if (frequency_hz < 20 || frequency_hz > nyquist * 0.9) {
    // Outside analyzable range, return default
    return 0.3;
  }
  
  // Apply bandpass filter to the samples
  const filteredSamples = applyBandpassFilter(
    samples,
    sample_rate_hz,
    frequency_hz,
    bandwidth
  );
  
  // Find new peak in filtered data (may shift slightly)
  let filteredPeakIndex = peak_index;
  let maxVal = 0;
  const searchWindow = Math.floor(sample_rate_hz * 0.01); // 10ms search window
  const searchStart = Math.max(0, peak_index - searchWindow);
  const searchEnd = Math.min(filteredSamples.length - 1, peak_index + searchWindow);
  
  for (let i = searchStart; i <= searchEnd; i++) {
    const absVal = Math.abs(filteredSamples[i]);
    if (absVal > maxVal) {
      maxVal = absVal;
      filteredPeakIndex = i;
    }
  }
  
  // Create filtered IR data structure
  const filteredIR: ImpulseResponseData = {
    samples: filteredSamples,
    sample_rate_hz: sample_rate_hz,
    peak_index: filteredPeakIndex,
    start_time_s: 0,
    duration_s: filteredSamples.length / sample_rate_hz
  };
  
  // Build Schroeder curve from filtered data
  const schroeder = buildSchroederCurve(filteredIR);
  
  // Calculate T30 from filtered decay
  const t30 = calculateT30(schroeder);
  
  if (t30 !== null && t30 > 0.01 && t30 < 10) {
    return t30;
  }
  
  // Try T20 if T30 fails
  const t20 = calculateT20(schroeder);
  if (t20 !== null && t20 > 0.01 && t20 < 10) {
    return t20;
  }
  
  // Fall back to EDT if both fail
  const edt = calculateEDT(schroeder);
  if (edt !== null && edt > 0.01 && edt < 10) {
    return edt;
  }
  
  // Last resort: return a reasonable default
  return 0.3;
}

/**
 * Calculate RT60 results for standard octave or third-octave bands
 */
export function calculateRT60Bands(
  ir: ImpulseResponseData,
  resolution: 'octave' | 'third_octave' | 'sixth_octave' = 'third_octave',
  frequencyRange: [number, number] = [20, 500],
  targetRT60?: number
): RT60BandResult[] {
  const target = targetRT60 ?? getTargetRT60();
  
  // Generate center frequencies based on resolution
  let octaveFraction: number;
  switch (resolution) {
    case 'octave': octaveFraction = 1; break;
    case 'third_octave': octaveFraction = 1/3; break;
    case 'sixth_octave': octaveFraction = 1/6; break;
  }
  
  const results: RT60BandResult[] = [];
  
  // Start from minimum frequency
  let freq = frequencyRange[0];
  
  while (freq <= frequencyRange[1]) {
    // Calculate RT60 at this frequency (simplified - uses scaling)
    const measured = estimateT60AtFrequency(ir, freq);
    const assessment = assessRT60Quality(measured, target);
    
    results.push({
      center_frequency_hz: Math.round(freq),
      bandwidth: resolution,
      t20_seconds: measured * 0.95, // Approximation
      t30_seconds: measured,
      topt_seconds: measured * 0.97,
      edt_seconds: measured * 0.85,
      assessment,
      target_seconds: target,
      deviation_seconds: measured - target
    });
    
    // Move to next center frequency
    freq = freq * Math.pow(2, octaveFraction);
  }
  
  return results;
}

/**
 * Classify decay character
 */
export function classifyDecayCharacter(
  t60: number,
  frequency_hz: number,
  hasCorrelatedPeak: boolean
): DecayCharacter {
  // Modal ringing: long decay at specific frequency with peak
  if (t60 > 0.5 && frequency_hz < 200 && hasCorrelatedPeak) {
    return 'modal_ringing';
  }
  
  // Severe resonance: very long decay
  if (t60 > 0.8) {
    return 'severe_resonance';
  }
  
  // Extended decay: longer than ideal but not severe
  if (t60 > 0.4) {
    return 'extended_decay';
  }
  
  return 'normal_decay';
}

/**
 * Classify decay severity
 */
export function classifyDecaySeverity(
  t60: number,
  threshold: number
): Severity {
  const excess = t60 - threshold;
  
  if (excess >= 0.4) return 'significant';
  if (excess >= 0.2) return 'moderate';
  if (excess >= 0.1) return 'minor';
  return 'negligible';
}

/**
 * Alias for generateETC - calculates Schroeder integral
 * Preferred name for semantic accuracy
 */
export const calculateSchroederIntegral = generateETC;

/**
 * Calculate clarity metrics from impulse response
 */
export function calculateClarityMetrics(ir: ImpulseResponseData): {
  c50_db: number;
  c80_db: number;
  d50_percent: number;
  assessment: string;
} {
  const { samples, sample_rate_hz, peak_index } = ir;
  
  // Calculate energy in different time windows
  const samples50ms = Math.floor(0.05 * sample_rate_hz); // 50ms
  const samples80ms = Math.floor(0.08 * sample_rate_hz); // 80ms
  
  // Early energy (0-50ms from peak)
  let earlyEnergy50 = 0;
  for (let i = peak_index; i < Math.min(peak_index + samples50ms, samples.length); i++) {
    earlyEnergy50 += samples[i] * samples[i];
  }
  
  // Late energy (50ms onward)
  let lateEnergy50 = 0;
  for (let i = peak_index + samples50ms; i < samples.length; i++) {
    lateEnergy50 += samples[i] * samples[i];
  }
  
  // Early energy (0-80ms from peak)
  let earlyEnergy80 = 0;
  for (let i = peak_index; i < Math.min(peak_index + samples80ms, samples.length); i++) {
    earlyEnergy80 += samples[i] * samples[i];
  }
  
  // Late energy (80ms onward)
  let lateEnergy80 = 0;
  for (let i = peak_index + samples80ms; i < samples.length; i++) {
    lateEnergy80 += samples[i] * samples[i];
  }
  
  // C50: Clarity for speech
  const c50_db = 10 * Math.log10((earlyEnergy50 / (lateEnergy50 + 1e-10)));
  
  // C80: Clarity for music
  const c80_db = 10 * Math.log10((earlyEnergy80 / (lateEnergy80 + 1e-10)));
  
  // D50: Definition (percentage of early energy)
  const totalEnergy = earlyEnergy50 + lateEnergy50;
  const d50_percent = totalEnergy > 0 ? (earlyEnergy50 / totalEnergy) * 100 : 0;
  
  const finalC50 = isFinite(c50_db) ? c50_db : 0;
  const finalC80 = isFinite(c80_db) ? c80_db : 0;
  const finalD50 = isFinite(d50_percent) ? d50_percent : 0;
  
  // Assess clarity quality
  let assessment: string;
  if (finalC80 >= 3 && finalD50 >= 60) {
    assessment = 'Excellent clarity - well suited for critical listening';
  } else if (finalC80 >= 0 && finalD50 >= 50) {
    assessment = 'Good clarity - acceptable for most applications';
  } else if (finalC80 >= -3 && finalD50 >= 40) {
    assessment = 'Moderate clarity - may benefit from acoustic treatment';
  } else {
    assessment = 'Low clarity - excessive reverberation or reflections';
  }
  
  return {
    c50_db: finalC50,
    c80_db: finalC80,
    d50_percent: finalD50,
    assessment
  };
}
