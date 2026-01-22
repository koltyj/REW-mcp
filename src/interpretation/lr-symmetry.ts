/**
 * L/R Symmetry Interpretation
 *
 * Analyzes stereo channel symmetry with tiered deviation ratings
 * and imaging impact assessment (ANLZ-03).
 */

import type { FrequencyResponseData, ConfidenceLevel, Severity } from '../types/index.js';

export type SymmetryRating = 'excellent' | 'good' | 'fair' | 'poor';
export type ImagingImpact = 'none' | 'minor' | 'moderate' | 'significant';

export interface BandSymmetry {
  band_name: string;
  frequency_range_hz: [number, number];
  left_avg_db: number;
  left_variance_db: number;
  right_avg_db: number;
  right_variance_db: number;
  level_deviation_db: number;
  variance_deviation_db: number;
  deviation_percentage: number;
  rating: SymmetryRating;
  imaging_impact: ImagingImpact;
}

export interface Recommendation {
  action: string;
  expected_impact: string;
  priority: number;
  fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
  category: string;
}

export interface InterpretedResult<T> {
  data: T;
  summary: string;
  recommendations: Recommendation[];
  severity: Severity;
  confidence: ConfidenceLevel;
}

export interface LRSymmetryData {
  overall_rating: SymmetryRating;
  overall_imaging_impact: ImagingImpact;
  asymmetry_score: number; // 0-1, lower is better
  band_symmetry: BandSymmetry[];
  worst_band: BandSymmetry | null;
}

/**
 * Calculate average SPL and variance in a frequency band
 */
function calculateBandStats(
  frequencies: number[],
  spl: number[],
  minFreq: number,
  maxFreq: number
): { avg: number; variance: number } {
  const values: number[] = [];

  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
      values.push(spl[i]);
    }
  }

  if (values.length === 0) {
    return { avg: 0, variance: 0 };
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const variance = max - min;

  return { avg, variance };
}

/**
 * Rate symmetry based on level deviation
 *
 * Thresholds per RESEARCH.md:
 * - <1 dB = excellent
 * - 1-2 dB = good
 * - 2-3 dB = fair
 * - >3 dB = poor
 */
function rateSymmetry(levelDeviationDb: number): SymmetryRating {
  if (levelDeviationDb < 1) {
    return 'excellent';
  } else if (levelDeviationDb < 2) {
    return 'good';
  } else if (levelDeviationDb < 3) {
    return 'fair';
  } else {
    return 'poor';
  }
}

/**
 * Assess imaging impact from level and variance deviations
 *
 * Thresholds per RESEARCH.md:
 * - <1 dB level AND <2 dB variance = none
 * - <2 dB level AND <4 dB variance = minor
 * - <3 dB level AND <6 dB variance = moderate
 * - otherwise = significant
 */
function assessImagingImpact(
  levelDeviationDb: number,
  varianceDeviationDb: number
): ImagingImpact {
  if (levelDeviationDb < 1 && varianceDeviationDb < 2) {
    return 'none';
  } else if (levelDeviationDb < 2 && varianceDeviationDb < 4) {
    return 'minor';
  } else if (levelDeviationDb < 3 && varianceDeviationDb < 6) {
    return 'moderate';
  } else {
    return 'significant';
  }
}

/**
 * Calculate deviation percentage
 */
function calculateDeviationPercentage(
  leftAvg: number,
  rightAvg: number
): number {
  const avgLevel = (Math.abs(leftAvg) + Math.abs(rightAvg)) / 2;
  if (avgLevel === 0) return 0;

  const deviation = Math.abs(leftAvg - rightAvg);
  return (deviation / avgLevel) * 100;
}

/**
 * Generate plain language summary for L/R symmetry
 */
function generateSummary(data: LRSymmetryData): string {
  const ratingDescription = {
    excellent: 'excellent L/R symmetry',
    good: 'good L/R symmetry with minor deviations',
    fair: 'fair L/R symmetry with noticeable deviations',
    poor: 'poor L/R symmetry with significant deviations'
  }[data.overall_rating];

  const imagingDescription = {
    none: 'minimal impact on stereo imaging',
    minor: 'minor impact on stereo imaging',
    moderate: 'moderate impact on stereo imaging - image may shift or blur',
    significant: 'significant impact on stereo imaging - image will be noticeably skewed'
  }[data.overall_imaging_impact];

  let summary = `Stereo measurements show ${ratingDescription}, with ${imagingDescription}.`;

  if (data.worst_band) {
    summary += ` Worst asymmetry in ${data.worst_band.band_name} band (${data.worst_band.level_deviation_db.toFixed(1)} dB deviation, ${data.worst_band.deviation_percentage.toFixed(1)}%).`;
  }

  return summary;
}

/**
 * Generate recommendations based on symmetry analysis
 */
function generateRecommendations(data: LRSymmetryData): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Priority 1: Significant asymmetry requiring placement fix
  if (data.overall_rating === 'poor' || data.overall_imaging_impact === 'significant') {
    recommendations.push({
      action: 'Check speaker positioning and room boundaries - significant L/R asymmetry detected',
      expected_impact: 'Symmetric placement can reduce deviation to <2 dB, improving stereo imaging',
      priority: 1,
      fixability: 'placement',
      category: 'lr_symmetry'
    });
  }

  // Priority 2: Specific band issues
  if (data.worst_band && data.worst_band.level_deviation_db > 2) {
    const band = data.worst_band;
    recommendations.push({
      action: `Address ${band.band_name} asymmetry (${band.level_deviation_db.toFixed(1)} dB) - check for boundary reflections or speaker toe-in differences`,
      expected_impact: `Improving ${band.band_name} symmetry will center stereo image`,
      priority: 2,
      fixability: 'placement',
      category: 'lr_symmetry'
    });
  }

  // Priority 3: Fair symmetry suggesting fine-tuning
  if (data.overall_rating === 'fair' && data.overall_imaging_impact === 'moderate') {
    recommendations.push({
      action: 'Fine-tune speaker positioning - asymmetry is moderate but correctable',
      expected_impact: 'Symmetric placement can improve imaging clarity',
      priority: 3,
      fixability: 'placement',
      category: 'lr_symmetry'
    });
  }

  // Priority 4: Variance issues suggesting room treatment
  const highVarianceBands = data.band_symmetry.filter(
    b => b.variance_deviation_db > 4 && b.imaging_impact !== 'none'
  );

  if (highVarianceBands.length > 0) {
    recommendations.push({
      action: `High variance asymmetry in ${highVarianceBands.map(b => b.band_name).join(', ')} - consider room treatment to reduce reflections`,
      expected_impact: 'Symmetric room treatment can reduce variance deviation by 3-6 dB',
      priority: 4,
      fixability: 'treatment',
      category: 'lr_symmetry'
    });
  }

  return recommendations;
}

/**
 * Determine overall severity from symmetry analysis
 */
function determineSeverity(data: LRSymmetryData): Severity {
  if (data.overall_rating === 'poor' || data.overall_imaging_impact === 'significant') {
    return 'significant';
  }

  if (data.overall_rating === 'fair' || data.overall_imaging_impact === 'moderate') {
    return 'moderate';
  }

  if (data.overall_rating === 'good' || data.overall_imaging_impact === 'minor') {
    return 'minor';
  }

  return 'negligible';
}

/**
 * Interpret L/R symmetry with tiered deviation ratings
 *
 * Analyzes stereo channel symmetry across frequency bands:
 * - Bass: 60-200 Hz
 * - Midrange: 200-2000 Hz
 * - Upper Midrange: 2000-6000 Hz
 * - Treble: 6000-20000 Hz
 *
 * Rating thresholds:
 * - <1 dB deviation = excellent
 * - 1-2 dB = good
 * - 2-3 dB = fair
 * - >3 dB = poor
 *
 * Imaging impact thresholds:
 * - <1 dB level AND <2 dB variance = none
 * - <2 dB level AND <4 dB variance = minor
 * - <3 dB level AND <6 dB variance = moderate
 * - otherwise = significant
 */
export function interpretLRSymmetry(
  left: FrequencyResponseData,
  right: FrequencyResponseData
): InterpretedResult<LRSymmetryData> {
  // Frequency bands per RESEARCH.md
  const bands = [
    { name: 'Bass', range: [60, 200] as [number, number] },
    { name: 'Midrange', range: [200, 2000] as [number, number] },
    { name: 'Upper Midrange', range: [2000, 6000] as [number, number] },
    { name: 'Treble', range: [6000, 20000] as [number, number] }
  ];

  const bandSymmetry: BandSymmetry[] = bands.map(band => {
    const leftStats = calculateBandStats(
      left.frequencies_hz,
      left.spl_db,
      band.range[0],
      band.range[1]
    );

    const rightStats = calculateBandStats(
      right.frequencies_hz,
      right.spl_db,
      band.range[0],
      band.range[1]
    );

    const levelDeviation = Math.abs(leftStats.avg - rightStats.avg);
    const varianceDeviation = Math.abs(leftStats.variance - rightStats.variance);
    const deviationPercentage = calculateDeviationPercentage(leftStats.avg, rightStats.avg);

    const rating = rateSymmetry(levelDeviation);
    const imagingImpact = assessImagingImpact(levelDeviation, varianceDeviation);

    return {
      band_name: band.name,
      frequency_range_hz: band.range,
      left_avg_db: leftStats.avg,
      left_variance_db: leftStats.variance,
      right_avg_db: rightStats.avg,
      right_variance_db: rightStats.variance,
      level_deviation_db: levelDeviation,
      variance_deviation_db: varianceDeviation,
      deviation_percentage: deviationPercentage,
      rating,
      imaging_impact: imagingImpact
    };
  });

  // Calculate overall rating (worst band drives overall)
  const ratings: SymmetryRating[] = ['excellent', 'good', 'fair', 'poor'];
  const worstRating = bandSymmetry.reduce((worst, band) => {
    const worstIndex = ratings.indexOf(worst);
    const bandIndex = ratings.indexOf(band.rating);
    return bandIndex > worstIndex ? band.rating : worst;
  }, 'excellent' as SymmetryRating);

  // Calculate overall imaging impact (worst band drives overall)
  const impacts: ImagingImpact[] = ['none', 'minor', 'moderate', 'significant'];
  const worstImpact = bandSymmetry.reduce((worst, band) => {
    const worstIndex = impacts.indexOf(worst);
    const bandIndex = impacts.indexOf(band.imaging_impact);
    return bandIndex > worstIndex ? band.imaging_impact : worst;
  }, 'none' as ImagingImpact);

  // Find worst band
  const worstBand = bandSymmetry.reduce((worst, band) => {
    if (!worst) return band;
    return band.level_deviation_db > worst.level_deviation_db ? band : worst;
  }, null as BandSymmetry | null);

  // Calculate asymmetry score (0-1, normalized from deviation percentage)
  const avgDeviationPercentage =
    bandSymmetry.reduce((sum, b) => sum + b.deviation_percentage, 0) / bandSymmetry.length;
  const asymmetryScore = Math.min(1, avgDeviationPercentage / 100);

  const data: LRSymmetryData = {
    overall_rating: worstRating,
    overall_imaging_impact: worstImpact,
    asymmetry_score: asymmetryScore,
    band_symmetry: bandSymmetry,
    worst_band: worstBand
  };

  const summary = generateSummary(data);
  const recommendations = generateRecommendations(data);
  const severity = determineSeverity(data);

  // Confidence is high if we have sufficient data points in all bands
  const hasGoodCoverage = bandSymmetry.every(
    b => left.frequencies_hz.filter(f => f >= b.frequency_range_hz[0] && f <= b.frequency_range_hz[1]).length > 10
  );
  const confidence: ConfidenceLevel = hasGoodCoverage ? 'high' : 'medium';

  return {
    data,
    summary,
    recommendations,
    severity,
    confidence
  };
}
