/**
 * Peak and Null Detection
 * 
 * Detects peaks (local maxima) and nulls (local minima) in frequency response data.
 */

import type { DetectedPeak, DetectedNull, FrequencyResponseData, Severity } from '../types/index.js';

/**
 * Calculate local average SPL around a frequency
 */
function calculateLocalAverage(
  frequencies: number[],
  spl: number[],
  centerIndex: number,
  windowOctaves: number = 0.3
): number {
  const centerFreq = frequencies[centerIndex];
  const minFreq = centerFreq / Math.pow(2, windowOctaves);
  const maxFreq = centerFreq * Math.pow(2, windowOctaves);
  
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < frequencies.length; i++) {
    if (i === centerIndex) continue; // Exclude the center point itself
    if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
      sum += spl[i];
      count++;
    }
  }
  
  return count > 0 ? sum / count : spl[centerIndex];
}

/**
 * Estimate Q factor of a peak
 */
function estimateQFactor(
  frequencies: number[],
  spl: number[],
  peakIndex: number
): number {
  const peakFreq = frequencies[peakIndex];
  const peakLevel = spl[peakIndex];
  const halfPowerLevel = peakLevel - 3; // -3dB points
  
  // Find lower -3dB point
  let lowerIndex = peakIndex;
  while (lowerIndex > 0 && spl[lowerIndex] > halfPowerLevel) {
    lowerIndex--;
  }
  
  // Find upper -3dB point
  let upperIndex = peakIndex;
  while (upperIndex < spl.length - 1 && spl[upperIndex] > halfPowerLevel) {
    upperIndex++;
  }
  
  const bandwidth = frequencies[upperIndex] - frequencies[lowerIndex];
  return bandwidth > 0 ? peakFreq / bandwidth : 1;
}

/**
 * Classify severity based on deviation
 */
function classifySeverity(deviationDb: number): Severity {
  const absDeviation = Math.abs(deviationDb);
  if (absDeviation >= 10) return 'significant';
  if (absDeviation >= 6) return 'moderate';
  if (absDeviation >= 3) return 'minor';
  return 'negligible';
}

/**
 * Determine if GLM can address this issue
 * GLM uses cut-only correction, so it can reduce peaks but not fill nulls
 */
function isGLMAddressable(deviation: number, frequency: number): boolean {
  // GLM focuses on low frequencies (typically < 500 Hz)
  if (frequency > 500) return false;
  
  // GLM can cut peaks but not boost nulls
  if (deviation > 0) {
    // Peak - GLM can address with cut filter
    return deviation >= 3; // Only worth addressing if > 3dB
  } else {
    // Null - GLM cannot boost
    return false;
  }
}

/**
 * Detect peaks in frequency response
 */
export function detectPeaks(
  fr: FrequencyResponseData,
  options: {
    threshold_db?: number;
    min_frequency_hz?: number;
    max_frequency_hz?: number;
  } = {}
): DetectedPeak[] {
  const threshold = options.threshold_db ?? 5.0;
  const minFreq = options.min_frequency_hz ?? 20;
  const maxFreq = options.max_frequency_hz ?? 20000;
  
  const peaks: DetectedPeak[] = [];
  const { frequencies_hz, spl_db } = fr;
  
  // Find local maxima
  for (let i = 1; i < spl_db.length - 1; i++) {
    const freq = frequencies_hz[i];
    if (freq < minFreq || freq > maxFreq) continue;
    
    // Check if it's a local maximum
    if (spl_db[i] > spl_db[i - 1] && spl_db[i] > spl_db[i + 1]) {
      const localAvg = calculateLocalAverage(frequencies_hz, spl_db, i);
      const deviation = spl_db[i] - localAvg;
      
      // Only flag if above threshold
      if (deviation >= threshold) {
        const qFactor = estimateQFactor(frequencies_hz, spl_db, i);
        
        peaks.push({
          frequency_hz: freq,
          level_db: spl_db[i],
          deviation_db: deviation,
          q_factor: qFactor,
          severity: classifySeverity(deviation),
          glm_addressable: isGLMAddressable(deviation, freq)
        });
      }
    }
  }
  
  return peaks;
}

/**
 * Detect nulls in frequency response
 */
export function detectNulls(
  fr: FrequencyResponseData,
  options: {
    threshold_db?: number;
    min_frequency_hz?: number;
    max_frequency_hz?: number;
  } = {}
): DetectedNull[] {
  const threshold = options.threshold_db ?? -6.0;
  const minFreq = options.min_frequency_hz ?? 20;
  const maxFreq = options.max_frequency_hz ?? 20000;
  
  const nulls: DetectedNull[] = [];
  const { frequencies_hz, spl_db } = fr;
  
  // Find local minima
  for (let i = 1; i < spl_db.length - 1; i++) {
    const freq = frequencies_hz[i];
    if (freq < minFreq || freq > maxFreq) continue;
    
    // Check if it's a local minimum
    if (spl_db[i] < spl_db[i - 1] && spl_db[i] < spl_db[i + 1]) {
      const localAvg = calculateLocalAverage(frequencies_hz, spl_db, i);
      const depth = spl_db[i] - localAvg; // Negative value
      
      // Only flag if below threshold
      if (depth <= threshold) {
        const qFactor = estimateQFactor(frequencies_hz, spl_db, i);
        const severity = classifySeverity(depth);
        
        // Determine likely cause and resolution
        let suggested_resolution: string;
        if (freq < 200) {
          suggested_resolution = 'Likely room mode null - try speaker/listener repositioning';
        } else if (qFactor > 5) {
          suggested_resolution = 'Narrow null suggests SBIR (boundary interference) - adjust speaker distance from wall';
        } else {
          suggested_resolution = 'Consider acoustic treatment or repositioning';
        }
        
        nulls.push({
          frequency_hz: freq,
          level_db: spl_db[i],
          depth_db: Math.abs(depth),
          q_factor: qFactor,
          severity,
          glm_addressable: isGLMAddressable(depth, freq),
          suggested_resolution
        });
      }
    }
  }
  
  return nulls;
}

/**
 * Calculate quick statistics for frequency bands
 */
export function calculateQuickStats(fr: FrequencyResponseData): {
  bass_avg_db: number;
  midrange_avg_db: number;
  treble_avg_db: number;
  variance_20_200hz_db: number;
  variance_200_2000hz_db: number;
  variance_2000_20000hz_db: number;
} {
  const { frequencies_hz, spl_db } = fr;
  
  const calculateBandStats = (minFreq: number, maxFreq: number) => {
    const values: number[] = [];
    for (let i = 0; i < frequencies_hz.length; i++) {
      if (frequencies_hz[i] >= minFreq && frequencies_hz[i] <= maxFreq) {
        values.push(spl_db[i]);
      }
    }
    
    if (values.length === 0) return { avg: 0, range_db: 0 };
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range_db = maxVal - minVal;
    
    return { avg, range_db };
  };
  
  const bass = calculateBandStats(20, 200);
  const midrange = calculateBandStats(200, 2000);
  const treble = calculateBandStats(2000, 20000);
  
  return {
    bass_avg_db: bass.avg,
    midrange_avg_db: midrange.avg,
    treble_avg_db: treble.avg,
    variance_20_200hz_db: bass.range_db,
    variance_200_2000hz_db: midrange.range_db,
    variance_2000_20000hz_db: treble.range_db
  };
}
