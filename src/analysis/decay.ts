/**
 * Decay Time Analysis
 * 
 * Estimates T60/T30 decay times from waterfall data or impulse response.
 */

import type { ImpulseResponseData, DecayCharacter, Severity } from '../types/index.js';

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
 * Estimate T60 from energy decay curve
 * T60 is the time for sound to decay by 60 dB
 */
export function estimateT60(time_ms: number[], energy_db: number[]): number | null {
  // Find where decay starts (near 0 dB)
  let startIndex = 0;
  for (let i = 0; i < energy_db.length; i++) {
    if (energy_db[i] < -5) {
      startIndex = i;
      break;
    }
  }
  
  // Find -5dB and -35dB points (30dB range for T30 estimation, then double)
  let t5 = -1, t35 = -1;
  
  for (let i = startIndex; i < energy_db.length; i++) {
    if (t5 < 0 && energy_db[i] <= -5) t5 = time_ms[i];
    if (t35 < 0 && energy_db[i] <= -35) {
      t35 = time_ms[i];
      break;
    }
  }
  
  if (t5 >= 0 && t35 >= 0) {
    // T30 is the time for 30dB decay
    const t30 = t35 - t5;
    // T60 is approximately 2 * T30
    return (t30 / 1000) * 2; // Convert to seconds
  }
  
  return null;
}

/**
 * Estimate T60 for specific frequency band
 * This is a simplified version - in practice would need filtered IR
 */
export function estimateT60AtFrequency(
  ir: ImpulseResponseData,
  frequency_hz: number
): number {
  // For now, use overall T60
  // A real implementation would apply a bandpass filter around frequency_hz
  const etc = generateETC(ir);
  const t60 = estimateT60(etc.time_ms, etc.energy_db);
  
  // Apply rough frequency-dependent scaling
  // Lower frequencies typically decay slower
  let scaleFactor = 1.0;
  if (frequency_hz < 100) scaleFactor = 1.3;
  else if (frequency_hz < 200) scaleFactor = 1.15;
  else if (frequency_hz > 1000) scaleFactor = 0.85;
  
  return (t60 ?? 0.3) * scaleFactor;
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
