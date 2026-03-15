/**
 * GLM Comparison Module Unit Tests
 *
 * Tests for GLM comparison logic including:
 * - Proportional threshold classification (50%+, 75%+ boundaries)
 * - Context-dependent unchanged thresholds (by issue size)
 * - Post-only heuristic mode (deep null detection, inference)
 * - Overcorrection detection (bass flatness, null revelation)
 * - Summary generation (cut-only explanation, informational tone)
 */

import { describe, it, expect } from 'vitest';
import {
  compareGLMCalibration,
  analyzePostOnly,
  detectOvercorrection,
  detectOvercorrectionWithComparison,
  generateGLMSummary,
  type GLMComparisonResult
} from './glm-comparison.js';
import type { StoredMeasurement, FrequencyResponseData } from '../types/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock measurement with customizable frequency response.
 */
function createMockMeasurement(overrides: Partial<StoredMeasurement> = {}): StoredMeasurement {
  const defaultFreqResponse: FrequencyResponseData = {
    frequencies_hz: [20, 30, 40, 50, 60, 80, 100, 150, 200, 500, 1000, 5000, 10000, 20000],
    spl_db: [75, 76, 77, 78, 79, 80, 81, 80, 79, 78, 77, 76, 75, 74],
    phase_degrees: Array(14).fill(0)
  };

  return {
    id: 'test-id',
    metadata: { speaker_id: 'L', condition: 'test' },
    timestamp: new Date().toISOString(),
    frequency_response: defaultFreqResponse,
    quick_stats: {
      bass_avg_db: 78,
      midrange_avg_db: 77,
      treble_avg_db: 75,
      variance_20_200hz_db: 4,
      variance_200_2000hz_db: 3,
      variance_2000_20000hz_db: 2
    },
    data_quality: { confidence: 'high', warnings: [] },
    parsed_file_metadata: { measurement_name: 'Test' },
    ...overrides
  };
}

/**
 * Create frequency response with a peak at specific frequency.
 */
function createFrequencyResponseWithPeak(
  baselineDb: number,
  peakFreqHz: number,
  peakMagnitudeDb: number
): FrequencyResponseData {
  const frequencies_hz: number[] = [];
  const spl_db: number[] = [];

  // Generate frequencies from 20 Hz to 500 Hz
  for (let f = 20; f <= 500; f += 10) {
    frequencies_hz.push(f);

    // Create peak at specified frequency (within 5 Hz tolerance)
    if (Math.abs(f - peakFreqHz) < 5) {
      spl_db.push(baselineDb + peakMagnitudeDb);
    } else {
      spl_db.push(baselineDb);
    }
  }

  return {
    frequencies_hz,
    spl_db,
    phase_degrees: Array(frequencies_hz.length).fill(0)
  };
}

/**
 * Create frequency response with a null at specific frequency.
 */
function createFrequencyResponseWithNull(
  baselineDb: number,
  nullFreqHz: number,
  nullDepthDb: number
): FrequencyResponseData {
  const frequencies_hz: number[] = [];
  const spl_db: number[] = [];

  for (let f = 20; f <= 500; f += 10) {
    frequencies_hz.push(f);

    if (Math.abs(f - nullFreqHz) < 5) {
      spl_db.push(baselineDb - nullDepthDb);
    } else {
      spl_db.push(baselineDb);
    }
  }

  return {
    frequencies_hz,
    spl_db,
    phase_degrees: Array(frequencies_hz.length).fill(0)
  };
}

// ============================================================================
// Proportional Threshold Tests (GLM-01, GLM-02)
// ============================================================================

describe('compareGLMCalibration - proportional thresholds', () => {
  it('classifies 50%+ reduction as success', () => {
    // Pre: 8 dB peak, Post: 4 dB peak (50% reduction exactly)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 8)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 4)
    });

    const result = compareGLMCalibration(pre, post);

    expect(result.glm_successes.length).toBeGreaterThan(0);
    expect(result.glm_successes[0].effectiveness).toMatch(/effective/);
  });

  it('classifies 75%+ reduction as highly_effective', () => {
    // Pre: 12 dB peak, Post: 3 dB peak (75% reduction)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 12)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 3)
    });

    const result = compareGLMCalibration(pre, post);

    expect(result.glm_successes.length).toBeGreaterThan(0);
    expect(result.glm_successes[0].effectiveness).toBe('highly_effective');
  });

  it('classifies <50% reduction as partial (observation)', () => {
    // Pre: 10 dB peak, Post: 6 dB peak (40% reduction)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 10)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 6)
    });

    const result = compareGLMCalibration(pre, post);

    // Partial improvement goes to observations, not successes
    const partialObs = result.glm_observations.find(o =>
      o.observation.includes('Partial improvement')
    );
    expect(partialObs).toBeDefined();
    expect(partialObs?.explanation).toContain('40%');
  });

  it('classifies complete elimination as success', () => {
    // Pre: 10 dB peak, Post: no peak (100% reduction)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 10)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 0)
    });

    const result = compareGLMCalibration(pre, post);

    expect(result.glm_successes.length).toBeGreaterThan(0);
    const elimination = result.glm_successes.find(s =>
      s.explanation.includes('completely eliminated')
    );
    expect(elimination).toBeDefined();
  });
});

// ============================================================================
// Context-Dependent Unchanged Threshold Tests
// ============================================================================

describe('compareGLMCalibration - unchanged thresholds', () => {
  it('small issue (<6 dB): <1 dB change = unchanged', () => {
    // Pre: 5 dB peak, Post: 4.5 dB peak (0.5 dB change, 10% reduction)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 5)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 4.5)
    });

    const result = compareGLMCalibration(pre, post);

    // Should be classified as unchanged
    const unchangedObs = result.glm_observations.find(o =>
      o.observation.includes('unchanged')
    );
    expect(unchangedObs).toBeDefined();
    expect(unchangedObs?.explanation).toContain('1 dB change');
  });

  it('medium issue (6-10 dB): <2 dB change = unchanged', () => {
    // Pre: 8 dB peak, Post: 7 dB peak (1 dB change, 12.5% reduction)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 8)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 7)
    });

    const result = compareGLMCalibration(pre, post);

    const unchangedObs = result.glm_observations.find(o =>
      o.observation.includes('unchanged')
    );
    expect(unchangedObs).toBeDefined();
    expect(unchangedObs?.explanation).toContain('2 dB change');
  });

  it('large issue (>10 dB): <3 dB change = unchanged', () => {
    // Pre: 12 dB peak, Post: 10 dB peak (2 dB change, 16.7% reduction)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 12)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 10)
    });

    const result = compareGLMCalibration(pre, post);

    const unchangedObs = result.glm_observations.find(o =>
      o.observation.includes('unchanged')
    );
    expect(unchangedObs).toBeDefined();
    expect(unchangedObs?.explanation).toContain('3 dB change');
  });

  it('boundary test: exactly 6 dB uses 2 dB threshold', () => {
    // Pre: 6 dB (boundary), Post: 5 dB (1 dB change exactly)
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 6)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithPeak(80, 100, 5)
    });

    const result = compareGLMCalibration(pre, post);

    // At 6 dB, threshold is 2 dB, so 1 dB change = unchanged
    const unchangedObs = result.glm_observations.find(o =>
      o.observation.includes('unchanged')
    );
    expect(unchangedObs).toBeDefined();
  });
});

// ============================================================================
// Post-Only Heuristic Mode Tests (GLM-03)
// ============================================================================

describe('analyzePostOnly - heuristic mode', () => {
  it('identifies deep nulls (>10 dB) as beyond GLM scope', () => {
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithNull(80, 63, 15)
    });

    const result = analyzePostOnly(post);

    expect(result.mode).toBe('post_only_heuristic');
    expect(result.confidence).toBe('medium');
    expect(result.glm_persistent.length).toBeGreaterThan(0);
    expect(result.glm_persistent[0].why_glm_cannot_fix.reason).toBe('cut_only_correction');
    expect(result.glm_persistent[0].why_glm_cannot_fix.explanation).toContain('cuts only');
  });

  it('returns empty glm_successes (cannot determine without pre)', () => {
    const post = createMockMeasurement();
    const result = analyzePostOnly(post);

    expect(result.glm_successes).toHaveLength(0);
  });

  it('observes flat bass as likely GLM success', () => {
    const post = createMockMeasurement({
      quick_stats: {
        bass_avg_db: 78,
        midrange_avg_db: 77,
        treble_avg_db: 75,
        variance_20_200hz_db: 3, // Low variance
        variance_200_2000hz_db: 3,
        variance_2000_20000hz_db: 2
      }
    });

    const result = analyzePostOnly(post);

    const varianceObs = result.glm_observations.find(o =>
      o.observation.includes('variance') || o.observation.includes('bass')
    );
    expect(varianceObs).toBeDefined();
  });

  it('notes post-only mode limitation in observations', () => {
    const post = createMockMeasurement();
    const result = analyzePostOnly(post);

    const postOnlyNote = result.glm_observations.find(o =>
      o.observation.includes('Post-only')
    );
    expect(postOnlyNote).toBeDefined();
    expect(postOnlyNote?.explanation).toContain('pre-GLM measurement');
  });

  it('does not detect null revelation in post-only mode', () => {
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithNull(80, 63, 15)
    });

    const result = analyzePostOnly(post);

    expect(result.overcorrection_indicators.null_revelation.detected).toBe(false);
    expect(result.overcorrection_indicators.null_revelation.contrast_increase_db).toBe(0);
  });
});

// ============================================================================
// Overcorrection Detection Tests (GLM-05)
// ============================================================================

describe('detectOvercorrection', () => {
  it('detects bass flatness when <2 dB variance below 40 Hz', () => {
    // Create measurement with very flat 20-40 Hz region
    const frequencies_hz = [20, 25, 30, 35, 40, 50, 100, 200, 500];
    const spl_db = [75, 75.5, 75, 75.3, 75.2, 78, 80, 79, 78]; // <2 dB variance in sub-bass

    const post = createMockMeasurement({
      frequency_response: {
        frequencies_hz,
        spl_db,
        phase_degrees: Array(frequencies_hz.length).fill(0)
      }
    });

    const result = detectOvercorrection(post);

    expect(result.bass_flatness.detected).toBe(true);
    expect(result.bass_flatness.variance_db).toBeLessThan(2);
    expect(result.bass_flatness.threshold_db).toBe(2);
  });

  it('does not flag normal bass variance (>2 dB)', () => {
    const frequencies_hz = [20, 25, 30, 35, 40, 50, 100, 200, 500];
    const spl_db = [73, 76, 74, 77, 75, 78, 80, 79, 78]; // >2 dB variance

    const post = createMockMeasurement({
      frequency_response: {
        frequencies_hz,
        spl_db,
        phase_degrees: Array(frequencies_hz.length).fill(0)
      }
    });

    const result = detectOvercorrection(post);

    expect(result.bass_flatness.detected).toBe(false);
  });

  it('null_revelation is false in post-only mode', () => {
    const post = createMockMeasurement();
    const result = detectOvercorrection(post);

    expect(result.null_revelation.detected).toBe(false);
    expect(result.null_revelation.contrast_increase_db).toBe(0);
  });

  it('handles measurements with no data in 20-40 Hz range', () => {
    const post = createMockMeasurement({
      frequency_response: {
        frequencies_hz: [50, 100, 200, 500],
        spl_db: [78, 80, 79, 78],
        phase_degrees: [0, 0, 0, 0]
      }
    });

    const result = detectOvercorrection(post);

    expect(result.bass_flatness.detected).toBe(false);
    expect(result.bass_flatness.variance_db).toBe(0);
  });
});

describe('detectOvercorrectionWithComparison', () => {
  it('detects null revelation when contrast increases >3 dB', () => {
    // Pre: 6 dB null at 63 Hz
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithNull(80, 63, 6)
    });

    // Post: 10 dB null (contrast increased because surrounding peaks reduced)
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithNull(80, 63, 10)
    });

    const result = detectOvercorrectionWithComparison(pre, post);

    expect(result.null_revelation.detected).toBe(true);
    expect(result.null_revelation.contrast_increase_db).toBeGreaterThan(3);
  });

  it('does not flag minor contrast increase (<3 dB)', () => {
    const pre = createMockMeasurement({
      frequency_response: createFrequencyResponseWithNull(80, 63, 8)
    });
    const post = createMockMeasurement({
      frequency_response: createFrequencyResponseWithNull(80, 63, 10)
    });

    const result = detectOvercorrectionWithComparison(pre, post);

    expect(result.null_revelation.detected).toBe(false);
    expect(result.null_revelation.contrast_increase_db).toBeLessThan(3);
  });

  it('detects bass flatness in comparison mode', () => {
    const frequencies_hz = [20, 25, 30, 35, 40, 50, 100, 200];
    const flatSpl = [75, 75.3, 75.1, 75.2, 75, 78, 80, 79];

    const pre = createMockMeasurement({
      frequency_response: {
        frequencies_hz,
        spl_db: [73, 76, 74, 77, 75, 78, 80, 79], // Pre has variance
        phase_degrees: Array(frequencies_hz.length).fill(0)
      }
    });

    const post = createMockMeasurement({
      frequency_response: {
        frequencies_hz,
        spl_db: flatSpl, // Post is very flat
        phase_degrees: Array(frequencies_hz.length).fill(0)
      }
    });

    const result = detectOvercorrectionWithComparison(pre, post);

    expect(result.bass_flatness.detected).toBe(true);
  });
});

// ============================================================================
// Summary Generation Tests (GLM-04)
// ============================================================================

describe('generateGLMSummary', () => {
  it('includes GLM cut-only explanation for persistent issues', () => {
    const result: GLMComparisonResult = {
      glm_successes: [],
      glm_persistent: [{
        issue: 'Deep null at 63 Hz',
        severity: 'significant',
        measured_depth_db: 15,
        why_glm_cannot_fix: {
          reason: 'cut_only_correction',
          explanation: 'GLM applies cuts only, never boosts. Deep nulls cannot be filled.',
          reference: 'Genelec GLM User Guide'
        },
        recommended_solutions: []
      }],
      glm_observations: [],
      overcorrection_indicators: {
        bass_flatness: { detected: false, variance_db: 4, threshold_db: 2 },
        null_revelation: { detected: false, contrast_increase_db: 0 }
      },
      mode: 'full_comparison',
      confidence: 'high'
    };

    const summary = generateGLMSummary(result);

    expect(summary).toMatch(/cannot|boost|cut|repositioning/i);
    expect(summary).toContain('beyond GLM scope');
  });

  it('uses informational tone for overcorrection (not warning)', () => {
    const result: GLMComparisonResult = {
      glm_successes: [],
      glm_persistent: [],
      glm_observations: [],
      overcorrection_indicators: {
        bass_flatness: { detected: true, variance_db: 1.5, threshold_db: 2 },
        null_revelation: { detected: false, contrast_increase_db: 0 }
      },
      mode: 'full_comparison',
      confidence: 'high'
    };

    const summary = generateGLMSummary(result);

    // Should be informational, not warning
    expect(summary).not.toMatch(/warning|danger|problem/i);
    expect(summary).toMatch(/note|flat/i);
  });

  it('summarizes successful GLM corrections', () => {
    const result: GLMComparisonResult = {
      glm_successes: [
        {
          issue: 'Peak at 100 Hz',
          pre_severity: 'significant',
          pre_deviation_db: 10,
          post_severity: 'minor',
          post_deviation_db: 3,
          glm_action: 'Applied parametric cut filter',
          effectiveness: 'highly_effective',
          explanation: 'Peak reduced from 10.0 dB to 3.0 dB (70% improvement)'
        },
        {
          issue: 'Peak at 150 Hz',
          pre_severity: 'moderate',
          pre_deviation_db: 8,
          post_severity: 'negligible',
          post_deviation_db: 2,
          glm_action: 'Applied parametric cut filter',
          effectiveness: 'highly_effective',
          explanation: 'Peak reduced from 8.0 dB to 2.0 dB (75% improvement)'
        }
      ],
      glm_persistent: [],
      glm_observations: [],
      overcorrection_indicators: {
        bass_flatness: { detected: false, variance_db: 4, threshold_db: 2 },
        null_revelation: { detected: false, contrast_increase_db: 0 }
      },
      mode: 'full_comparison',
      confidence: 'high'
    };

    const summary = generateGLMSummary(result);

    expect(summary).toContain('2 peaks');
    expect(summary).toMatch(/72%|73%/); // Average of 70% and 75%
    expect(summary).toContain('successfully corrected');
  });

  it('generates post-only mode summary with heuristics', () => {
    const result: GLMComparisonResult = {
      glm_successes: [],
      glm_persistent: [{
        issue: 'Deep null at 63 Hz',
        severity: 'significant',
        measured_depth_db: 15,
        why_glm_cannot_fix: {
          reason: 'cut_only_correction',
          explanation: 'GLM applies cuts only',
          reference: ''
        },
        recommended_solutions: []
      }],
      glm_observations: [
        {
          observation: 'Low bass variance detected',
          explanation: 'Variance of 5.0 dB suggests GLM successfully addressed peaks',
          is_expected: true
        }
      ],
      overcorrection_indicators: {
        bass_flatness: { detected: false, variance_db: 5, threshold_db: 2 },
        null_revelation: { detected: false, contrast_increase_db: 0 }
      },
      mode: 'post_only_heuristic',
      confidence: 'medium'
    };

    const summary = generateGLMSummary(result);

    expect(summary).toContain('Post-GLM analysis');
    expect(summary).toContain('without baseline');
    expect(summary).toContain('For full comparison');
  });

  it('notes null revelation with informational tone', () => {
    const result: GLMComparisonResult = {
      glm_successes: [],
      glm_persistent: [],
      glm_observations: [],
      overcorrection_indicators: {
        bass_flatness: { detected: false, variance_db: 4, threshold_db: 2 },
        null_revelation: { detected: true, contrast_increase_db: 4.5 }
      },
      mode: 'full_comparison',
      confidence: 'high'
    };

    const summary = generateGLMSummary(result);

    expect(summary).toMatch(/note.*deeper.*expected/i);
    expect(summary).toContain('4.5 dB');
  });

  it('notes variance reduction when significant', () => {
    const result: GLMComparisonResult = {
      glm_successes: [],
      glm_persistent: [],
      glm_observations: [
        {
          observation: 'Bass response smoothed significantly',
          explanation: 'Variance reduced from 12.0 dB to 6.0 dB',
          is_expected: true
        }
      ],
      overcorrection_indicators: {
        bass_flatness: { detected: false, variance_db: 4, threshold_db: 2 },
        null_revelation: { detected: false, contrast_increase_db: 0 }
      },
      mode: 'full_comparison',
      confidence: 'high'
    };

    const summary = generateGLMSummary(result);

    expect(summary).toContain('variance reduction');
  });
});
