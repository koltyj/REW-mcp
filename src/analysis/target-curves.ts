/**
 * Target Curve Analysis
 *
 * Compare measurements against target response curves.
 * Supports REW-compatible house curve format.
 * 
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/eqwindow.html
 */

import type { FrequencyResponseData } from '../types/index.js';

export interface TargetCurvePoint {
  frequency_hz: number;
  level_db: number;
}

export interface TargetCurve {
  name: string;
  points: TargetCurvePoint[];
  interpolation: 'linear' | 'log';
}

export interface TargetDeviationStatistics {
  average_deviation_db: number;
  max_positive_deviation_db: number;
  max_negative_deviation_db: number;
  rms_deviation_db: number;
  max_positive_frequency_hz: number;
  max_negative_frequency_hz: number;
}

export interface BandDeviation {
  band_name: string;
  range_hz: [number, number];
  average_deviation_db: number;
  max_deviation_db: number;
  assessment: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor';
}

export interface WorstDeviation {
  frequency_hz: number;
  deviation_db: number;
  type: 'peak' | 'null';
}

export interface TargetDeviationResult {
  target_used: string;
  alignment_offset_db: number;
  deviation_statistics: TargetDeviationStatistics;
  by_band: BandDeviation[];
  worst_deviations: WorstDeviation[];
  overall_grade: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor';
}

// ============================================================================
// Built-in Target Curves
// ============================================================================

/**
 * Flat target curve - 0 dB across all frequencies
 */
export const FLAT_CURVE: TargetCurve = {
  name: 'Flat',
  points: [
    { frequency_hz: 20, level_db: 0 },
    { frequency_hz: 20000, level_db: 0 }
  ],
  interpolation: 'linear'
};

/**
 * REW Room Curve with LF rise and HF fall
 * Per REW EQ Window documentation
 */
export const REW_ROOM_CURVE: TargetCurve = {
  name: 'REW Room Curve',
  points: [
    { frequency_hz: 20, level_db: 6 },    // LF rise
    { frequency_hz: 50, level_db: 4 },
    { frequency_hz: 100, level_db: 2 },
    { frequency_hz: 200, level_db: 0 },   // Transition
    { frequency_hz: 1000, level_db: 0 },  // Flat mid
    { frequency_hz: 4000, level_db: -1 },
    { frequency_hz: 10000, level_db: -3 }, // HF fall
    { frequency_hz: 20000, level_db: -6 }
  ],
  interpolation: 'log'
};

/**
 * Harman target curve approximation
 * ~3 dB bass shelf, slight downward tilt above 1 kHz
 */
export const HARMAN_CURVE: TargetCurve = {
  name: 'Harman',
  points: [
    { frequency_hz: 20, level_db: 4 },
    { frequency_hz: 60, level_db: 4 },
    { frequency_hz: 100, level_db: 3 },
    { frequency_hz: 200, level_db: 1 },
    { frequency_hz: 400, level_db: 0 },
    { frequency_hz: 1000, level_db: 0 },
    { frequency_hz: 2000, level_db: -0.5 },
    { frequency_hz: 4000, level_db: -1 },
    { frequency_hz: 8000, level_db: -2 },
    { frequency_hz: 16000, level_db: -4 },
    { frequency_hz: 20000, level_db: -5 }
  ],
  interpolation: 'log'
};

/**
 * B&K House Curve (studio mixing reference)
 */
export const BK_HOUSE_CURVE: TargetCurve = {
  name: 'B&K House Curve',
  points: [
    { frequency_hz: 20, level_db: 4 },
    { frequency_hz: 50, level_db: 3 },
    { frequency_hz: 100, level_db: 2 },
    { frequency_hz: 200, level_db: 1 },
    { frequency_hz: 500, level_db: 0 },
    { frequency_hz: 1000, level_db: 0 },
    { frequency_hz: 2000, level_db: -1 },
    { frequency_hz: 4000, level_db: -2 },
    { frequency_hz: 8000, level_db: -3 },
    { frequency_hz: 16000, level_db: -4 },
    { frequency_hz: 20000, level_db: -5 }
  ],
  interpolation: 'log'
};

// ============================================================================
// Target Curve Functions
// ============================================================================

/**
 * Get a built-in target curve by name
 */
export function getBuiltInCurve(
  name: 'flat' | 'rew_room_curve' | 'harman' | 'bk_house'
): TargetCurve {
  switch (name) {
    case 'flat': return FLAT_CURVE;
    case 'rew_room_curve': return REW_ROOM_CURVE;
    case 'harman': return HARMAN_CURVE;
    case 'bk_house': return BK_HOUSE_CURVE;
    default: return FLAT_CURVE;
  }
}

/**
 * Parse REW house curve file format
 *
 * Per REW docs: "Custom offset curves loaded from text files
 * with frequency/dB pairs"
 */
export function parseHouseCurve(content: string): TargetCurve {
  const points: TargetCurvePoint[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('*') || line.startsWith('#') || !line.trim()) {
      continue;
    }
    
    // Parse frequency/dB pair
    const parts = line.trim().split(/[\s,\t]+/);
    if (parts.length >= 2) {
      const frequency = parseFloat(parts[0]);
      const level = parseFloat(parts[1]);
      
      if (!isNaN(frequency) && !isNaN(level) && frequency > 0) {
        points.push({ frequency_hz: frequency, level_db: level });
      }
    }
  }
  
  // Sort by frequency
  points.sort((a, b) => a.frequency_hz - b.frequency_hz);
  
  return {
    name: 'Custom House Curve',
    points,
    interpolation: 'log'
  };
}

/**
 * Interpolate target curve level at a specific frequency
 */
export function interpolateTargetLevel(
  curve: TargetCurve,
  frequency: number
): number {
  const { points, interpolation } = curve;
  
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].level_db;
  
  // Find surrounding points
  let lowIdx = 0;
  let highIdx = points.length - 1;
  
  for (let i = 0; i < points.length - 1; i++) {
    if (frequency >= points[i].frequency_hz && frequency <= points[i + 1].frequency_hz) {
      lowIdx = i;
      highIdx = i + 1;
      break;
    }
  }
  
  // Handle out of range
  if (frequency <= points[0].frequency_hz) {
    return points[0].level_db;
  }
  if (frequency >= points[points.length - 1].frequency_hz) {
    return points[points.length - 1].level_db;
  }
  
  // Interpolate
  const lowFreq = points[lowIdx].frequency_hz;
  const highFreq = points[highIdx].frequency_hz;
  const lowLevel = points[lowIdx].level_db;
  const highLevel = points[highIdx].level_db;
  
  let ratio: number;
  if (interpolation === 'log') {
    // Logarithmic interpolation for frequency
    ratio = (Math.log10(frequency) - Math.log10(lowFreq)) / 
            (Math.log10(highFreq) - Math.log10(lowFreq));
  } else {
    // Linear interpolation
    ratio = (frequency - lowFreq) / (highFreq - lowFreq);
  }
  
  return lowLevel + ratio * (highLevel - lowLevel);
}

/**
 * Calculate alignment offset to match measurement level to target
 */
export function calculateAlignmentOffset(
  measurement: FrequencyResponseData,
  target: TargetCurve,
  alignmentFrequencyHz: number = 1000
): number {
  const { frequencies_hz, spl_db } = measurement;
  
  // Find measurement level at alignment frequency
  let measurementLevel = 0;
  for (let i = 0; i < frequencies_hz.length - 1; i++) {
    if (frequencies_hz[i] <= alignmentFrequencyHz && 
        frequencies_hz[i + 1] >= alignmentFrequencyHz) {
      // Interpolate
      const ratio = (alignmentFrequencyHz - frequencies_hz[i]) / 
                   (frequencies_hz[i + 1] - frequencies_hz[i]);
      measurementLevel = spl_db[i] + ratio * (spl_db[i + 1] - spl_db[i]);
      break;
    }
  }
  
  // Get target level at alignment frequency
  const targetLevel = interpolateTargetLevel(target, alignmentFrequencyHz);
  
  // Offset = target - measurement (add this to measurement to match)
  return targetLevel - measurementLevel;
}

/**
 * Assess deviation quality
 */
function assessDeviation(deviationDb: number): 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor' {
  const absDeviation = Math.abs(deviationDb);
  if (absDeviation <= 2) return 'excellent';
  if (absDeviation <= 4) return 'good';
  if (absDeviation <= 6) return 'acceptable';
  if (absDeviation <= 10) return 'needs_work';
  return 'poor';
}

/**
 * Calculate overall grade based on statistics
 */
function calculateOverallGrade(
  stats: TargetDeviationStatistics
): 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor' {
  const { rms_deviation_db, max_positive_deviation_db, max_negative_deviation_db } = stats;
  
  const maxDeviation = Math.max(Math.abs(max_positive_deviation_db), Math.abs(max_negative_deviation_db));
  
  if (rms_deviation_db <= 2 && maxDeviation <= 4) return 'excellent';
  if (rms_deviation_db <= 3 && maxDeviation <= 6) return 'good';
  if (rms_deviation_db <= 5 && maxDeviation <= 10) return 'acceptable';
  if (rms_deviation_db <= 8 && maxDeviation <= 15) return 'needs_work';
  return 'poor';
}

/**
 * Calculate deviation from target
 */
export function calculateTargetDeviation(
  measurement: FrequencyResponseData,
  target: TargetCurve,
  options: {
    alignment_frequency_hz?: number;
    evaluation_range_hz?: [number, number];
  } = {}
): TargetDeviationResult {
  const alignmentFreq = options.alignment_frequency_hz || 1000;
  const evalRange = options.evaluation_range_hz || [20, 20000];
  
  // Calculate alignment offset
  const alignmentOffset = calculateAlignmentOffset(measurement, target, alignmentFreq);
  
  // Calculate deviations at each measurement point
  const deviations: Array<{ frequency: number; deviation: number }> = [];
  
  for (let i = 0; i < measurement.frequencies_hz.length; i++) {
    const freq = measurement.frequencies_hz[i];
    
    // Skip frequencies outside evaluation range
    if (freq < evalRange[0] || freq > evalRange[1]) continue;
    
    const measuredLevel = measurement.spl_db[i] + alignmentOffset;
    const targetLevel = interpolateTargetLevel(target, freq);
    const deviation = measuredLevel - targetLevel;
    
    deviations.push({ frequency: freq, deviation });
  }
  
  if (deviations.length === 0) {
    return {
      target_used: target.name,
      alignment_offset_db: alignmentOffset,
      deviation_statistics: {
        average_deviation_db: 0,
        max_positive_deviation_db: 0,
        max_negative_deviation_db: 0,
        rms_deviation_db: 0,
        max_positive_frequency_hz: 0,
        max_negative_frequency_hz: 0
      },
      by_band: [],
      worst_deviations: [],
      overall_grade: 'acceptable'
    };
  }
  
  // Calculate statistics
  let sumDeviation = 0;
  let sumSquaredDeviation = 0;
  let maxPositive = -Infinity;
  let maxNegative = Infinity;
  let maxPosFreq = 0;
  let maxNegFreq = 0;
  
  for (const { frequency, deviation } of deviations) {
    sumDeviation += deviation;
    sumSquaredDeviation += deviation * deviation;
    
    if (deviation > maxPositive) {
      maxPositive = deviation;
      maxPosFreq = frequency;
    }
    if (deviation < maxNegative) {
      maxNegative = deviation;
      maxNegFreq = frequency;
    }
  }
  
  const avgDeviation = sumDeviation / deviations.length;
  const rmsDeviation = Math.sqrt(sumSquaredDeviation / deviations.length);
  
  // Calculate by frequency bands
  const bands = [
    { name: 'Sub-Bass', range: [20, 60] as [number, number] },
    { name: 'Bass', range: [60, 200] as [number, number] },
    { name: 'Low-Mid', range: [200, 500] as [number, number] },
    { name: 'Mid', range: [500, 2000] as [number, number] },
    { name: 'Upper-Mid', range: [2000, 6000] as [number, number] },
    { name: 'Treble', range: [6000, 20000] as [number, number] }
  ];
  
  const bandDeviations: BandDeviation[] = bands.map(band => {
    const bandDevs = deviations.filter(d => 
      d.frequency >= band.range[0] && d.frequency <= band.range[1]
    );
    
    if (bandDevs.length === 0) {
      return {
        band_name: band.name,
        range_hz: band.range,
        average_deviation_db: 0,
        max_deviation_db: 0,
        assessment: 'acceptable' as const
      };
    }
    
    const avgBandDev = bandDevs.reduce((s, d) => s + d.deviation, 0) / bandDevs.length;
    const maxBandDev = Math.max(...bandDevs.map(d => Math.abs(d.deviation)));
    
    return {
      band_name: band.name,
      range_hz: band.range,
      average_deviation_db: Math.round(avgBandDev * 10) / 10,
      max_deviation_db: Math.round(maxBandDev * 10) / 10,
      assessment: assessDeviation(avgBandDev)
    };
  }).filter(b => b.average_deviation_db !== 0 || b.max_deviation_db !== 0);
  
  // Find worst deviations (top 5 peaks and nulls)
  const sortedByAbs = [...deviations].sort((a, b) => 
    Math.abs(b.deviation) - Math.abs(a.deviation)
  );
  
  const worstDeviations: WorstDeviation[] = sortedByAbs.slice(0, 5).map(d => ({
    frequency_hz: Math.round(d.frequency),
    deviation_db: Math.round(d.deviation * 10) / 10,
    type: d.deviation > 0 ? 'peak' as const : 'null' as const
  }));
  
  const stats: TargetDeviationStatistics = {
    average_deviation_db: Math.round(avgDeviation * 10) / 10,
    max_positive_deviation_db: Math.round(maxPositive * 10) / 10,
    max_negative_deviation_db: Math.round(maxNegative * 10) / 10,
    rms_deviation_db: Math.round(rmsDeviation * 10) / 10,
    max_positive_frequency_hz: Math.round(maxPosFreq),
    max_negative_frequency_hz: Math.round(maxNegFreq)
  };
  
  return {
    target_used: target.name,
    alignment_offset_db: Math.round(alignmentOffset * 10) / 10,
    deviation_statistics: stats,
    by_band: bandDeviations,
    worst_deviations: worstDeviations,
    overall_grade: calculateOverallGrade(stats)
  };
}

/**
 * Create a custom target curve from points
 */
export function createCustomCurve(
  name: string,
  points: TargetCurvePoint[],
  interpolation: 'linear' | 'log' = 'log'
): TargetCurve {
  return {
    name,
    points: [...points].sort((a, b) => a.frequency_hz - b.frequency_hz),
    interpolation
  };
}
