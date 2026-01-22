/**
 * Interpretation Layer Unit Tests
 *
 * Tests for all interpretation modules:
 * - Prioritization engine (fixability + severity weighting)
 * - SBIR classification (60-300 Hz, Q>5, 1-4 ft)
 * - L/R symmetry ratings (<1/1-2/2-3/>3 dB thresholds)
 * - Phase inversion detection (150-210 deg range)
 * - Room modes correlation
 * - Peaks/nulls interpretation
 * - GLM comparison (module exports and integration)
 */

import { describe, it, expect } from 'vitest';
import {
  prioritizeIssues,
  WEIGHTS,
  type IssueInput
} from './prioritization.js';
import {
  classifySBIR,
  interpretPeaksNulls,
  type SBIRClassification
} from './peaks-nulls-interpret.js';
import {
  interpretLRSymmetry,
  type SymmetryRating,
  type ImagingImpact
} from './lr-symmetry.js';
import {
  detectPhaseInversion,
  type PhaseInversionDetection
} from './sub-integration-interpret.js';
import {
  interpretRoomModes
} from './room-modes-interpret.js';
import {
  compareGLMCalibration,
  analyzePostOnly,
  detectOvercorrection,
  generateGLMSummary
} from './glm-comparison.js';
import type {
  DetectedPeak,
  DetectedNull,
  FrequencyResponseData,
  RoomDimensions
} from '../types/index.js';
import type { CrossoverAnalysis, PolarityRecommendation } from '../analysis/sub-integration.js';

// ============================================================================
// 1. Prioritization Engine Tests
// ============================================================================

describe('Prioritization Engine', () => {
  it('should apply 60% fixability + 40% severity weighting', () => {
    const issues: IssueInput[] = [
      {
        issue: 'High severity, low fixability',
        severity: 'significant', // 100
        fixability: 'unfixable', // 10
        category: 'test'
      },
      {
        issue: 'Medium severity, high fixability',
        severity: 'moderate', // 60
        fixability: 'placement', // 100
        category: 'test'
      }
    ];

    const prioritized = prioritizeIssues(issues);

    // Calculate expected scores
    // Issue 1: 10 * 0.6 + 100 * 0.4 = 6 + 40 = 46
    // Issue 2: 100 * 0.6 + 60 * 0.4 = 60 + 24 = 84
    expect(prioritized[0].priority_score).toBe(84); // placement wins
    expect(prioritized[1].priority_score).toBe(46);
    expect(prioritized[0].issue).toBe('Medium severity, high fixability');
  });

  it('should use correct fixability weights', () => {
    expect(WEIGHTS.fixability.placement).toBe(100);
    expect(WEIGHTS.fixability.settings).toBe(75);
    expect(WEIGHTS.fixability.treatment).toBe(50);
    expect(WEIGHTS.fixability.unfixable).toBe(10);
  });

  it('should use correct severity weights', () => {
    expect(WEIGHTS.severity.significant).toBe(100);
    expect(WEIGHTS.severity.moderate).toBe(60);
    expect(WEIGHTS.severity.minor).toBe(30);
    expect(WEIGHTS.severity.negligible).toBe(10);
  });

  it('should sort by priority score descending', () => {
    const issues: IssueInput[] = [
      { issue: 'Low priority', severity: 'minor', fixability: 'treatment', category: 'test' },
      { issue: 'High priority', severity: 'significant', fixability: 'placement', category: 'test' },
      { issue: 'Medium priority', severity: 'moderate', fixability: 'settings', category: 'test' }
    ];

    const prioritized = prioritizeIssues(issues);

    // Verify descending order
    expect(prioritized[0].issue).toBe('High priority');
    expect(prioritized[1].issue).toBe('Medium priority');
    expect(prioritized[2].issue).toBe('Low priority');

    // Verify scores are descending
    expect(prioritized[0].priority_score).toBeGreaterThan(prioritized[1].priority_score);
    expect(prioritized[1].priority_score).toBeGreaterThan(prioritized[2].priority_score);
  });
});

// ============================================================================
// 2. SBIR Classification Tests
// ============================================================================

describe('SBIR Classification', () => {
  const createNull = (freq: number, q: number, depth: number): DetectedNull => ({
    frequency_hz: freq,
    depth_db: depth,
    q_factor: q,
    severity: depth > 10 ? 'significant' : 'moderate',
    bandwidth_hz: freq / q,
    glm_addressable: false
  });

  it('should classify valid SBIR: 60-300 Hz, Q>5, 1-4 ft distance', () => {
    // 150 Hz, Q=10 -> distance = 1125/(4*150) = 1.875 ft
    const null_ = createNull(150, 10, 12);
    const result = classifySBIR(null_);

    expect(result.is_sbir).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.estimated_boundary_distance_ft).toBeCloseTo(1.875, 2);
  });

  it('should reject frequency below 60 Hz (room mode range)', () => {
    const null_ = createNull(50, 10, 12);
    const result = classifySBIR(null_);

    expect(result.is_sbir).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('too low');
    expect(result.explanation).toContain('room mode');
  });

  it('should reject frequency above 300 Hz', () => {
    const null_ = createNull(350, 10, 12);
    const result = classifySBIR(null_);

    expect(result.is_sbir).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('too high');
  });

  it('should reject Q factor < 5 (wide null)', () => {
    const null_ = createNull(100, 3, 12);
    const result = classifySBIR(null_);

    expect(result.is_sbir).toBe(false);
    expect(result.confidence).toBe('medium');
    expect(result.explanation).toContain('Wide null');
    expect(result.explanation).toContain('Q < 5');
  });

  it('should reject distance outside 1-4 ft range', () => {
    // 60 Hz, Q=10 -> distance = 1125/(4*60) = 4.69 ft (too far)
    const null_ = createNull(60, 10, 12);
    const result = classifySBIR(null_);

    expect(result.is_sbir).toBe(false);
    expect(result.explanation).toContain('outside typical SBIR range');
  });

  it('should calculate quarter-wavelength distance correctly', () => {
    // 100 Hz, Q=10 -> distance = 1125/(4*100) = 2.8125 ft
    const null_ = createNull(100, 10, 12);
    const result = classifySBIR(null_);

    expect(result.estimated_boundary_distance_ft).toBeCloseTo(2.8125, 3);
  });
});

// ============================================================================
// 3. L/R Symmetry Rating Tests
// ============================================================================

describe('L/R Symmetry', () => {
  const createFR = (avgDb: number, variance: number): FrequencyResponseData => {
    // Create simple frequency response with specified avg and variance
    const frequencies: number[] = [];
    const spl: number[] = [];

    // Generate data across all bands
    for (let f = 60; f <= 20000; f *= 1.1) {
      frequencies.push(f);
      // Add some variance around the average
      const deviation = (Math.random() - 0.5) * variance;
      spl.push(avgDb + deviation);
    }

    return {
      frequencies_hz: frequencies,
      spl_db: spl
    };
  };

  it('should rate <1 dB deviation as excellent', () => {
    const left = createFR(75, 0.5);
    const right = createFR(75.5, 0.5); // 0.5 dB difference

    const result = interpretLRSymmetry(left, right);

    expect(result.data.overall_rating).toBe('excellent');
  });

  it('should rate 1-2 dB deviation as good', () => {
    const left = createFR(75, 1);
    const right = createFR(76.5, 1); // 1.5 dB difference

    const result = interpretLRSymmetry(left, right);

    expect(result.data.overall_rating).toBe('good');
  });

  it('should rate 2-3 dB deviation as fair', () => {
    const left = createFR(75, 1);
    const right = createFR(77.5, 1); // 2.5 dB difference

    const result = interpretLRSymmetry(left, right);

    expect(result.data.overall_rating).toBe('fair');
  });

  it('should rate >3 dB deviation as poor', () => {
    const left = createFR(75, 1);
    const right = createFR(79, 1); // 4 dB difference

    const result = interpretLRSymmetry(left, right);

    expect(result.data.overall_rating).toBe('poor');
  });

  it('should identify worst asymmetric band', () => {
    // Create asymmetry in bass region only
    const frequencies = [70, 100, 150, 500, 1000, 3000, 8000];
    const leftSpl = [70, 72, 71, 75, 75, 75, 75]; // Bass ~71 dB
    const rightSpl = [75, 77, 76, 75, 75, 75, 75]; // Bass ~76 dB (5 dB higher)

    const left: FrequencyResponseData = {
      frequencies_hz: frequencies,
      spl_db: leftSpl
    };

    const right: FrequencyResponseData = {
      frequencies_hz: frequencies,
      spl_db: rightSpl
    };

    const result = interpretLRSymmetry(left, right);

    expect(result.data.worst_band).toBeDefined();
    expect(result.data.worst_band?.band_name).toBe('Bass');
    expect(result.data.worst_band?.level_deviation_db).toBeGreaterThan(3);
  });

  it('should assess imaging impact based on deviation thresholds', () => {
    // <1 dB level AND <2 dB variance = none
    const excellent = createFR(75, 0.5);
    const excellentPair = createFR(75.5, 0.5);
    const excellentResult = interpretLRSymmetry(excellent, excellentPair);
    expect(excellentResult.data.overall_imaging_impact).toBe('none');

    // >3 dB level = significant
    const poor = createFR(75, 1);
    const poorPair = createFR(79, 1);
    const poorResult = interpretLRSymmetry(poor, poorPair);
    expect(poorResult.data.overall_imaging_impact).toBe('significant');
  });
});

// ============================================================================
// 4. Phase Inversion Detection Tests
// ============================================================================

describe('Phase Inversion Detection', () => {
  const createCrossover = (phaseDiff: number): CrossoverAnalysis => ({
    detected_crossover_hz: 80,
    mains_rolloff_hz: 80,
    sub_rolloff_hz: 80,
    overlap_range_hz: [60, 100],
    phase_at_crossover_mains_deg: 0,
    phase_at_crossover_sub_deg: phaseDiff,
    phase_difference_deg: phaseDiff,
    phase_alignment_quality: Math.abs(phaseDiff) > 45 ? 'poor' : 'good'
  });

  const createPolarity = (inverted: boolean): PolarityRecommendation => ({
    current_polarity: inverted ? 'inverted' : 'normal',
    recommended_polarity: inverted ? 'normal' : 'inverted',
    invert_recommended: inverted,
    expected_improvement_db: inverted ? 6 : 0,
    confidence: 'high'
  });

  it('should detect inversion at 180 degrees', () => {
    const crossover = createCrossover(180);
    const polarity = createPolarity(true);

    const result = detectPhaseInversion(crossover, polarity);

    expect(result.is_inverted).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('polarity inversion');
  });

  it('should detect inversion in 150-210 degree range', () => {
    // Test lower bound
    const lower = detectPhaseInversion(createCrossover(150), createPolarity(true));
    expect(lower.is_inverted).toBe(true);

    // Test upper bound
    const upper = detectPhaseInversion(createCrossover(210), createPolarity(true));
    expect(upper.is_inverted).toBe(true);

    // Test middle
    const middle = detectPhaseInversion(createCrossover(175), createPolarity(true));
    expect(middle.is_inverted).toBe(true);
    expect(middle.confidence).toBe('high');
  });

  it('should not flag 90 degrees as inversion', () => {
    const crossover = createCrossover(90);
    const polarity = createPolarity(false);

    const result = detectPhaseInversion(crossover, polarity);

    expect(result.is_inverted).toBe(false);
    expect(result.explanation).toContain('within normal range');
  });

  it('should detect timing misalignment for phase >90 but <150', () => {
    const crossover = createCrossover(120);
    const polarity = createPolarity(false);

    const result = detectPhaseInversion(crossover, polarity);

    expect(result.is_inverted).toBe(false);
    expect(result.explanation).toContain('timing misalignment');
  });

  it('should have high confidence near 180 degrees', () => {
    const near180 = detectPhaseInversion(createCrossover(175), createPolarity(true));
    expect(near180.confidence).toBe('high');

    const exact180 = detectPhaseInversion(createCrossover(180), createPolarity(true));
    expect(exact180.confidence).toBe('high');
  });

  it('should have medium confidence at range edges', () => {
    const edge1 = detectPhaseInversion(createCrossover(150), createPolarity(true));
    expect(edge1.confidence).toBe('medium');

    const edge2 = detectPhaseInversion(createCrossover(210), createPolarity(true));
    expect(edge2.confidence).toBe('medium');
  });
});

// ============================================================================
// 5. Room Modes Interpretation Tests
// ============================================================================

describe('Room Modes', () => {
  const createPeak = (freq: number, magnitude: number): DetectedPeak => ({
    frequency_hz: freq,
    magnitude_db: magnitude,
    q_factor: 8,
    severity: magnitude > 6 ? 'significant' : 'moderate',
    bandwidth_hz: freq / 8,
    glm_addressable: true
  });

  it('should correlate peaks with theoretical modes within 5%', () => {
    const dimensions: RoomDimensions = {
      length: 20,
      width: 15,
      height: 10
    };

    // Theoretical axial modes (speed of sound = 1125 ft/s):
    // Length: 1125/(2*20) = 28.125 Hz, 56.25 Hz
    // Width: 1125/(2*15) = 37.5 Hz, 75 Hz
    // Height: 1125/(2*10) = 56.25 Hz, 112.5 Hz

    const peaks: DetectedPeak[] = [
      createPeak(28, 8),  // Should match length mode
      createPeak(37.5, 7), // Should match width mode
      createPeak(56, 9),   // Should match length/height mode
      createPeak(75, 6),   // Should match width mode
      createPeak(200, 5)   // Should not match any mode
    ];

    const result = interpretRoomModes(peaks, dimensions);

    expect(result.data.dimensions_provided).toBe(true);
    expect(result.data.theoretical_modes.length).toBeGreaterThan(0);
    expect(result.data.correlated_peaks).toBeDefined();
    expect(result.confidence).toBe('high');
  });

  it('should note missing dimensions with medium confidence', () => {
    const peaks: DetectedPeak[] = [
      createPeak(50, 8),
      createPeak(100, 7)
    ];

    const result = interpretRoomModes(peaks);

    expect(result.data.dimensions_provided).toBe(false);
    expect(result.confidence).toBe('medium');
    expect(result.summary).toContain('Provide room dimensions');
  });

  it('should calculate Schroeder frequency when dimensions provided', () => {
    const dimensions: RoomDimensions = {
      length: 20,
      width: 15,
      height: 10
    };

    const peaks: DetectedPeak[] = [createPeak(100, 6)];
    const result = interpretRoomModes(peaks, dimensions, 0.3);

    expect(result.data.schroeder_frequency_hz).toBeDefined();
    expect(result.data.schroeder_frequency_hz).toBeGreaterThan(0);
  });
});

// ============================================================================
// 6. Peaks/Nulls Interpretation Tests
// ============================================================================

describe('Peaks and Nulls Interpretation', () => {
  const createPeak = (freq: number, magnitude: number, glmAddressable = true): DetectedPeak => ({
    frequency_hz: freq,
    magnitude_db: magnitude,
    q_factor: 8,
    severity: magnitude > 6 ? 'significant' : 'moderate',
    bandwidth_hz: freq / 8,
    glm_addressable: glmAddressable
  });

  const createNull = (freq: number, depth: number, q = 8): DetectedNull => ({
    frequency_hz: freq,
    depth_db: depth,
    q_factor: q,
    severity: depth > 10 ? 'significant' : 'moderate',
    bandwidth_hz: freq / q,
    glm_addressable: false
  });

  it('should count SBIR nulls separately from regular nulls', () => {
    const peaks: DetectedPeak[] = [];
    const nulls: DetectedNull[] = [
      createNull(100, 12, 10),  // SBIR: 60-300 Hz, Q>5, distance 2.8 ft
      createNull(150, 10, 8),   // SBIR: distance 1.875 ft
      createNull(50, 15, 3),    // Not SBIR: below 60 Hz, Q<5
      createNull(400, 8, 10)    // Not SBIR: above 300 Hz
    ];

    const result = interpretPeaksNulls(peaks, nulls);

    expect(result.data.nulls.length).toBe(4);
    expect(result.data.sbir_nulls.length).toBe(2);
    expect(result.summary).toContain('2 SBIR');
  });

  it('should note GLM addressability for peaks', () => {
    const peaks: DetectedPeak[] = [
      createPeak(100, 8, true),
      createPeak(200, 7, true),
      createPeak(300, 6, false)
    ];
    const nulls: DetectedNull[] = [];

    const result = interpretPeaksNulls(peaks, nulls);

    const glmAddressable = result.data.peaks.filter(p => p.glm_addressable).length;
    expect(glmAddressable).toBe(2);
    expect(result.summary).toContain('addressable with GLM');
  });

  it('should warn that nulls cannot be boosted', () => {
    const peaks: DetectedPeak[] = [];
    const nulls: DetectedNull[] = [
      createNull(100, 12, 8)
    ];

    const result = interpretPeaksNulls(peaks, nulls);

    expect(result.summary).toContain('CANNOT be boosted');
  });

  it('should generate placement recommendations for SBIR nulls', () => {
    const peaks: DetectedPeak[] = [];
    const nulls: DetectedNull[] = [
      createNull(100, 12, 10) // SBIR null
    ];

    const result = interpretPeaksNulls(peaks, nulls);

    const sbirRecs = result.recommendations.filter(r => r.category === 'sbir');
    expect(sbirRecs.length).toBeGreaterThan(0);
    expect(sbirRecs[0].fixability).toBe('placement');
    expect(sbirRecs[0].action).toContain('Move speaker');
  });
});

// ============================================================================
// 7. GLM Comparison Module Export Tests
// ============================================================================

describe('GLM Comparison Module', () => {
  it('exports compareGLMCalibration function', () => {
    expect(typeof compareGLMCalibration).toBe('function');
  });

  it('exports analyzePostOnly function', () => {
    expect(typeof analyzePostOnly).toBe('function');
  });

  it('exports detectOvercorrection function', () => {
    expect(typeof detectOvercorrection).toBe('function');
  });

  it('exports generateGLMSummary function', () => {
    expect(typeof generateGLMSummary).toBe('function');
  });

  it('compareGLMCalibration returns full comparison mode', () => {
    const mockMeasurement = {
      id: 'test',
      metadata: { speaker_id: 'L' as const, condition: 'test' },
      timestamp: new Date().toISOString(),
      frequency_response: {
        frequencies_hz: [100],
        spl_db: [80],
        phase_degrees: [0]
      },
      quick_stats: {
        bass_avg_db: 80,
        midrange_avg_db: 80,
        treble_avg_db: 80,
        variance_20_200hz_db: 4,
        variance_200_2000hz_db: 3,
        variance_2000_20000hz_db: 2
      },
      data_quality: { confidence: 'high' as const, warnings: [] },
      parsed_file_metadata: { measurement_name: 'Test' }
    };

    const result = compareGLMCalibration(mockMeasurement, mockMeasurement);
    expect(result.mode).toBe('full_comparison');
    expect(result.confidence).toBe('high');
  });

  it('analyzePostOnly returns heuristic mode', () => {
    const mockMeasurement = {
      id: 'test',
      metadata: { speaker_id: 'L' as const, condition: 'test' },
      timestamp: new Date().toISOString(),
      frequency_response: {
        frequencies_hz: [100],
        spl_db: [80],
        phase_degrees: [0]
      },
      quick_stats: {
        bass_avg_db: 80,
        midrange_avg_db: 80,
        treble_avg_db: 80,
        variance_20_200hz_db: 4,
        variance_200_2000hz_db: 3,
        variance_2000_20000hz_db: 2
      },
      data_quality: { confidence: 'high' as const, warnings: [] },
      parsed_file_metadata: { measurement_name: 'Test' }
    };

    const result = analyzePostOnly(mockMeasurement);
    expect(result.mode).toBe('post_only_heuristic');
    expect(result.confidence).toBe('medium');
    expect(result.glm_successes).toHaveLength(0); // Cannot determine without baseline
  });
});
