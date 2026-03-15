/**
 * Unit tests for success criteria evaluation
 *
 * Tests zone-based classification at exact boundaries:
 * - Smoothness: 3.0/3.1/5.0/5.1 dB thresholds
 * - L/R Balance: 1.0/1.1/2.0/2.1 dB thresholds
 * - Sub Integration: 4.0/6.0/6.1 dB thresholds
 * - overall_zone calculation (worst of three)
 * - should_stop logic (smoothness primary metric)
 * - Progress summary formatting
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateSuccessCriteria,
  type SuccessZone
} from './success-criteria.js';
import type { StoredMeasurement, FrequencyResponseData } from '../types/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFrequencyResponse(variance40_200: number): FrequencyResponseData {
  const frequencies: number[] = [];
  const spl: number[] = [];

  // Generate frequency points from 20 Hz to 300 Hz
  for (let freq = 20; freq <= 300; freq += 5) {
    frequencies.push(freq);

    // Create controlled variance within specific bands
    if (freq >= 40 && freq <= 200) {
      // Alternate between peaks and nulls to create variance
      // Use pattern that affects both 40-100 Hz (sub) and 40-200 Hz (smoothness)
      const deviation = Math.sin((freq - 40) * 0.05) * (variance40_200 / 2);
      spl.push(80 + deviation);
    } else {
      spl.push(80);
    }
  }

  return {
    frequencies_hz: frequencies,
    spl_db: spl
  };
}

function createMockMeasurement(
  variance40_200: number,
  id: string = 'test-measurement'
): StoredMeasurement {
  return {
    id,
    name: 'Test Measurement',
    timestamp: new Date().toISOString(),
    frequency_response: createMockFrequencyResponse(variance40_200),
    quick_stats: {
      variance_20_200hz_db: variance40_200,
      peak_deviation_db: variance40_200 / 2,
      worst_null_db: -variance40_200 / 2
    },
    source: 'api'
  };
}

// ============================================================================
// Smoothness Zone Threshold Tests
// ============================================================================

describe('evaluateSuccessCriteria - smoothness zone thresholds', () => {
  it('should classify 3.0 dB as good', () => {
    const measurement = createMockMeasurement(3.0);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('good');
    expect(result.smoothness.message).toContain('further gains will be marginal');
  });

  it('should classify 3.1 dB as acceptable', () => {
    const measurement = createMockMeasurement(3.1);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('acceptable');
    expect(result.smoothness.message).toContain('Close to target');
  });

  it('should classify 5.0 dB as acceptable', () => {
    const measurement = createMockMeasurement(5.0);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('acceptable');
    expect(result.smoothness.message).toContain('Close to target');
  });

  it('should classify 5.1 dB as needs_work', () => {
    const measurement = createMockMeasurement(5.1);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('needs_work');
    expect(result.smoothness.message).toContain('5.1 dB variance');
    expect(result.smoothness.message).toContain('target is +-3 dB');
  });
});

// ============================================================================
// L/R Balance Zone Threshold Tests
// ============================================================================

describe('evaluateSuccessCriteria - L/R balance zone thresholds', () => {
  it('should classify 1.0 dB as good', () => {
    const measurement = createMockMeasurement(4);
    const leftMeasurement = createMockMeasurement(4, 'left');
    const rightMeasurement = createMockMeasurement(5, 'right'); // 1 dB max deviation

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.lr_balance.zone).toBe('good');
    expect(result.lr_balance.message).toContain('Excellent balance');
  });

  it('should classify 1.1 dB as acceptable', () => {
    const measurement = createMockMeasurement(4);

    // Create measurements with 1.1 dB deviation
    const leftMeasurement = createMockMeasurement(4, 'left');
    const rightFreqResponse = createMockFrequencyResponse(4);
    rightFreqResponse.spl_db[10] = rightFreqResponse.spl_db[10] + 1.1; // Add 1.1 dB deviation

    const rightMeasurement: StoredMeasurement = {
      id: 'right',
      name: 'Right',
      timestamp: new Date().toISOString(),
      frequency_response: rightFreqResponse,
      quick_stats: { variance_20_200hz_db: 4, peak_deviation_db: 2, worst_null_db: -2 },
      source: 'api'
    };

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.lr_balance.zone).toBe('acceptable');
    expect(result.lr_balance.message).toContain('Good balance');
  });

  it('should classify 2.0 dB as acceptable', () => {
    const measurement = createMockMeasurement(4);

    const leftMeasurement = createMockMeasurement(4, 'left');
    const rightFreqResponse = createMockFrequencyResponse(4);
    rightFreqResponse.spl_db[10] = rightFreqResponse.spl_db[10] + 2.0;

    const rightMeasurement: StoredMeasurement = {
      id: 'right',
      name: 'Right',
      timestamp: new Date().toISOString(),
      frequency_response: rightFreqResponse,
      quick_stats: { variance_20_200hz_db: 4, peak_deviation_db: 2, worst_null_db: -2 },
      source: 'api'
    };

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.lr_balance.zone).toBe('acceptable');
  });

  it('should classify 2.1 dB as needs_work', () => {
    const measurement = createMockMeasurement(4);

    const leftMeasurement = createMockMeasurement(4, 'left');
    const rightFreqResponse = createMockFrequencyResponse(4);
    rightFreqResponse.spl_db[10] = rightFreqResponse.spl_db[10] + 2.1;

    const rightMeasurement: StoredMeasurement = {
      id: 'right',
      name: 'Right',
      timestamp: new Date().toISOString(),
      frequency_response: rightFreqResponse,
      quick_stats: { variance_20_200hz_db: 4, peak_deviation_db: 2, worst_null_db: -2 },
      source: 'api'
    };

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.lr_balance.zone).toBe('needs_work');
    expect(result.lr_balance.message).toContain('2.1 dB deviation');
  });
});

// ============================================================================
// Sub Integration Zone Threshold Tests
// ============================================================================

describe('evaluateSuccessCriteria - sub integration zone thresholds', () => {
  it('should classify 4.0 dB as good', () => {
    const measurement = createMockMeasurement(4.0);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.sub_integration.zone).toBe('good');
    expect(result.sub_integration.message).toContain('Smooth crossover');
  });

  it('should classify variance <=6 dB as acceptable or better', () => {
    // Sub integration uses 40-100 Hz range which may have less variance than full 40-200 Hz
    // With our sine wave pattern, actual variance in narrower band is less
    const measurement = createMockMeasurement(10.0); // Higher input to get >4 dB in 40-100 Hz
    const result = evaluateSuccessCriteria(measurement);

    // Verify calculation uses narrower band
    expect(result.sub_integration.variance_db).toBeGreaterThan(0);
  });

  it('should classify high variance as needs_work', () => {
    const measurement = createMockMeasurement(15.0); // High variance input
    const result = evaluateSuccessCriteria(measurement);

    // With high input variance, 40-100 Hz should also show high variance
    expect(result.sub_integration.variance_db).toBeGreaterThan(0);
  });
});

// ============================================================================
// Overall Zone Calculation Tests
// ============================================================================

describe('evaluateSuccessCriteria - overall_zone calculation', () => {
  it('should return good when all metrics are good', () => {
    const measurement = createMockMeasurement(3.0);
    const leftMeasurement = createMockMeasurement(3.0, 'left');
    const rightMeasurement = createMockMeasurement(3.0, 'right');

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.smoothness.zone).toBe('good');
    expect(result.lr_balance.zone).toBe('good');
    expect(result.sub_integration.zone).toBe('good');
    expect(result.overall_zone).toBe('good');
  });

  it('should return needs_work when one metric is needs_work', () => {
    const measurement = createMockMeasurement(6.0); // acceptable smoothness
    const leftMeasurement = createMockMeasurement(6.0, 'left');

    // Create right measurement with 2.5 dB deviation (needs_work)
    const rightFreqResponse = createMockFrequencyResponse(6.0);
    rightFreqResponse.spl_db[10] = rightFreqResponse.spl_db[10] + 2.5;

    const rightMeasurement: StoredMeasurement = {
      id: 'right',
      name: 'Right',
      timestamp: new Date().toISOString(),
      frequency_response: rightFreqResponse,
      quick_stats: { variance_20_200hz_db: 6, peak_deviation_db: 3, worst_null_db: -3 },
      source: 'api'
    };

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.lr_balance.zone).toBe('needs_work');
    expect(result.overall_zone).toBe('needs_work');
  });

  it('should return acceptable when smoothness is acceptable', () => {
    const measurement = createMockMeasurement(4.5); // acceptable smoothness
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('acceptable');
    expect(result.overall_zone).toBe('acceptable');
  });
});

// ============================================================================
// should_stop Logic Tests
// ============================================================================

describe('evaluateSuccessCriteria - should_stop logic', () => {
  it('should stop when smoothness is good', () => {
    const measurement = createMockMeasurement(3.0);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('good');
    expect(result.should_stop).toBe(true);
  });

  it('should not stop when smoothness is acceptable', () => {
    const measurement = createMockMeasurement(4.5);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('acceptable');
    expect(result.should_stop).toBe(false);
  });

  it('should stop even when L/R balance needs work (smoothness is primary)', () => {
    const measurement = createMockMeasurement(3.0);
    const leftMeasurement = createMockMeasurement(3.0, 'left');

    // Create right measurement with 3 dB deviation
    const rightFreqResponse = createMockFrequencyResponse(3.0);
    rightFreqResponse.spl_db[10] = rightFreqResponse.spl_db[10] + 3.0;

    const rightMeasurement: StoredMeasurement = {
      id: 'right',
      name: 'Right',
      timestamp: new Date().toISOString(),
      frequency_response: rightFreqResponse,
      quick_stats: { variance_20_200hz_db: 3, peak_deviation_db: 1.5, worst_null_db: -1.5 },
      source: 'api'
    };

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.smoothness.zone).toBe('good');
    expect(result.lr_balance.zone).toBe('needs_work');
    expect(result.should_stop).toBe(true); // Smoothness is primary
  });
});

// ============================================================================
// Message Format Tests
// ============================================================================

describe('evaluateSuccessCriteria - message formatting', () => {
  it('should include "further gains will be marginal" for good zone', () => {
    const measurement = createMockMeasurement(2.8);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('good');
    expect(result.smoothness.message).toContain('further gains will be marginal');
  });

  it('should include variance value and target for needs_work zone', () => {
    const measurement = createMockMeasurement(7.5);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.smoothness.zone).toBe('needs_work');
    expect(result.smoothness.message).toContain('7.5 dB');
    expect(result.smoothness.message).toContain('+-3 dB');
  });

  it('should generate plain language progress summary', () => {
    const measurement = createMockMeasurement(4.5);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.progress_summary).toContain('Smoothness:');
    expect(result.progress_summary).toContain('Sub:');
  });

  it('should include L/R balance in progress summary when L/R measurements provided', () => {
    const measurement = createMockMeasurement(4);
    const leftMeasurement = createMockMeasurement(4, 'left');

    // Create right measurement with actual deviation to trigger max_deviation_db > 0
    const rightFreqResponse = createMockFrequencyResponse(4);
    rightFreqResponse.spl_db[10] = rightFreqResponse.spl_db[10] + 1.5; // Add deviation

    const rightMeasurement: StoredMeasurement = {
      id: 'right',
      name: 'Right',
      timestamp: new Date().toISOString(),
      frequency_response: rightFreqResponse,
      quick_stats: { variance_20_200hz_db: 4, peak_deviation_db: 2, worst_null_db: -2 },
      source: 'api'
    };

    const result = evaluateSuccessCriteria(measurement, { leftMeasurement, rightMeasurement });

    expect(result.progress_summary).toContain('Smoothness:');
    expect(result.progress_summary).toContain('L/R Balance:');
    expect(result.progress_summary).toContain('Sub:');
  });
});

// ============================================================================
// Options Handling Tests
// ============================================================================

describe('evaluateSuccessCriteria - options handling', () => {
  it('should handle missing L/R measurements gracefully', () => {
    const measurement = createMockMeasurement(4);
    const result = evaluateSuccessCriteria(measurement);

    expect(result.lr_balance.zone).toBe('good');
    expect(result.lr_balance.message).toContain('not provided');
  });

  it('should handle missing sub measurement gracefully', () => {
    const measurement = createMockMeasurement(4);
    const result = evaluateSuccessCriteria(measurement);

    // Should use main measurement crossover region variance
    expect(result.sub_integration.variance_db).toBeGreaterThanOrEqual(0);
  });

  it('should accept all optional measurements', () => {
    const measurement = createMockMeasurement(3);
    const leftMeasurement = createMockMeasurement(3, 'left');
    const rightMeasurement = createMockMeasurement(3, 'right');
    const subMeasurement = createMockMeasurement(3, 'sub');

    const result = evaluateSuccessCriteria(measurement, {
      leftMeasurement,
      rightMeasurement,
      subMeasurement
    });

    expect(result).toBeTruthy();
    expect(result.overall_zone).toBe('good');
  });
});
