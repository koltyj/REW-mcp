/**
 * Reflection Analysis
 * 
 * Detects early reflections from impulse response.
 */

import type { ImpulseResponseData, EarlyReflection, ConfidenceLevel } from '../types/index.js';

const SPEED_OF_SOUND = 343; // m/s

/**
 * Find direct sound peak
 */
export function findDirectSound(ir: ImpulseResponseData): {
  arrival_time_ms: number;
  level_db: number;
  peak_sample_index: number;
} {
  const { samples, sample_rate_hz, peak_index } = ir;
  const peakValue = Math.abs(samples[peak_index]);
  
  return {
    arrival_time_ms: (peak_index / sample_rate_hz) * 1000,
    level_db: 20 * Math.log10(peakValue + 1e-10),
    peak_sample_index: peak_index
  };
}

/**
 * Detect reflections after direct sound
 */
export function detectReflections(
  ir: ImpulseResponseData,
  options: {
    max_reflection_time_ms?: number;
    threshold_db?: number;
  } = {}
): EarlyReflection[] {
  const maxTime = options.max_reflection_time_ms ?? 50;
  const thresholdDb = options.threshold_db ?? -15;
  
  const { samples, sample_rate_hz, peak_index } = ir;
  const directPeak = findDirectSound(ir);
  const directLevel = directPeak.level_db;
  
  const reflections: EarlyReflection[] = [];
  const maxSamples = Math.floor((maxTime / 1000) * sample_rate_hz);
  
  // Search for peaks after direct sound
  const searchEnd = Math.min(peak_index + maxSamples, samples.length - 1);
  
  for (let i = peak_index + 10; i < searchEnd - 1; i++) {
    const currentAbs = Math.abs(samples[i]);
    const prevAbs = Math.abs(samples[i - 1]);
    const nextAbs = Math.abs(samples[i + 1]);
    
    // Local maximum
    if (currentAbs > prevAbs && currentAbs > nextAbs) {
      const levelDb = 20 * Math.log10(currentAbs + 1e-10);
      const relativeDb = levelDb - directLevel;
      
      // Only consider if above threshold
      if (relativeDb >= thresholdDb) {
        const delayMs = ((i - peak_index) / sample_rate_hz) * 1000;
        const pathLength = (delayMs / 1000) * SPEED_OF_SOUND;
        
        reflections.push({
          delay_ms: delayMs,
          level_relative_db: relativeDb,
          level_absolute_db: levelDb,
          estimated_path_length_m: pathLength,
          severity: classifyReflectionSeverity(relativeDb, delayMs)
        });
      }
    }
  }
  
  return reflections;
}

/**
 * Classify reflection severity
 */
function classifyReflectionSeverity(
  relativeDb: number,
  delayMs: number
): 'severe' | 'significant' | 'moderate' | 'minor' | 'negligible' {
  // Early and loud reflections are most problematic
  if (relativeDb > -6 && delayMs < 10) return 'severe';
  if (relativeDb > -10 && delayMs < 15) return 'significant';
  if (relativeDb > -12 && delayMs < 20) return 'moderate';
  if (relativeDb > -15) return 'minor';
  return 'negligible';
}

/**
 * Estimate reflecting surface
 */
export function estimateReflectingSurface(
  pathDifferenceM: number,
  _speakerToListenerDistanceM: number = 2.5
): {
  surface: string;
  confidence: ConfidenceLevel;
  reasoning: string;
} {
  // Path difference tells us how much farther the reflection traveled
  // For a side wall reflection: pathDiff ≈ 2 * distance_to_wall
  
  const estimatedWallDistance = pathDifferenceM / 2;
  
  // Categorize based on typical distances
  if (estimatedWallDistance < 0.5) {
    return {
      surface: 'Desktop or nearby object',
      confidence: 'medium',
      reasoning: `Very short path (${pathDifferenceM.toFixed(2)}m) suggests reflection from nearby surface`
    };
  } else if (estimatedWallDistance < 1.5) {
    return {
      surface: 'Side wall or desk boundary',
      confidence: 'medium',
      reasoning: `Path length (${pathDifferenceM.toFixed(2)}m) consistent with close wall/boundary`
    };
  } else if (estimatedWallDistance < 3) {
    return {
      surface: 'Side or rear wall',
      confidence: 'medium',
      reasoning: `Path length (${pathDifferenceM.toFixed(2)}m) suggests wall reflection`
    };
  } else if (estimatedWallDistance < 5) {
    return {
      surface: 'Rear wall or ceiling',
      confidence: 'low',
      reasoning: `Long path (${pathDifferenceM.toFixed(2)}m) suggests distant surface`
    };
  } else {
    return {
      surface: 'Unknown distant surface',
      confidence: 'low',
      reasoning: `Very long path (${pathDifferenceM.toFixed(2)}m) - multiple reflections or error`
    };
  }
}

/**
 * Analyze comb filtering from a reflection
 */
export function analyzeCombFiltering(
  delayMs: number
): {
  affected_frequencies_hz: number[];
  first_null_hz: number;
  pattern: string;
} {
  const delaySeconds = delayMs / 1000;
  
  // Nulls occur at odd multiples of 1/(2*delay)
  // Peaks occur at multiples of 1/delay
  const firstNullHz = 1 / (2 * delaySeconds);
  const fundamentalHz = 1 / delaySeconds;
  
  // Generate affected frequencies (first 5 nulls)
  const affectedFrequencies: number[] = [];
  for (let n = 1; n <= 5; n++) {
    const nullFreq = (2 * n - 1) * firstNullHz;
    if (nullFreq < 20000) {
      affectedFrequencies.push(nullFreq);
    }
  }
  
  const pattern = `Nulls at ${firstNullHz.toFixed(0)} Hz and odd multiples; peaks at ${fundamentalHz.toFixed(0)} Hz multiples`;
  
  return {
    affected_frequencies_hz: affectedFrequencies,
    first_null_hz: firstNullHz,
    pattern
  };
}

/**
 * Calculate Initial Time Delay (ITD) gap
 */
export function calculateITDGap(
  _directArrivalMs: number,
  reflections: EarlyReflection[]
): {
  itd_ms: number;
  assessment: 'excellent' | 'good' | 'acceptable' | 'short' | 'poor';
} {
  if (reflections.length === 0) {
    return {
      itd_ms: Infinity,
      assessment: 'excellent'
    };
  }
  
  // Find first significant reflection
  const firstReflection = reflections.reduce((earliest, r) => 
    r.delay_ms < earliest.delay_ms ? r : earliest
  );
  
  const itd_ms = firstReflection.delay_ms;
  
  // Assess quality (Haas effect threshold is ~20-30ms)
  let assessment: 'excellent' | 'good' | 'acceptable' | 'short' | 'poor';
  if (itd_ms >= 30) assessment = 'excellent';
  else if (itd_ms >= 20) assessment = 'good';
  else if (itd_ms >= 10) assessment = 'acceptable';
  else if (itd_ms >= 5) assessment = 'short';
  else assessment = 'poor';
  
  return { itd_ms, assessment };
}
