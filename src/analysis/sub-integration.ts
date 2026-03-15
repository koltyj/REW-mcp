/**
 * Subwoofer Integration Analysis
 *
 * Analyzes phase alignment and timing between subwoofer and main speakers
 * at the crossover region.
 */

import type { FrequencyResponseData, ImpulseResponseData, ConfidenceLevel } from '../types/index.js';

export interface CrossoverAnalysis {
  detected_crossover_hz: number;
  mains_rolloff_hz: number;
  sub_rolloff_hz: number;
  overlap_range_hz: [number, number];
  phase_at_crossover_mains_deg: number;
  phase_at_crossover_sub_deg: number;
  phase_difference_deg: number;
  phase_alignment_quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface TimingRecommendation {
  current_delay_ms: number;
  optimal_delay_ms: number;
  adjustment_needed_ms: number;
  alignment_method_used: 'ir_peak' | 'group_delay' | 'phase_match';
  confidence: ConfidenceLevel;
}

export interface PolarityRecommendation {
  current_polarity: 'normal' | 'inverted';
  recommended_polarity: 'normal' | 'inverted';
  invert_recommended: boolean;
  expected_improvement_db: number;
  confidence: ConfidenceLevel;
}

export interface SummationPrediction {
  current_dip_at_crossover_db: number;
  predicted_dip_after_optimization_db: number;
  improvement_db: number;
}

export interface SubIntegrationAnalysis {
  crossover_analysis: CrossoverAnalysis;
  timing_recommendations: TimingRecommendation;
  polarity_recommendation: PolarityRecommendation;
  summation_prediction: SummationPrediction;
  confidence: ConfidenceLevel;
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
 * Find the -3dB or -6dB rolloff point
 */
function findRolloffFrequency(
  fr: FrequencyResponseData,
  targetLevel: number,
  searchDirection: 'ascending' | 'descending'
): number {
  const { frequencies_hz, spl_db } = fr;
  
  if (frequencies_hz.length === 0) return 0;

  // Find max level
  const maxLevel = Math.max(...spl_db);
  const rolloffTarget = maxLevel + targetLevel; // targetLevel is negative (e.g., -3 or -6)

  if (searchDirection === 'ascending') {
    // For sub high rolloff: scan from low to high, find where level drops below target
    // Start from the point of max level and scan upward
    const maxIdx = spl_db.indexOf(maxLevel);
    for (let i = maxIdx; i < frequencies_hz.length; i++) {
      if (spl_db[i] <= rolloffTarget) {
        // Return the frequency where it crosses the rolloff point
        // Interpolate if possible for more accuracy
        if (i > 0 && spl_db[i - 1] > rolloffTarget) {
          return frequencies_hz[i - 1];
        }
        return frequencies_hz[i];
      }
    }
    // If never crosses, return highest frequency
    return frequencies_hz[frequencies_hz.length - 1];
  } else {
    // For mains low rolloff: scan from high to low, find where level drops below target
    // Start from the point of max level and scan downward
    const maxIdx = spl_db.indexOf(maxLevel);
    for (let i = maxIdx; i >= 0; i--) {
      if (spl_db[i] <= rolloffTarget) {
        // Return the frequency where it crosses the rolloff point
        if (i < frequencies_hz.length - 1 && spl_db[i + 1] > rolloffTarget) {
          return frequencies_hz[i + 1];
        }
        return frequencies_hz[i];
      }
    }
    // If never crosses, return lowest frequency
    return frequencies_hz[0];
  }
}

/**
 * Interpolate phase at a specific frequency
 */
function interpolatePhase(
  fr: FrequencyResponseData,
  targetFreq: number
): number {
  const { frequencies_hz, phase_degrees } = fr;
  
  if (frequencies_hz.length === 0) return 0;

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

  if (lowIdx < 0 || highIdx < 0) {
    // Return closest available phase
    const closest = frequencies_hz.reduce((prev, curr) => 
      Math.abs(curr - targetFreq) < Math.abs(prev - targetFreq) ? curr : prev
    );
    const idx = frequencies_hz.indexOf(closest);
    return phase_degrees[idx] || 0;
  }

  // Linear interpolation
  const ratio = (targetFreq - frequencies_hz[lowIdx]) / (frequencies_hz[highIdx] - frequencies_hz[lowIdx]);
  return (phase_degrees[lowIdx] || 0) + ratio * ((phase_degrees[highIdx] || 0) - (phase_degrees[lowIdx] || 0));
}

/**
 * Interpolate SPL at a specific frequency
 */
function interpolateSPL(
  fr: FrequencyResponseData,
  targetFreq: number
): number {
  const { frequencies_hz, spl_db } = fr;
  
  if (frequencies_hz.length === 0) return 0;

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

  if (lowIdx < 0 || highIdx < 0) {
    // Return closest available SPL
    const closest = frequencies_hz.reduce((prev, curr) => 
      Math.abs(curr - targetFreq) < Math.abs(prev - targetFreq) ? curr : prev
    );
    const idx = frequencies_hz.indexOf(closest);
    return spl_db[idx];
  }

  // Logarithmic interpolation for frequency
  const logLow = Math.log10(frequencies_hz[lowIdx]);
  const logHigh = Math.log10(frequencies_hz[highIdx]);
  const logTarget = Math.log10(targetFreq);
  const ratio = (logTarget - logLow) / (logHigh - logLow);

  return spl_db[lowIdx] + ratio * (spl_db[highIdx] - spl_db[lowIdx]);
}

/**
 * Normalize phase to -180 to 180 range
 */
function normalizePhase(phase: number): number {
  while (phase > 180) phase -= 360;
  while (phase < -180) phase += 360;
  return phase;
}

/**
 * Calculate phase difference accounting for wrapping
 */
function calculatePhaseDifference(phase1: number, phase2: number): number {
  const diff = normalizePhase(phase1 - phase2);
  return diff;
}

/**
 * Estimate crossover frequency from mains and sub measurements
 */
export function estimateCrossoverFrequency(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData
): number {
  // Find where sub rolls off (high end)
  const subHighRolloff = findRolloffFrequency(sub, -6, 'ascending');
  
  // Find where mains rolls off (low end)
  const mainsLowRolloff = findRolloffFrequency(mains, -6, 'descending');
  
  // Crossover is typically in the overlap region
  // Use geometric mean of the rolloff points
  if (subHighRolloff > 0 && mainsLowRolloff > 0) {
    return Math.sqrt(subHighRolloff * mainsLowRolloff);
  }
  
  // Fallback to typical crossover
  return 80;
}

/**
 * Analyze crossover region
 */
export function analyzeCrossover(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  crossoverHz?: number
): CrossoverAnalysis {
  const detectedCrossover = crossoverHz || estimateCrossoverFrequency(mains, sub);
  
  // Find rolloff points
  const subHighRolloff = findRolloffFrequency(sub, -3, 'ascending');
  const mainsLowRolloff = findRolloffFrequency(mains, -3, 'descending');
  
  // Get phase at crossover
  const phaseMainsAtCrossover = interpolatePhase(mains, detectedCrossover);
  const phaseSubAtCrossover = interpolatePhase(sub, detectedCrossover);
  const phaseDifference = calculatePhaseDifference(phaseSubAtCrossover, phaseMainsAtCrossover);
  
  // Determine overlap range
  const overlapLow = Math.min(subHighRolloff, mainsLowRolloff) * 0.5;
  const overlapHigh = Math.max(subHighRolloff, mainsLowRolloff) * 1.5;
  
  // Assess phase alignment quality
  let phaseQuality: 'excellent' | 'good' | 'fair' | 'poor';
  const absPhaseDiff = Math.abs(phaseDifference);
  
  if (absPhaseDiff <= 30) {
    phaseQuality = 'excellent';
  } else if (absPhaseDiff <= 60) {
    phaseQuality = 'good';
  } else if (absPhaseDiff <= 90) {
    phaseQuality = 'fair';
  } else {
    phaseQuality = 'poor';
  }
  
  return {
    detected_crossover_hz: detectedCrossover,
    mains_rolloff_hz: mainsLowRolloff,
    sub_rolloff_hz: subHighRolloff,
    overlap_range_hz: [overlapLow, overlapHigh],
    phase_at_crossover_mains_deg: phaseMainsAtCrossover,
    phase_at_crossover_sub_deg: phaseSubAtCrossover,
    phase_difference_deg: phaseDifference,
    phase_alignment_quality: phaseQuality
  };
}

/**
 * Calculate optimal delay for sub/mains alignment
 * 
 * Uses group delay alignment at crossover frequency.
 */
export function calculateOptimalDelay(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  crossoverHz: number,
  currentDelayMs: number = 0
): TimingRecommendation {
  let confidence: ConfidenceLevel = 'high';
  
  // Get phase at and around crossover
  const phaseMainsAtCrossover = interpolatePhase(mains, crossoverHz);
  const phaseSubAtCrossover = interpolatePhase(sub, crossoverHz);
  
  // Also check phase at frequencies around crossover for group delay estimation
  const freqOffset = crossoverHz * 0.1; // 10% offset
  const phaseMainsLow = interpolatePhase(mains, crossoverHz - freqOffset);
  const phaseMainsHigh = interpolatePhase(mains, crossoverHz + freqOffset);
  const phaseSubLow = interpolatePhase(sub, crossoverHz - freqOffset);
  const phaseSubHigh = interpolatePhase(sub, crossoverHz + freqOffset);
  
  // Estimate group delay (derivative of phase with respect to frequency)
  // Group delay = -dφ/dω = -dφ/(2π*df)
  const mainsGroupDelay = -normalizePhase(phaseMainsHigh - phaseMainsLow) / (2 * Math.PI * 2 * freqOffset);
  const subGroupDelay = -normalizePhase(phaseSubHigh - phaseSubLow) / (2 * Math.PI * 2 * freqOffset);
  
  // Group delay difference in seconds
  const groupDelayDiffS = subGroupDelay - mainsGroupDelay;
  
  // Calculate delay needed for phase alignment at crossover
  // Convert phase difference to delay: delay = phase / (360 * freq)
  const phaseDiff = calculatePhaseDifference(phaseSubAtCrossover, phaseMainsAtCrossover);
  const phaseDelayMs = (phaseDiff / (360 * crossoverHz)) * 1000;
  
  // Use a combination of phase matching and group delay
  // Prioritize phase matching at crossover frequency
  let optimalDelayMs = currentDelayMs + phaseDelayMs;
  
  // Clamp to reasonable range
  if (optimalDelayMs < -20) {
    optimalDelayMs = -20;
    confidence = 'medium';
  } else if (optimalDelayMs > 20) {
    optimalDelayMs = 20;
    confidence = 'medium';
  }
  
  // If group delay suggests a very different value, reduce confidence
  const groupDelayMs = groupDelayDiffS * 1000;
  if (Math.abs(groupDelayMs - phaseDelayMs) > 5) {
    confidence = 'medium';
  }
  
  return {
    current_delay_ms: currentDelayMs,
    optimal_delay_ms: Math.round(optimalDelayMs * 10) / 10,
    adjustment_needed_ms: Math.round((optimalDelayMs - currentDelayMs) * 10) / 10,
    alignment_method_used: 'phase_match',
    confidence
  };
}

/**
 * Analyze polarity recommendation
 * 
 * Determines if inverting sub polarity would improve summation at crossover.
 */
export function analyzePolarity(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  crossoverHz: number,
  currentPolarity: 'normal' | 'inverted' = 'normal'
): PolarityRecommendation {
  // Get magnitude and phase at crossover
  const mainsMag = dbToLinear(interpolateSPL(mains, crossoverHz));
  const subMag = dbToLinear(interpolateSPL(sub, crossoverHz));
  const mainsPhase = interpolatePhase(mains, crossoverHz) * Math.PI / 180;
  let subPhase = interpolatePhase(sub, crossoverHz) * Math.PI / 180;
  
  // If currently inverted, account for it
  if (currentPolarity === 'inverted') {
    subPhase += Math.PI;
  }
  
  // Calculate combined magnitude with current polarity
  const currentReal = mainsMag * Math.cos(mainsPhase) + subMag * Math.cos(subPhase);
  const currentImag = mainsMag * Math.sin(mainsPhase) + subMag * Math.sin(subPhase);
  const currentMag = Math.sqrt(currentReal * currentReal + currentImag * currentImag);
  
  // Calculate combined magnitude with inverted polarity
  const invertedReal = mainsMag * Math.cos(mainsPhase) + subMag * Math.cos(subPhase + Math.PI);
  const invertedImag = mainsMag * Math.sin(mainsPhase) + subMag * Math.sin(subPhase + Math.PI);
  const invertedMag = Math.sqrt(invertedReal * invertedReal + invertedImag * invertedImag);
  
  // Determine which is better
  const currentDb = linearToDb(currentMag);
  const invertedDb = linearToDb(invertedMag);
  const improvement = invertedDb - currentDb;
  
  const shouldInvert = improvement > 1; // Only recommend if improvement > 1 dB
  
  return {
    current_polarity: currentPolarity,
    recommended_polarity: shouldInvert 
      ? (currentPolarity === 'normal' ? 'inverted' : 'normal')
      : currentPolarity,
    invert_recommended: shouldInvert,
    expected_improvement_db: Math.round(Math.max(0, improvement) * 10) / 10,
    confidence: Math.abs(improvement) > 3 ? 'high' : 'medium'
  };
}

/**
 * Predict combined response with given delay and polarity
 */
export function predictCombinedResponse(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  delayMs: number = 0,
  invertPolarity: boolean = false
): FrequencyResponseData {
  const frequencies_hz: number[] = [];
  const spl_db: number[] = [];
  const phase_degrees: number[] = [];
  
  // Use mains frequencies as reference, but limit to bass/crossover region
  const relevantFreqs = mains.frequencies_hz.filter(f => f >= 20 && f <= 500);
  
  for (const freq of relevantFreqs) {
    const mainsMag = dbToLinear(interpolateSPL(mains, freq));
    const subMag = dbToLinear(interpolateSPL(sub, freq));
    const mainsPhase = interpolatePhase(mains, freq) * Math.PI / 180;
    let subPhase = interpolatePhase(sub, freq) * Math.PI / 180;
    
    // Apply delay as phase shift: positive delay = phase lag = negative phase shift
    // phase_shift = -2 * PI * freq * delay
    const delayPhaseShift = -2 * Math.PI * freq * (delayMs / 1000);
    subPhase += delayPhaseShift;
    
    // Apply polarity inversion if requested
    if (invertPolarity) {
      subPhase += Math.PI;
    }
    
    // Sum in complex domain
    const realPart = mainsMag * Math.cos(mainsPhase) + subMag * Math.cos(subPhase);
    const imagPart = mainsMag * Math.sin(mainsPhase) + subMag * Math.sin(subPhase);
    const combinedMag = Math.sqrt(realPart * realPart + imagPart * imagPart);
    const combinedPhase = Math.atan2(imagPart, realPart) * 180 / Math.PI;
    
    frequencies_hz.push(freq);
    spl_db.push(linearToDb(combinedMag));
    phase_degrees.push(combinedPhase);
  }
  
  return { frequencies_hz, spl_db, phase_degrees };
}

/**
 * Calculate dip at crossover from combined response
 */
function calculateDipAtCrossover(
  combined: FrequencyResponseData,
  crossoverHz: number
): number {
  const splAtCrossover = interpolateSPL(combined, crossoverHz);
  
  // Find average level around crossover (but not at crossover)
  let sum = 0;
  let count = 0;
  const lowRange = crossoverHz * 0.5;
  const highRange = crossoverHz * 2;
  
  for (let i = 0; i < combined.frequencies_hz.length; i++) {
    const freq = combined.frequencies_hz[i];
    // Exclude the crossover region itself
    if ((freq >= lowRange && freq <= crossoverHz * 0.8) ||
        (freq >= crossoverHz * 1.2 && freq <= highRange)) {
      sum += combined.spl_db[i];
      count++;
    }
  }
  
  const avgLevel = count > 0 ? sum / count : splAtCrossover;
  
  // Dip is how much lower the crossover is than surrounding levels
  return avgLevel - splAtCrossover;
}

/**
 * Main function: Analyze subwoofer integration
 */
export function analyzeSubIntegration(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  options: {
    crossover_hz?: number;
    current_sub_delay_ms?: number;
    current_sub_polarity?: 'normal' | 'inverted';
  } = {}
): SubIntegrationAnalysis {
  const warnings: string[] = [];
  let overallConfidence: ConfidenceLevel = 'high';
  
  // Validate inputs
  if (mains.frequencies_hz.length === 0) {
    warnings.push('No frequency data in mains measurement');
    overallConfidence = 'low';
  }
  if (sub.frequencies_hz.length === 0) {
    warnings.push('No frequency data in sub measurement');
    overallConfidence = 'low';
  }
  
  // Check for phase data
  const mainsHasPhase = mains.phase_degrees.some(p => p !== 0);
  const subHasPhase = sub.phase_degrees.some(p => p !== 0);
  if (!mainsHasPhase || !subHasPhase) {
    warnings.push('Phase data is limited or missing - results may be less accurate');
    overallConfidence = 'medium';
  }
  
  const currentDelayMs = options.current_sub_delay_ms || 0;
  const currentPolarity = options.current_sub_polarity || 'normal';
  
  // Analyze crossover
  const crossoverAnalysis = analyzeCrossover(mains, sub, options.crossover_hz);
  
  // Get timing recommendation
  const timingRecommendation = calculateOptimalDelay(
    mains,
    sub,
    crossoverAnalysis.detected_crossover_hz,
    currentDelayMs
  );
  
  // Get polarity recommendation
  const polarityRecommendation = analyzePolarity(
    mains,
    sub,
    crossoverAnalysis.detected_crossover_hz,
    currentPolarity
  );
  
  // Calculate current and predicted summation
  const currentCombined = predictCombinedResponse(
    mains,
    sub,
    currentDelayMs,
    currentPolarity === 'inverted'
  );
  
  const optimizedCombined = predictCombinedResponse(
    mains,
    sub,
    timingRecommendation.optimal_delay_ms,
    polarityRecommendation.recommended_polarity === 'inverted'
  );
  
  const currentDip = calculateDipAtCrossover(currentCombined, crossoverAnalysis.detected_crossover_hz);
  const optimizedDip = calculateDipAtCrossover(optimizedCombined, crossoverAnalysis.detected_crossover_hz);
  
  const summationPrediction: SummationPrediction = {
    current_dip_at_crossover_db: Math.round(currentDip * 10) / 10,
    predicted_dip_after_optimization_db: Math.round(optimizedDip * 10) / 10,
    improvement_db: Math.round((currentDip - optimizedDip) * 10) / 10
  };
  
  // Add warnings based on analysis
  if (crossoverAnalysis.phase_alignment_quality === 'poor') {
    warnings.push('Phase alignment at crossover is poor - consider adjusting sub position');
  }
  
  if (Math.abs(timingRecommendation.adjustment_needed_ms) > 10) {
    warnings.push(`Large delay adjustment needed (${timingRecommendation.adjustment_needed_ms} ms) - verify measurements`);
  }
  
  if (currentDip > 6) {
    warnings.push(`Significant dip at crossover (${currentDip.toFixed(1)} dB) - integration needs attention`);
  }
  
  // Combine confidence from sub-analyses
  if (timingRecommendation.confidence === 'low' || polarityRecommendation.confidence === 'low') {
    overallConfidence = 'low';
  } else if (timingRecommendation.confidence === 'medium' || polarityRecommendation.confidence === 'medium') {
    if (overallConfidence === 'high') {
      overallConfidence = 'medium';
    }
  }
  
  return {
    crossover_analysis: crossoverAnalysis,
    timing_recommendations: timingRecommendation,
    polarity_recommendation: polarityRecommendation,
    summation_prediction: summationPrediction,
    confidence: overallConfidence,
    warnings
  };
}

/**
 * Estimate optimal delay from impulse response peaks
 */
export function estimateDelayFromIR(
  mainsIR: ImpulseResponseData,
  subIR: ImpulseResponseData
): { delay_ms: number; confidence: ConfidenceLevel } {
  // Find peak indices
  const mainsPeakIndex = mainsIR.peak_index;
  const subPeakIndex = subIR.peak_index;
  
  // Calculate time difference
  const mainsPeakTimeMs = (mainsPeakIndex / mainsIR.sample_rate_hz) * 1000;
  const subPeakTimeMs = (subPeakIndex / subIR.sample_rate_hz) * 1000;
  
  const delayMs = subPeakTimeMs - mainsPeakTimeMs;
  
  // Confidence based on how clear the peaks are
  const confidence: ConfidenceLevel = 'medium'; // IR peak method is less precise than phase
  
  return { delay_ms: Math.round(delayMs * 10) / 10, confidence };
}
