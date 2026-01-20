/**
 * Decay Time Analysis
 * 
 * Estimates T60/T30/T20/Topt decay times from waterfall data or impulse response.
 * 
 * References:
 * - https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html
 * - https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60decay.html
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
 * Generate Energy Time Curve (ETC) from impulse response
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
 * Calculate EDT (Early Decay Time) per REW docs
 * 
 * Measures slope from 0 dB to -10 dB on the Schroeder curve,
 * then extrapolates to 60 dB decay.
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
 * Calculate T20 (per REW docs)
 *
 * "Measures slope between -5 dB and -25 dB on the Schroeder curve"
 * Then extrapolates to 60 dB decay.
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
 * Calculate T30 (per REW docs)
 *
 * "Measures slope between -5 dB and -35 dB on the Schroeder curve"
 * Then extrapolates to 60 dB decay.
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
 * Calculate Topt (per REW docs)
 *
 * REW's adaptive measure that "uses a start point based on the intersection
 * of the EDT and T30 regression lines"
 * 
 * This is a simplified implementation that uses the average of available methods.
 */
export function calculateTopt(schroeder: SchroederCurve): number | null {
  const t20 = calculateT20(schroeder);
  const t30 = calculateT30(schroeder);
  const edt = calculateEDT(schroeder);
  
  // Use weighted average prioritizing T30
  const values: number[] = [];
  if (t30 !== null) values.push(t30 * 0.5);
  if (t20 !== null) values.push(t20 * 0.3);
  if (edt !== null) values.push(edt * 0.2);
  
  if (values.length === 0) return null;
  
  const totalWeight = values.length > 0 
    ? (t30 !== null ? 0.5 : 0) + (t20 !== null ? 0.3 : 0) + (edt !== null ? 0.2 : 0)
    : 0;
  
  return values.reduce((a, b) => a + b, 0) / totalWeight;
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
 * Estimate T60 for specific frequency band
 * This is a simplified version - in practice would need filtered IR
 */
export function estimateT60AtFrequency(
  ir: ImpulseResponseData,
  frequency_hz: number
): number {
  // For now, use overall T60 with frequency-dependent scaling
  // A real implementation would apply a bandpass filter around frequency_hz
  const schroeder = buildSchroederCurve(ir);
  const t30 = calculateT30(schroeder);
  
  // Apply rough frequency-dependent scaling
  // Lower frequencies typically decay slower due to room modes
  let scaleFactor = 1.0;
  if (frequency_hz < 80) scaleFactor = 1.4;
  else if (frequency_hz < 150) scaleFactor = 1.2;
  else if (frequency_hz < 300) scaleFactor = 1.1;
  else if (frequency_hz > 2000) scaleFactor = 0.8;
  else if (frequency_hz > 1000) scaleFactor = 0.9;
  
  return (t30 ?? 0.3) * scaleFactor;
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
