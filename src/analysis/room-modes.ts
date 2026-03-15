/**
 * Room Mode Calculation and Analysis
 * 
 * Calculates theoretical room modes and correlates with detected peaks.
 */

import type { TheoreticalMode, RoomDimensions, DetectedPeak, ModeCorrelation } from '../types/index.js';

// Constants
const SPEED_OF_SOUND = 343; // m/s at 20°C
const MODE_CLUSTER_THRESHOLD_HZ = 5; // Modes within 5 Hz are considered clustered
const MODE_GAP_THRESHOLD_HZ = 15; // Gaps larger than 15 Hz are flagged
const MODE_GAP_SIGNIFICANT_HZ = 30; // Gaps larger than 30 Hz are significant
const MODE_GAP_MODERATE_HZ = 20; // Gaps larger than 20 Hz are moderate

/**
 * Calculate axial modes for a single dimension
 */
function calculateAxialModes(dimension: number, maxFreq: number, dimensionName: string): TheoreticalMode[] {
  const modes: TheoreticalMode[] = [];
  let order = 1;
  
  while (true) {
    const frequency = (order * SPEED_OF_SOUND) / (2 * dimension);
    if (frequency > maxFreq) break;
    
    modes.push({
      frequency_hz: frequency,
      mode_type: 'axial',
      dimension: dimensionName,
      order,
      detected_in_measurement: false
    });
    
    order++;
  }
  
  return modes;
}

/**
 * Calculate tangential modes
 */
function calculateTangentialModes(
  dim1: number,
  dim2: number,
  maxFreq: number,
  dimNames: [string, string]
): TheoreticalMode[] {
  const modes: TheoreticalMode[] = [];
  
  for (let n1 = 1; n1 <= 10; n1++) {
    for (let n2 = 1; n2 <= 10; n2++) {
      const frequency = (SPEED_OF_SOUND / 2) * Math.sqrt(
        Math.pow(n1 / dim1, 2) + Math.pow(n2 / dim2, 2)
      );
      
      if (frequency > maxFreq) continue;
      
      modes.push({
        frequency_hz: frequency,
        mode_type: 'tangential',
        dimension: `${dimNames[0]}-${dimNames[1]}`,
        order: n1 * 10 + n2, // Simple encoding
        detected_in_measurement: false
      });
    }
  }
  
  return modes;
}

/**
 * Calculate oblique modes
 */
function calculateObliqueModes(
  dimensions: RoomDimensions,
  maxFreq: number
): TheoreticalMode[] {
  const modes: TheoreticalMode[] = [];
  const { length, width, height } = dimensions;
  
  for (let nx = 1; nx <= 5; nx++) {
    for (let ny = 1; ny <= 5; ny++) {
      for (let nz = 1; nz <= 5; nz++) {
        const frequency = (SPEED_OF_SOUND / 2) * Math.sqrt(
          Math.pow(nx / length, 2) + 
          Math.pow(ny / width, 2) + 
          Math.pow(nz / height, 2)
        );
        
        if (frequency > maxFreq) continue;
        
        modes.push({
          frequency_hz: frequency,
          mode_type: 'oblique',
          dimension: 'L-W-H',
          order: nx * 100 + ny * 10 + nz,
          detected_in_measurement: false
        });
      }
    }
  }
  
  return modes;
}

/**
 * Calculate all theoretical room modes
 */
export function calculateTheoreticalModes(
  dimensions: RoomDimensions,
  maxFrequency: number = 300
): TheoreticalMode[] {
  const modes: TheoreticalMode[] = [];
  
  // Axial modes (strongest)
  modes.push(...calculateAxialModes(dimensions.length, maxFrequency, 'Length'));
  modes.push(...calculateAxialModes(dimensions.width, maxFrequency, 'Width'));
  modes.push(...calculateAxialModes(dimensions.height, maxFrequency, 'Height'));
  
  // Tangential modes (medium strength)
  modes.push(...calculateTangentialModes(dimensions.length, dimensions.width, maxFrequency, ['Length', 'Width']));
  modes.push(...calculateTangentialModes(dimensions.length, dimensions.height, maxFrequency, ['Length', 'Height']));
  modes.push(...calculateTangentialModes(dimensions.width, dimensions.height, maxFrequency, ['Width', 'Height']));
  
  // Oblique modes (weakest, usually not significant)
  // Only calculate if maxFrequency is low enough to keep count reasonable
  if (maxFrequency <= 200) {
    modes.push(...calculateObliqueModes(dimensions, maxFrequency));
  }
  
  // Sort by frequency
  modes.sort((a, b) => a.frequency_hz - b.frequency_hz);
  
  return modes;
}

/**
 * Correlate a peak with theoretical modes
 */
export function correlatePeakWithModes(
  peakFreq: number,
  theoreticalModes: TheoreticalMode[],
  tolerancePercent: number = 5
): ModeCorrelation | undefined {
  let bestMatch: { mode: TheoreticalMode; error: number } | null = null;
  
  for (const mode of theoreticalModes) {
    const error = Math.abs(peakFreq - mode.frequency_hz);
    const errorPercent = (error / mode.frequency_hz) * 100;
    
    if (errorPercent <= tolerancePercent) {
      if (!bestMatch || error < bestMatch.error) {
        bestMatch = { mode, error };
      }
    }
  }
  
  if (bestMatch) {
    const errorPercent = (bestMatch.error / bestMatch.mode.frequency_hz) * 100;
    
    return {
      theoretical_mode_hz: bestMatch.mode.frequency_hz,
      mode_type: bestMatch.mode.mode_type,
      dimension: bestMatch.mode.dimension,
      order: bestMatch.mode.order,
      match_error_percent: errorPercent
    };
  }
  
  return undefined;
}

/**
 * Correlate all peaks with modes
 */
export function correlatePeaksWithModes(
  peaks: DetectedPeak[],
  theoreticalModes: TheoreticalMode[]
): DetectedPeak[] {
  return peaks.map(peak => {
    const correlation = correlatePeakWithModes(peak.frequency_hz, theoreticalModes);
    
    if (correlation) {
      return {
        ...peak,
        mode_correlation: correlation,
        classification: {
          type: `Room mode (${correlation.mode_type})`,
          confidence: correlation.match_error_percent < 2 ? 'high' : 'medium',
          reasoning: `Matches theoretical ${correlation.dimension} mode #${correlation.order} at ${correlation.theoretical_mode_hz.toFixed(1)} Hz (${correlation.match_error_percent.toFixed(1)}% error)`
        }
      };
    }
    
    return peak;
  });
}

/**
 * Calculate Schroeder frequency
 * Below this frequency, room modes dominate; above it, the room is more diffuse
 */
export function calculateSchroederFrequency(
  dimensions: RoomDimensions,
  rt60: number = 0.3 // Default RT60 in seconds
): number {
  const volume = dimensions.length * dimensions.width * dimensions.height;
  return 2000 * Math.sqrt(rt60 / volume);
}

/**
 * Assess mode distribution quality
 */
export function assessModeDistribution(
  theoreticalModes: TheoreticalMode[]
): {
  mode_spacing_quality: 'good' | 'fair' | 'poor';
  problematic_clusters: Array<{ frequencies_hz: number[]; severity: 'significant' | 'moderate' | 'minor' }>;
  mode_gaps: Array<{ range_hz: [number, number]; severity: 'significant' | 'moderate' | 'minor' }>;
} {
  // Focus on modes below 200 Hz where they're most problematic
  const lowModes = theoreticalModes.filter(m => m.frequency_hz < 200);
  
  const clusters: Array<{ frequencies_hz: number[]; severity: 'significant' | 'moderate' | 'minor' }> = [];
  const gaps: Array<{ range_hz: [number, number]; severity: 'significant' | 'moderate' | 'minor' }> = [];
  
  // Detect clusters (modes within MODE_CLUSTER_THRESHOLD_HZ)
  for (let i = 0; i < lowModes.length - 1; i++) {
    const cluster: number[] = [lowModes[i].frequency_hz];
    let j = i + 1;
    
    while (j < lowModes.length && lowModes[j].frequency_hz - lowModes[j - 1].frequency_hz < MODE_CLUSTER_THRESHOLD_HZ) {
      cluster.push(lowModes[j].frequency_hz);
      j++;
    }
    
    if (cluster.length >= 3) {
      clusters.push({
        frequencies_hz: cluster,
        severity: cluster.length >= 5 ? 'significant' : 'moderate'
      });
      i = j - 1; // Skip processed modes
    }
  }
  
  // Detect gaps (> MODE_GAP_THRESHOLD_HZ between modes)
  for (let i = 0; i < lowModes.length - 1; i++) {
    const gap = lowModes[i + 1].frequency_hz - lowModes[i].frequency_hz;
    
    if (gap > MODE_GAP_THRESHOLD_HZ) {
      gaps.push({
        range_hz: [lowModes[i].frequency_hz, lowModes[i + 1].frequency_hz],
        severity: gap > MODE_GAP_SIGNIFICANT_HZ ? 'significant' 
          : gap > MODE_GAP_MODERATE_HZ ? 'moderate' 
          : 'minor'
      });
    }
  }
  
  // Overall assessment
  let quality: 'good' | 'fair' | 'poor' = 'good';
  
  if (clusters.filter(c => c.severity === 'significant').length > 0 || gaps.filter(g => g.severity === 'significant').length > 0) {
    quality = 'poor';
  } else if (clusters.length > 2 || gaps.length > 3) {
    quality = 'fair';
  }
  
  return {
    mode_spacing_quality: quality,
    problematic_clusters: clusters,
    mode_gaps: gaps
  };
}
