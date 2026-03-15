/**
 * Unit tests for optimize-room MCP tool
 *
 * Tests all three actions:
 * - get_recommendation: Returns single recommendation with next steps
 * - validate_adjustment: Requires pre_measurement_id, returns improvement_type
 * - check_progress: Returns zone evaluations and should_stop flag
 *
 * Uses vi.mock for measurementStore.get
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeOptimizeRoom } from './optimize-room.js';
import type { StoredMeasurement, FrequencyResponseData } from '../types/index.js';

// Mock measurementStore
vi.mock('../store/measurement.js', () => ({
  measurementStore: {
    get: vi.fn()
  }
}));

import { measurementStore } from '../store/measurement.js';
const mockMeasurementStoreGet = vi.mocked(measurementStore.get);

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFrequencyResponse(variance: number, targetFreq?: number): FrequencyResponseData {
  const frequencies: number[] = [];
  const spl: number[] = [];

  // Generate frequency points from 20 Hz to 200 Hz
  for (let freq = 20; freq <= 200; freq += 10) {
    frequencies.push(freq);

    if (targetFreq && freq === targetFreq) {
      // Create peak/null at target frequency
      spl.push(80 + variance);
    } else {
      // Create variance pattern across the band to ensure proper zone classification
      const deviation = Math.sin((freq - 20) * 0.1) * (variance / 2);
      spl.push(80 + deviation);
    }
  }

  return {
    frequencies_hz: frequencies,
    spl_db: spl
  };
}

function createMockMeasurement(
  variance: number,
  id: string = 'test-measurement',
  targetFreq?: number
): StoredMeasurement {
  return {
    id,
    name: 'Test Measurement',
    timestamp: new Date().toISOString(),
    frequency_response: createMockFrequencyResponse(variance, targetFreq),
    quick_stats: {
      variance_20_200hz_db: variance,
      peak_deviation_db: variance > 0 ? variance : 0,
      worst_null_db: variance < 0 ? variance : 0
    },
    source: 'api'
  };
}

// ============================================================================
// get_recommendation Action Tests
// ============================================================================

describe('executeOptimizeRoom - get_recommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return single recommendation (not array)', async () => {
    const measurement = createMockMeasurement(8, 'test-1', 100);
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.recommendation).toBeTruthy();
    expect(result.data?.recommendation).not.toBeInstanceOf(Array);
    expect(result.data?.recommendation.element).toBeTruthy();
  });

  it('should include next_steps guidance', async () => {
    const measurement = createMockMeasurement(8, 'test-1', 100);
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.next_steps).toBeTruthy();
    expect(result.data?.next_steps).toContain('measure');
  });

  it('should return error for missing measurement_id', async () => {
    mockMeasurementStoreGet.mockReturnValue(undefined);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'nonexistent'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
    expect(result.message).toContain('not found');
    expect(result.message).toContain('get_status');
  });

  it('should return no issues message when response is optimal', async () => {
    const measurement = createMockMeasurement(2, 'test-1'); // Low variance, no peaks
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.recommendation.action).toContain('No significant issues');
    expect(result.data?.total_issues).toBe(0);
  });

  it('should prioritize issues and return top recommendation', async () => {
    const measurement = createMockMeasurement(10, 'test-1', 100);
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.priority_rank).toBe(1);
    expect(result.data?.total_issues).toBeGreaterThan(0);
  });

  it('should handle L/R measurements when provided', async () => {
    const measurement = createMockMeasurement(4, 'main');
    const leftMeasurement = createMockMeasurement(4, 'left');
    const rightMeasurement = createMockMeasurement(7, 'right'); // L/R imbalance

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'main') return measurement;
      if (id === 'left') return leftMeasurement;
      if (id === 'right') return rightMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'main',
      left_measurement_id: 'left',
      right_measurement_id: 'right'
    });

    expect(result.status).toBe('success');
    expect(result.data?.recommendation).toBeTruthy();
  });

  it('should return error for missing L/R measurement', async () => {
    const measurement = createMockMeasurement(4, 'main');
    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'main') return measurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'main',
      left_measurement_id: 'left',
      right_measurement_id: 'right'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
  });

  it('should return error for missing sub measurement', async () => {
    const measurement = createMockMeasurement(8, 'main', 80);

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'main') return measurement;
      return undefined; // Sub measurement not found
    });

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'main',
      sub_measurement_id: 'sub'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
    expect(result.message).toContain('Sub measurement');
  });

  it('should handle room_dimensions when provided', async () => {
    const measurement = createMockMeasurement(8, 'test-1', 50);
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'test-1',
      room_dimensions: {
        length: 20,
        width: 15,
        height: 9
      }
    });

    expect(result.status).toBe('success');
  });
});

// ============================================================================
// validate_adjustment Action Tests
// ============================================================================

describe('executeOptimizeRoom - validate_adjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require pre_measurement_id and return error if missing', async () => {
    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post-measurement'
      // Missing pre_measurement_id
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('validation_error');
    expect(result.message).toContain('pre_measurement_id');
  });

  it('should require target_frequency_hz and target_category', async () => {
    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post-measurement',
      pre_measurement_id: 'pre-measurement'
      // Missing target_frequency_hz and target_category
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('validation_error');
    expect(result.message).toContain('target_frequency_hz');
    expect(result.message).toContain('target_category');
  });

  it('should return improvement_type and next_action', async () => {
    const preMeasurement = createMockMeasurement(10, 'pre', 100);
    const postMeasurement = createMockMeasurement(5, 'post', 100);

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'pre') return preMeasurement;
      if (id === 'post') return postMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post',
      pre_measurement_id: 'pre',
      target_frequency_hz: 100,
      target_category: 'peak'
    });

    expect(result.status).toBe('success');
    expect(result.data?.improvement_type).toBeTruthy();
    expect(result.data?.next_action).toBeTruthy();
  });

  it('should classify 50%+ improvement as success', async () => {
    const preMeasurement = createMockMeasurement(10, 'pre', 100);
    const postMeasurement = createMockMeasurement(4, 'post', 100);

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'pre') return preMeasurement;
      if (id === 'post') return postMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post',
      pre_measurement_id: 'pre',
      target_frequency_hz: 100,
      target_category: 'peak'
    });

    expect(result.status).toBe('success');
    expect(result.data?.improvement_type).toBe('success');
  });

  it('should include "opposite direction" guidance for worsened case', async () => {
    const preMeasurement = createMockMeasurement(6, 'pre', 100);
    const postMeasurement = createMockMeasurement(10, 'post', 100);

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'pre') return preMeasurement;
      if (id === 'post') return postMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post',
      pre_measurement_id: 'pre',
      target_frequency_hz: 100,
      target_category: 'peak'
    });

    expect(result.status).toBe('success');
    expect(result.data?.improvement_type).toBe('worsened');
    expect(result.data?.next_action).toContain('opposite direction');
  });

  it('should return error for missing pre_measurement', async () => {
    const postMeasurement = createMockMeasurement(5, 'post', 100);

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'post') return postMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post',
      pre_measurement_id: 'pre',
      target_frequency_hz: 100,
      target_category: 'peak'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
    expect(result.message).toContain('Pre-adjustment');
  });

  it('should return error for missing post_measurement', async () => {
    const preMeasurement = createMockMeasurement(10, 'pre', 100);

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'pre') return preMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'validate_adjustment',
      measurement_id: 'post',
      pre_measurement_id: 'pre',
      target_frequency_hz: 100,
      target_category: 'peak'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
    expect(result.message).toContain('Post-adjustment');
  });
});

// ============================================================================
// check_progress Action Tests
// ============================================================================

describe('executeOptimizeRoom - check_progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all three zone evaluations', async () => {
    const measurement = createMockMeasurement(4, 'test-1');
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.smoothness).toBeTruthy();
    expect(result.data?.lr_balance).toBeTruthy();
    expect(result.data?.sub_integration).toBeTruthy();
  });

  it('should set should_stop based on smoothness zone', async () => {
    const measurement = createMockMeasurement(2.8, 'test-1'); // Good smoothness
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.smoothness.zone).toBe('good');
    expect(result.data?.should_stop).toBe(true);
  });

  it('should not stop when smoothness is not good', async () => {
    // Create measurement with variance pattern that ensures >5 dB variance (needs_work threshold)
    const measurement = createMockMeasurement(12.0, 'test-1'); // High variance
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    // With high variance input, should not be good
    expect(['acceptable', 'needs_work']).toContain(result.data?.smoothness.zone);
    expect(result.data?.should_stop).toBe(false);
  });

  it('should include progress_summary in plain language', async () => {
    const measurement = createMockMeasurement(4, 'test-1');
    mockMeasurementStoreGet.mockReturnValue(measurement);

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'test-1'
    });

    expect(result.status).toBe('success');
    expect(result.data?.progress_summary).toBeTruthy();
    expect(result.data?.progress_summary).toContain('Smoothness:');
  });

  it('should handle L/R measurements in progress check', async () => {
    const measurement = createMockMeasurement(3, 'main');
    const leftMeasurement = createMockMeasurement(3, 'left');
    const rightMeasurement = createMockMeasurement(3, 'right');

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'main') return measurement;
      if (id === 'left') return leftMeasurement;
      if (id === 'right') return rightMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'main',
      left_measurement_id: 'left',
      right_measurement_id: 'right'
    });

    expect(result.status).toBe('success');
    expect(result.data?.lr_balance.zone).toBeTruthy();
  });

  it('should handle sub measurement in progress check', async () => {
    const measurement = createMockMeasurement(3, 'main');
    const subMeasurement = createMockMeasurement(3, 'sub');

    mockMeasurementStoreGet.mockImplementation((id: string) => {
      if (id === 'main') return measurement;
      if (id === 'sub') return subMeasurement;
      return undefined;
    });

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'main',
      sub_measurement_id: 'sub'
    });

    expect(result.status).toBe('success');
    expect(result.data?.sub_integration).toBeTruthy();
  });

  it('should return error for missing measurement', async () => {
    mockMeasurementStoreGet.mockReturnValue(undefined);

    const result = await executeOptimizeRoom({
      action: 'check_progress',
      measurement_id: 'nonexistent'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('executeOptimizeRoom - error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return validation error for invalid action', async () => {
    const result = await executeOptimizeRoom({
      action: 'invalid_action' as any,
      measurement_id: 'test'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('validation_error');
  });

  it('should return validation error for missing measurement_id', async () => {
    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: undefined as any
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('validation_error');
  });

  it('should handle measurement_not_found with helpful message', async () => {
    mockMeasurementStoreGet.mockReturnValue(undefined);

    const result = await executeOptimizeRoom({
      action: 'get_recommendation',
      measurement_id: 'nonexistent'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('measurement_not_found');
    expect(result.message).toContain('get_status');
  });
});
