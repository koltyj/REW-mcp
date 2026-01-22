/**
 * Unit tests for optimization validation
 *
 * Tests validateAdjustment classification and threshold logic:
 * - 50%+ improvement = success
 * - Context-dependent unchanged thresholds (1/2/3 dB)
 * - Partial improvement classification
 * - Worsened detection and guidance
 * - Summary format with dB and percentage
 */

import { describe, it, expect } from 'vitest';
import {
  validateAdjustment,
  getUnchangedThreshold,
  type ImprovementType,
  type TargetIssue
} from './validation.js';
import type { StoredMeasurement, FrequencyResponseData } from '../types/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFrequencyResponse(variance: number, targetFreq: number = 100): FrequencyResponseData {
  // Create a simple frequency response with controlled variance
  const frequencies: number[] = [];
  const spl: number[] = [];

  // Generate frequency points from 20 Hz to 200 Hz
  for (let freq = 20; freq <= 200; freq += 10) {
    frequencies.push(freq);

    // Create variance pattern centered around target frequency
    if (freq === targetFreq) {
      // Peak/null at target frequency
      spl.push(80 + variance);
    } else {
      // Base level
      spl.push(80);
    }
  }

  return {
    frequencies_hz: frequencies,
    spl_db: spl
  };
}

function createMockMeasurement(
  variance: number,
  targetFreq: number = 100,
  id: string = 'test-measurement'
): StoredMeasurement {
  return {
    id,
    name: 'Test Measurement',
    timestamp: new Date().toISOString(),
    frequency_response: createMockFrequencyResponse(variance, targetFreq),
    quick_stats: {
      variance_20_200hz_db: variance,
      peak_deviation_db: variance,
      worst_null_db: -variance
    },
    source: 'api'
  };
}

// ============================================================================
// validateAdjustment Classification Tests
// ============================================================================

describe('validateAdjustment', () => {
  const targetIssue: TargetIssue = {
    frequency_hz: 100,
    category: 'peak'
  };

  it('should classify 50% improvement as success', () => {
    const preMeasurement = createMockMeasurement(8, 100);
    const postMeasurement = createMockMeasurement(4, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('success');
    expect(result.improvement_percent).toBeCloseTo(50, 0);
    expect(result.next_action).toContain('Good improvement');
  });

  it('should classify 49% improvement as partial', () => {
    const preMeasurement = createMockMeasurement(8.2, 100);
    const postMeasurement = createMockMeasurement(4.2, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('partial');
    expect(Math.abs(result.improvement_percent - 49)).toBeLessThan(1);
  });

  it('should classify 25% improvement as partial', () => {
    const preMeasurement = createMockMeasurement(8, 100);
    const postMeasurement = createMockMeasurement(6, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('partial');
    expect(result.improvement_percent).toBeCloseTo(25, 0);
    expect(result.next_action).toContain('Some improvement');
  });

  it('should classify <1 dB change on small issue (<6 dB) as unchanged', () => {
    const preMeasurement = createMockMeasurement(5, 100);
    const postMeasurement = createMockMeasurement(4.5, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('unchanged');
    expect(Math.abs(result.improvement_db)).toBeLessThan(1);
    expect(result.next_action).toContain('No significant change');
  });

  it('should classify <2 dB change on medium issue (6-10 dB) as unchanged', () => {
    const preMeasurement = createMockMeasurement(8, 100);
    const postMeasurement = createMockMeasurement(6.5, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('unchanged');
    expect(Math.abs(result.improvement_db)).toBeCloseTo(1.5, 1);
    expect(result.next_action).toContain('No significant change');
  });

  it('should classify <3 dB change on large issue (>10 dB) as unchanged', () => {
    const preMeasurement = createMockMeasurement(12, 100);
    const postMeasurement = createMockMeasurement(10, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('unchanged');
    expect(Math.abs(result.improvement_db)).toBeCloseTo(2, 0);
  });

  it('should classify -11% change as worsened', () => {
    const preMeasurement = createMockMeasurement(8, 100);
    const postMeasurement = createMockMeasurement(9, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('worsened');
    expect(result.improvement_percent).toBeLessThan(-10);
    expect(result.next_action).toContain('opposite direction');
  });

  it('should classify -9% change as unchanged (within context threshold)', () => {
    const preMeasurement = createMockMeasurement(10, 100);
    const postMeasurement = createMockMeasurement(10.9, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    // 0.9 dB change < 3 dB threshold for >10 dB issue = unchanged
    expect(result.improvement_type).toBe('unchanged');
    expect(result.improvement_percent).toBeCloseTo(-9, 0);
  });
});

// ============================================================================
// Next Action Guidance Tests
// ============================================================================

describe('validateAdjustment - next_action guidance', () => {
  const targetIssue: TargetIssue = {
    frequency_hz: 100,
    category: 'peak'
  };

  it('should include "Good improvement" message for success', () => {
    const preMeasurement = createMockMeasurement(8, 100);
    const postMeasurement = createMockMeasurement(3, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('success');
    expect(result.next_action).toContain('Good improvement');
    expect(result.next_action).toContain('next issue');
  });

  it('should include "Try moving opposite direction" for worsened', () => {
    const preMeasurement = createMockMeasurement(6, 100);
    const postMeasurement = createMockMeasurement(8, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('worsened');
    expect(result.next_action).toContain('opposite direction');
    expect(result.explanation).toContain('Reverse the direction');
  });

  it('should suggest "different adjustment" for unchanged', () => {
    const preMeasurement = createMockMeasurement(10, 100);
    const postMeasurement = createMockMeasurement(10.5, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('unchanged');
    expect(result.next_action).toContain('different adjustment');
    expect(result.next_action).toContain('element');
  });

  it('should mention "fine-tuning" option for partial', () => {
    const preMeasurement = createMockMeasurement(10, 100);
    const postMeasurement = createMockMeasurement(7, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.improvement_type).toBe('partial');
    expect(result.next_action).toContain('fine-tuning');
    expect(result.next_action).toContain('next issue');
  });
});

// ============================================================================
// Summary Format Tests
// ============================================================================

describe('validateAdjustment - summary format', () => {
  const targetIssue: TargetIssue = {
    frequency_hz: 100,
    category: 'peak'
  };

  it('should include both dB value and percentage', () => {
    const preMeasurement = createMockMeasurement(8.2, 100);
    const postMeasurement = createMockMeasurement(4.1, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.summary).toContain('8.2 dB');
    expect(result.summary).toContain('4.1 dB');
    expect(result.summary).toContain('50%');
  });

  it('should format improvement as "X dB reduction"', () => {
    const preMeasurement = createMockMeasurement(8.2, 100);
    const postMeasurement = createMockMeasurement(4.1, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.summary).toContain('improved');
    expect(result.summary).toContain('reduction');
  });

  it('should format worsening as "X dB increase"', () => {
    const preMeasurement = createMockMeasurement(6, 100);
    const postMeasurement = createMockMeasurement(8, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.summary).toContain('worsened');
    expect(result.summary).toContain('increase');
  });

  it('should format unchanged correctly', () => {
    const preMeasurement = createMockMeasurement(8, 100);
    const postMeasurement = createMockMeasurement(8, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.summary).toContain('No significant change');
    expect(result.summary).toContain('8.0 dB');
  });

  it('should include metric name in summary', () => {
    const targetIssue: TargetIssue = {
      frequency_hz: 125,
      category: 'peak'
    };

    const preMeasurement = createMockMeasurement(8, 125);
    const postMeasurement = createMockMeasurement(4, 125);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.summary).toContain('Peak at 125 Hz');
  });
});

// ============================================================================
// getUnchangedThreshold Tests
// ============================================================================

describe('getUnchangedThreshold', () => {
  it('should return 1 dB threshold for small issues (<6 dB)', () => {
    expect(getUnchangedThreshold(5)).toBe(1);
    expect(getUnchangedThreshold(4)).toBe(1);
    expect(getUnchangedThreshold(3)).toBe(1);
  });

  it('should return 2 dB threshold for medium issues (6-10 dB)', () => {
    expect(getUnchangedThreshold(6)).toBe(2);
    expect(getUnchangedThreshold(7)).toBe(2);
    expect(getUnchangedThreshold(8)).toBe(2);
    expect(getUnchangedThreshold(9)).toBe(2);
  });

  it('should return 3 dB threshold for large issues (>10 dB)', () => {
    expect(getUnchangedThreshold(10)).toBe(3);
    expect(getUnchangedThreshold(11)).toBe(3);
    expect(getUnchangedThreshold(15)).toBe(3);
    expect(getUnchangedThreshold(20)).toBe(3);
  });

  it('should handle negative deviations', () => {
    expect(getUnchangedThreshold(-5)).toBe(1);
    expect(getUnchangedThreshold(-8)).toBe(2);
    expect(getUnchangedThreshold(-12)).toBe(3);
  });
});

// ============================================================================
// Category-Specific Validation Tests
// ============================================================================

describe('validateAdjustment - category-specific', () => {
  it('should validate null category', () => {
    const targetIssue: TargetIssue = {
      frequency_hz: 100,
      category: 'null'
    };

    const preMeasurement = createMockMeasurement(-8, 100);
    const postMeasurement = createMockMeasurement(-4, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.metric_name).toContain('Null at 100 Hz');
    expect(result.improvement_type).toBe('success');
  });

  it('should validate sub_integration category', () => {
    const targetIssue: TargetIssue = {
      frequency_hz: 80,
      category: 'sub_integration'
    };

    const preMeasurement = createMockMeasurement(10, 80);
    const postMeasurement = createMockMeasurement(6, 80);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.metric_name).toContain('Sub integration');
    expect(result.improvement_type).toBe('partial');
  });

  it('should validate lr_symmetry category', () => {
    const targetIssue: TargetIssue = {
      frequency_hz: 100,
      category: 'lr_symmetry'
    };

    const preMeasurement = createMockMeasurement(4, 100);
    const postMeasurement = createMockMeasurement(2, 100);

    const result = validateAdjustment(preMeasurement, postMeasurement, targetIssue);

    expect(result.metric_name).toContain('L/R symmetry');
    expect(result.improvement_type).toBe('success');
  });
});
