/**
 * Measurement Averaging
 *
 * Implements REW's averaging methods per official documentation.
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/graph_allspl.html
 */

import type { FrequencyResponseData, ImpulseResponseData, DataQuality, ConfidenceLevel, DataQualityWarning } from '../types/index.js';

export type AveragingMethod = 'rms' | 'db' | 'vector' | 'rms_phase' | 'db_phase';

export interface AveragingOptions {
  method: AveragingMethod;
  align_spl?: boolean;           // Align levels before averaging
  alignment_frequency_range?: [number, number];  // Hz range for alignment
  weighting?: number[];          // Per-measurement weights (0-1)
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
 * Convert dB to linear magnitude
 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear magnitude to dB
 */
function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 1e-10));
}

/**
 * Convert dB to power (for RMS averaging)
 */
function dbToPower(db: number): number {
  return Math.pow(10, db / 10);
}

/**
 * Convert power to dB
 */
function powerToDb(power: number): number {
  return 10 * Math.log10(Math.max(power, 1e-10));
}

/**
 * Calculate average level in a frequency range
 */
function calculateAverageLevel(
  fr: FrequencyResponseData,
  frequencyRange: [number, number]
): number {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < fr.frequencies_hz.length; i++) {
    const freq = fr.frequencies_hz[i];
    if (freq >= frequencyRange[0] && freq <= frequencyRange[1]) {
      sum += fr.spl_db[i];
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Find common frequency grid across measurements
 */
function findCommonFrequencyGrid(
  measurements: FrequencyResponseData[]
): number[] {
  if (measurements.length === 0) return [];
  if (measurements.length === 1) return [...measurements[0].frequencies_hz];

  // Find the minimum and maximum common frequency range
  const minFreqs = measurements.map(m => m.frequencies_hz[0]).filter(f => f !== undefined);
  const maxFreqs = measurements.map(m => m.frequencies_hz[m.frequencies_hz.length - 1]).filter(f => f !== undefined);
  
  if (minFreqs.length === 0 || maxFreqs.length === 0) return [];
  
  let minFreq = Math.max(...minFreqs);
  let maxFreq = Math.min(...maxFreqs);

  // If ranges don't overlap, return empty
  if (minFreq > maxFreq) return [];

  // Use the first measurement's frequencies within the common range (with small tolerance)
  return measurements[0].frequencies_hz.filter(f => f >= minFreq * 0.99 && f <= maxFreq * 1.01);
}

/**
 * Interpolate SPL at a specific frequency
 */
function interpolateSPL(
  fr: FrequencyResponseData,
  targetFreq: number
): { spl: number; phase: number } | null {
  const { frequencies_hz, spl_db, phase_degrees } = fr;

  if (frequencies_hz.length === 0) return null;

  // Handle single point case - exact match with tolerance
  if (frequencies_hz.length === 1) {
    if (Math.abs(frequencies_hz[0] - targetFreq) / targetFreq < 0.01) {
      return { spl: spl_db[0], phase: phase_degrees[0] || 0 };
    }
    return null;
  }

  // Check for exact match first (with small tolerance)
  for (let i = 0; i < frequencies_hz.length; i++) {
    if (Math.abs(frequencies_hz[i] - targetFreq) / targetFreq < 0.001) {
      return { spl: spl_db[i], phase: phase_degrees[i] || 0 };
    }
  }

  // Find surrounding indices
  let lowIdx = -1;
  let highIdx = -1;

  for (let i = 0; i < frequencies_hz.length - 1; i++) {
    if (frequencies_hz[i] <= targetFreq && frequencies_hz[i + 1] >= targetFreq) {
      lowIdx = i;
      highIdx = i + 1;
      break;
    }
  }

  if (lowIdx < 0 || highIdx < 0) return null;

  // Logarithmic interpolation for frequency
  const logLow = Math.log10(frequencies_hz[lowIdx]);
  const logHigh = Math.log10(frequencies_hz[highIdx]);
  const logTarget = Math.log10(targetFreq);
  const ratio = (logTarget - logLow) / (logHigh - logLow);

  // Linear interpolation for SPL and phase
  const spl = spl_db[lowIdx] + ratio * (spl_db[highIdx] - spl_db[lowIdx]);
  const phase = (phase_degrees[lowIdx] || 0) + ratio * ((phase_degrees[highIdx] || 0) - (phase_degrees[lowIdx] || 0));

  return { spl, phase };
}

/**
 * Align SPL before averaging (per REW docs)
 *
 * "remove overall level differences due to different source distances"
 */
export function alignSPL(
  measurements: FrequencyResponseData[],
  frequencyRange: [number, number] = [200, 2000]
): { aligned: FrequencyResponseData[]; offsets_db: number[] } {
  if (measurements.length === 0) {
    return { aligned: [], offsets_db: [] };
  }

  // Calculate average level for each measurement
  const levels = measurements.map(m => calculateAverageLevel(m, frequencyRange));

  // Calculate target level (average of all)
  const targetLevel = levels.reduce((a, b) => a + b, 0) / levels.length;

  // Calculate offsets and apply
  const offsets_db = levels.map(l => targetLevel - l);
  const aligned = measurements.map((m, idx) => ({
    frequencies_hz: [...m.frequencies_hz],
    spl_db: m.spl_db.map(spl => spl + offsets_db[idx]),
    phase_degrees: [...m.phase_degrees]
  }));

  return { aligned, offsets_db };
}

/**
 * RMS Average (per REW docs)
 *
 * "converts dB values to linear magnitudes, squares them, sums and
 * divides by the number of measurements, then takes the square root
 * and converts back to dB"
 * 
 * Phase is not taken into account - measurements are treated as incoherent.
 */
export function rmsAverage(
  measurements: FrequencyResponseData[],
  weights?: number[]
): FrequencyResponseData {
  if (measurements.length === 0) {
    return { frequencies_hz: [], spl_db: [], phase_degrees: [] };
  }

  if (measurements.length === 1) {
    return { ...measurements[0] };
  }

  const commonFreqs = findCommonFrequencyGrid(measurements);
  const avgSpl: number[] = [];
  const avgPhase: number[] = [];

  // Normalize weights
  const normalizedWeights = weights
    ? weights.map(w => w / weights.reduce((a, b) => a + b, 0) * measurements.length)
    : measurements.map(() => 1);

  for (const freq of commonFreqs) {
    let powerSum = 0;
    let phaseSum = 0;
    let validCount = 0;

    for (let i = 0; i < measurements.length; i++) {
      const interpolated = interpolateSPL(measurements[i], freq);
      if (interpolated) {
        const weight = normalizedWeights[i];
        // Square of linear magnitude = power
        powerSum += weight * dbToPower(interpolated.spl);
        phaseSum += weight * interpolated.phase;
        validCount += weight;
      }
    }

    if (validCount > 0) {
      // RMS: sqrt of average power -> dB
      avgSpl.push(powerToDb(powerSum / validCount));
      avgPhase.push(phaseSum / validCount);
    }
  }

  return {
    frequencies_hz: commonFreqs,
    spl_db: avgSpl,
    phase_degrees: avgPhase
  };
}

/**
 * dB Average
 * 
 * Simple arithmetic average of dB values.
 * Useful for target curve derivation with smoothed data.
 */
export function dbAverage(
  measurements: FrequencyResponseData[],
  weights?: number[]
): FrequencyResponseData {
  if (measurements.length === 0) {
    return { frequencies_hz: [], spl_db: [], phase_degrees: [] };
  }

  if (measurements.length === 1) {
    return { ...measurements[0] };
  }

  const commonFreqs = findCommonFrequencyGrid(measurements);
  const avgSpl: number[] = [];
  const avgPhase: number[] = [];

  // Normalize weights
  const normalizedWeights = weights
    ? weights.map(w => w / weights.reduce((a, b) => a + b, 0) * measurements.length)
    : measurements.map(() => 1);

  for (const freq of commonFreqs) {
    let splSum = 0;
    let phaseSum = 0;
    let validCount = 0;

    for (let i = 0; i < measurements.length; i++) {
      const interpolated = interpolateSPL(measurements[i], freq);
      if (interpolated) {
        const weight = normalizedWeights[i];
        splSum += weight * interpolated.spl;
        phaseSum += weight * interpolated.phase;
        validCount += weight;
      }
    }

    if (validCount > 0) {
      avgSpl.push(splSum / validCount);
      avgPhase.push(phaseSum / validCount);
    }
  }

  return {
    frequencies_hz: commonFreqs,
    spl_db: avgSpl,
    phase_degrees: avgPhase
  };
}

/**
 * Vector Average (per REW docs)
 *
 * "averages the currently selected traces taking into account both
 * magnitude and phase"
 *
 * Note: "can exhibit magnitude dips due to phase cancellations"
 * Requires IR data per docs.
 */
export function vectorAverage(
  measurements: FrequencyResponseData[],
  weights?: number[]
): FrequencyResponseData {
  if (measurements.length === 0) {
    return { frequencies_hz: [], spl_db: [], phase_degrees: [] };
  }

  if (measurements.length === 1) {
    return { ...measurements[0] };
  }

  const commonFreqs = findCommonFrequencyGrid(measurements);
  const avgSpl: number[] = [];
  const avgPhase: number[] = [];

  // Normalize weights
  const normalizedWeights = weights
    ? weights.map(w => w / weights.reduce((a, b) => a + b, 0) * measurements.length)
    : measurements.map(() => 1);

  for (const freq of commonFreqs) {
    let realSum = 0;
    let imagSum = 0;
    let validCount = 0;

    for (let i = 0; i < measurements.length; i++) {
      const interpolated = interpolateSPL(measurements[i], freq);
      if (interpolated) {
        const weight = normalizedWeights[i];
        const magnitude = dbToLinear(interpolated.spl);
        const phaseRad = (interpolated.phase * Math.PI) / 180;

        // Convert to complex form and sum
        realSum += weight * magnitude * Math.cos(phaseRad);
        imagSum += weight * magnitude * Math.sin(phaseRad);
        validCount += weight;
      }
    }

    if (validCount > 0) {
      // Average and convert back to magnitude/phase
      const avgReal = realSum / validCount;
      const avgImag = imagSum / validCount;
      const avgMag = Math.sqrt(avgReal * avgReal + avgImag * avgImag);
      const avgPhaseRad = Math.atan2(avgImag, avgReal);

      avgSpl.push(linearToDb(avgMag));
      avgPhase.push((avgPhaseRad * 180) / Math.PI);
    }
  }

  return {
    frequencies_hz: commonFreqs,
    spl_db: avgSpl,
    phase_degrees: avgPhase
  };
}

/**
 * RMS Average with Phase (hybrid method)
 * 
 * Uses RMS for magnitude but also averages phase.
 * Useful for position averaging with phase information.
 */
export function rmsPhaseAverage(
  measurements: FrequencyResponseData[],
  weights?: number[]
): FrequencyResponseData {
  // RMS for magnitude, simple average for phase
  const rmsResult = rmsAverage(measurements, weights);
  const dbResult = dbAverage(measurements, weights);

  return {
    frequencies_hz: rmsResult.frequencies_hz,
    spl_db: rmsResult.spl_db,
    phase_degrees: dbResult.phase_degrees
  };
}

/**
 * Main averaging function - applies specified method
 */
export function averageMeasurements(
  measurements: FrequencyResponseData[],
  options: AveragingOptions
): AveragingResult {
  const warnings: string[] = [];
  let dataQualityWarnings: DataQualityWarning[] = [];
  let confidence: ConfidenceLevel = 'high';

  if (measurements.length < 2) {
    warnings.push('At least 2 measurements required for averaging');
    confidence = 'low';
    return {
      averaged_frequency_response: measurements[0] || { frequencies_hz: [], spl_db: [], phase_degrees: [] },
      method_used: options.method,
      input_measurements: measurements.length,
      frequency_range_hz: measurements[0]
        ? [measurements[0].frequencies_hz[0], measurements[0].frequencies_hz[measurements[0].frequencies_hz.length - 1]]
        : [0, 0],
      spl_alignment_applied: false,
      alignment_offsets_db: [],
      data_quality: { confidence, warnings: dataQualityWarnings },
      warnings
    };
  }

  // Check for consistent frequency ranges
  const freqRanges = measurements.map(m => [m.frequencies_hz[0], m.frequencies_hz[m.frequencies_hz.length - 1]]);
  const validMinFreqs = freqRanges.map(r => r[0]).filter(f => f !== undefined && f > 0);
  const validMaxFreqs = freqRanges.map(r => r[1]).filter(f => f !== undefined && f > 0);

  if (validMinFreqs.length > 1 && validMaxFreqs.length > 1) {
    if (Math.max(...validMinFreqs) / Math.min(...validMinFreqs) > 1.5 || 
        Math.max(...validMaxFreqs) / Math.min(...validMaxFreqs) > 1.5) {
      warnings.push('Measurements have significantly different frequency ranges - common range may be limited');
      confidence = 'medium';
    }
  }

  // Apply SPL alignment if requested
  let measurementsToAverage = measurements;
  let alignmentOffsets: number[] = [];

  if (options.align_spl) {
    const alignmentRange = options.alignment_frequency_range || [200, 2000];
    const aligned = alignSPL(measurements, alignmentRange);
    measurementsToAverage = aligned.aligned;
    alignmentOffsets = aligned.offsets_db;

    // Check if alignment offsets are large
    if (alignmentOffsets.length > 0) {
      const maxOffset = Math.max(...alignmentOffsets.map(Math.abs));
      if (maxOffset > 6) {
        warnings.push(`Large SPL differences detected (up to ${maxOffset.toFixed(1)} dB) - check measurement consistency`);
      }
    }
  }

  // Check weights if provided
  if (options.weighting && options.weighting.length !== measurements.length) {
    warnings.push('Weight count does not match measurement count - using equal weights');
    options.weighting = undefined;
  }

  // Apply averaging method
  let averaged: FrequencyResponseData;

  switch (options.method) {
    case 'rms':
      averaged = rmsAverage(measurementsToAverage, options.weighting);
      break;
    case 'db':
      averaged = dbAverage(measurementsToAverage, options.weighting);
      break;
    case 'vector':
      // Check for phase data
      const hasPhase = measurements.every(m => 
        m.phase_degrees.some(p => p !== 0)
      );
      if (!hasPhase) {
        warnings.push('Vector averaging requires phase data - some measurements lack phase information');
        dataQualityWarnings.push({
          type: 'missing_phase',
          message: 'Vector averaging without full phase data may produce unexpected results',
          severity: 'warning'
        });
        confidence = 'medium';
      }
      averaged = vectorAverage(measurementsToAverage, options.weighting);
      break;
    case 'rms_phase':
      averaged = rmsPhaseAverage(measurementsToAverage, options.weighting);
      break;
    case 'db_phase':
      averaged = dbAverage(measurementsToAverage, options.weighting);
      break;
    default:
      averaged = rmsAverage(measurementsToAverage, options.weighting);
  }

  // Validate result
  if (averaged.frequencies_hz.length === 0) {
    warnings.push('No overlapping frequency data found between measurements');
    confidence = 'low';
    dataQualityWarnings.push({
      type: 'no_overlap',
      message: 'Measurements do not share a common frequency range',
      severity: 'error'
    });
  }

  return {
    averaged_frequency_response: averaged,
    method_used: options.method,
    input_measurements: measurements.length,
    frequency_range_hz: averaged.frequencies_hz.length > 0
      ? [averaged.frequencies_hz[0], averaged.frequencies_hz[averaged.frequencies_hz.length - 1]]
      : [0, 0],
    spl_alignment_applied: options.align_spl ?? false,
    alignment_offsets_db: alignmentOffsets,
    data_quality: { confidence, warnings: dataQualityWarnings },
    warnings
  };
}
