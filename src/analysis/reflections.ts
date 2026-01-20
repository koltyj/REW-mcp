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

// ============================================================================
// Enhanced ETC Analysis (Phase 6)
// Reference: https://www.roomeqwizard.com/help/help_en-GB/html/graph_impulse.html
// ============================================================================

export interface EnhancedReflectionAnalysis {
  direct_sound: {
    arrival_time_ms: number;
    level_db: number;
  };
  
  reflections: Array<{
    delay_ms: number;
    level_relative_db: number;
    estimated_distance_m: number;
    likely_surface: string;
    severity: 'severe' | 'significant' | 'moderate' | 'minor' | 'negligible';
    comb_filter_affected_hz: number[];
  }>;
  
  clarity_metrics: {
    c50_db: number;      // Speech clarity
    c80_db: number;      // Music clarity
    d50: number;         // Definition ratio (0-1)
    itd_gap_ms: number;  // Initial Time Delay
    clarity_assessment: 'excellent' | 'good' | 'acceptable' | 'problematic';
  };
  
  comb_filtering_analysis: {
    risk_level: 'severe' | 'moderate' | 'mild' | 'negligible';
    primary_reflection_delay_ms: number;
    affected_frequencies_hz: number[];
  };
  
  overall_assessment: string;
}

/**
 * Calculate C50 (speech clarity)
 * 
 * C50 = 10 * log10(E_0_50ms / E_50ms_inf)
 * Per industry standard (ISO 3382)
 */
export function calculateC50(ir: ImpulseResponseData): number {
  const { samples, sample_rate_hz, peak_index } = ir;
  
  const samples50ms = Math.floor(0.05 * sample_rate_hz);
  
  // Early energy (0-50ms from peak)
  let earlyEnergy = 0;
  for (let i = peak_index; i < Math.min(peak_index + samples50ms, samples.length); i++) {
    earlyEnergy += samples[i] * samples[i];
  }
  
  // Late energy (50ms onward)
  let lateEnergy = 0;
  for (let i = peak_index + samples50ms; i < samples.length; i++) {
    lateEnergy += samples[i] * samples[i];
  }
  
  // Avoid division by zero
  if (lateEnergy < 1e-10) lateEnergy = 1e-10;
  
  const c50 = 10 * Math.log10(earlyEnergy / lateEnergy);
  return isFinite(c50) ? c50 : 0;
}

/**
 * Calculate C80 (music clarity)
 * 
 * C80 = 10 * log10(E_0_80ms / E_80ms_inf)
 */
export function calculateC80(ir: ImpulseResponseData): number {
  const { samples, sample_rate_hz, peak_index } = ir;
  
  const samples80ms = Math.floor(0.08 * sample_rate_hz);
  
  // Early energy (0-80ms from peak)
  let earlyEnergy = 0;
  for (let i = peak_index; i < Math.min(peak_index + samples80ms, samples.length); i++) {
    earlyEnergy += samples[i] * samples[i];
  }
  
  // Late energy (80ms onward)
  let lateEnergy = 0;
  for (let i = peak_index + samples80ms; i < samples.length; i++) {
    lateEnergy += samples[i] * samples[i];
  }
  
  // Avoid division by zero
  if (lateEnergy < 1e-10) lateEnergy = 1e-10;
  
  const c80 = 10 * Math.log10(earlyEnergy / lateEnergy);
  return isFinite(c80) ? c80 : 0;
}

/**
 * Calculate D50 (Definition)
 * 
 * D50 = E_0_50ms / E_total
 * Returns ratio between 0 and 1
 */
export function calculateD50(ir: ImpulseResponseData): number {
  const { samples, sample_rate_hz, peak_index } = ir;
  
  const samples50ms = Math.floor(0.05 * sample_rate_hz);
  
  // Early energy (0-50ms from peak)
  let earlyEnergy = 0;
  for (let i = peak_index; i < Math.min(peak_index + samples50ms, samples.length); i++) {
    earlyEnergy += samples[i] * samples[i];
  }
  
  // Total energy
  let totalEnergy = 0;
  for (let i = peak_index; i < samples.length; i++) {
    totalEnergy += samples[i] * samples[i];
  }
  
  if (totalEnergy < 1e-10) return 0;
  
  const d50 = earlyEnergy / totalEnergy;
  return Math.min(1, Math.max(0, d50));
}

/**
 * Assess clarity based on C80 and D50
 */
function assessClarity(
  c80: number,
  d50: number
): 'excellent' | 'good' | 'acceptable' | 'problematic' {
  if (c80 >= 3 && d50 >= 0.6) return 'excellent';
  if (c80 >= 0 && d50 >= 0.5) return 'good';
  if (c80 >= -3 && d50 >= 0.4) return 'acceptable';
  return 'problematic';
}

/**
 * Assess comb filtering risk based on reflection strength and delay
 */
function assessCombFilteringRisk(
  reflections: EarlyReflection[]
): 'severe' | 'moderate' | 'mild' | 'negligible' {
  if (reflections.length === 0) return 'negligible';
  
  // Find strongest reflection within critical time window (5-20ms)
  const criticalReflections = reflections.filter(r => 
    r.delay_ms >= 5 && r.delay_ms <= 20 && r.level_relative_db > -15
  );
  
  if (criticalReflections.length === 0) return 'negligible';
  
  const strongestLevel = Math.max(...criticalReflections.map(r => r.level_relative_db));
  
  if (strongestLevel > -6) return 'severe';
  if (strongestLevel > -10) return 'moderate';
  if (strongestLevel > -15) return 'mild';
  return 'negligible';
}

/**
 * Estimate reflecting surface from delay
 * 
 * Per REW docs: timing "indicates additional distance sound traveled"
 */
export function estimateSurfaceFromDelay(
  delayMs: number,
  roomDimensions?: { length: number; width: number; height: number }
): string {
  const pathLengthM = (delayMs / 1000) * SPEED_OF_SOUND;
  const estimatedWallDistance = pathLengthM / 2; // Assume single bounce
  
  if (roomDimensions) {
    // Try to match with room dimensions
    const { length, width, height } = roomDimensions;
    
    if (Math.abs(estimatedWallDistance - width / 2) < 0.3) {
      return 'Side wall';
    }
    if (Math.abs(estimatedWallDistance - height) < 0.3) {
      return 'Ceiling or floor';
    }
    if (Math.abs(estimatedWallDistance - length / 2) < 0.3) {
      return 'Front or rear wall';
    }
  }
  
  // Generic estimates based on typical distances
  if (estimatedWallDistance < 0.5) return 'Desktop or nearby object';
  if (estimatedWallDistance < 1.5) return 'Side wall or desk boundary';
  if (estimatedWallDistance < 3) return 'Side or rear wall';
  if (estimatedWallDistance < 5) return 'Rear wall or ceiling';
  return 'Distant surface or multiple bounces';
}

/**
 * Calculate comb filter frequencies
 * 
 * f_null = (2n-1) * c / (2 * path_difference)
 * f_peak = n * c / path_difference
 */
export function calculateCombFrequencies(
  pathDifferenceM: number,
  maxFrequencyHz: number = 5000
): { nulls_hz: number[]; peaks_hz: number[] } {
  if (pathDifferenceM <= 0) {
    return { nulls_hz: [], peaks_hz: [] };
  }
  
  const nulls: number[] = [];
  const peaks: number[] = [];
  
  // First null frequency
  const firstNullHz = SPEED_OF_SOUND / (2 * pathDifferenceM);
  
  // Generate nulls (odd multiples of first null)
  for (let n = 1; ; n++) {
    const nullFreq = (2 * n - 1) * firstNullHz;
    if (nullFreq > maxFrequencyHz) break;
    nulls.push(Math.round(nullFreq));
  }
  
  // Generate peaks (multiples of fundamental)
  const fundamentalHz = SPEED_OF_SOUND / pathDifferenceM;
  for (let n = 1; ; n++) {
    const peakFreq = n * fundamentalHz;
    if (peakFreq > maxFrequencyHz) break;
    peaks.push(Math.round(peakFreq));
  }
  
  return { nulls_hz: nulls, peaks_hz: peaks };
}

/**
 * Perform enhanced reflection analysis
 * 
 * Combines reflection detection with clarity metrics and comb filtering analysis
 */
export function performEnhancedReflectionAnalysis(
  ir: ImpulseResponseData,
  options: {
    max_reflection_time_ms?: number;
    threshold_db?: number;
    room_dimensions?: { length: number; width: number; height: number };
  } = {}
): EnhancedReflectionAnalysis {
  // Get direct sound info
  const directSound = findDirectSound(ir);
  
  // Detect reflections
  const rawReflections = detectReflections(ir, {
    max_reflection_time_ms: options.max_reflection_time_ms,
    threshold_db: options.threshold_db
  });
  
  // Enhance reflection data with surface estimates and comb frequencies
  const enhancedReflections = rawReflections.map(r => {
    const pathLengthM = r.estimated_path_length_m;
    const combFreqs = calculateCombFrequencies(pathLengthM);
    
    return {
      delay_ms: r.delay_ms,
      level_relative_db: r.level_relative_db,
      estimated_distance_m: r.estimated_path_length_m,
      likely_surface: estimateSurfaceFromDelay(r.delay_ms, options.room_dimensions),
      severity: r.severity,
      comb_filter_affected_hz: combFreqs.nulls_hz.slice(0, 5)
    };
  });
  
  // Calculate clarity metrics
  const c50 = calculateC50(ir);
  const c80 = calculateC80(ir);
  const d50 = calculateD50(ir);
  const itdResult = calculateITDGap(directSound.arrival_time_ms, rawReflections);
  
  // Assess comb filtering
  const combRisk = assessCombFilteringRisk(rawReflections);
  const primaryReflection = rawReflections.length > 0 
    ? rawReflections.reduce((strongest, r) => 
        r.level_relative_db > strongest.level_relative_db ? r : strongest
      )
    : null;
  
  const primaryCombFreqs = primaryReflection 
    ? calculateCombFrequencies(primaryReflection.estimated_path_length_m).nulls_hz.slice(0, 10)
    : [];
  
  // Generate overall assessment
  const clarityAssessment = assessClarity(c80, d50);
  let overallAssessment: string;
  
  if (clarityAssessment === 'excellent' && combRisk === 'negligible') {
    overallAssessment = 'Excellent acoustic environment with clear direct sound and minimal reflections';
  } else if (clarityAssessment === 'good' && combRisk !== 'severe') {
    overallAssessment = 'Good acoustic environment suitable for critical listening';
  } else if (clarityAssessment === 'acceptable') {
    overallAssessment = 'Acceptable acoustics - would benefit from treatment of early reflections';
  } else {
    overallAssessment = 'Room acoustics need attention - significant early reflections affecting clarity';
  }
  
  return {
    direct_sound: {
      arrival_time_ms: directSound.arrival_time_ms,
      level_db: directSound.level_db
    },
    reflections: enhancedReflections,
    clarity_metrics: {
      c50_db: Math.round(c50 * 10) / 10,
      c80_db: Math.round(c80 * 10) / 10,
      d50: Math.round(d50 * 100) / 100,
      itd_gap_ms: itdResult.itd_ms,
      clarity_assessment: clarityAssessment
    },
    comb_filtering_analysis: {
      risk_level: combRisk,
      primary_reflection_delay_ms: primaryReflection?.delay_ms ?? 0,
      affected_frequencies_hz: primaryCombFreqs
    },
    overall_assessment: overallAssessment
  };
}
