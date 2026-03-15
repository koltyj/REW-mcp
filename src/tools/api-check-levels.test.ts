/**
 * Unit tests for api-check-levels tool handler
 *
 * Tests zone determination, level checking, and error paths.
 * Target: 70%+ line coverage of api-check-levels.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiCheckLevels } from './api-check-levels.js';
import { REWApiError } from '../api/rew-api-error.js';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));

import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiCheckLevels', () => {
  // Mock client structure
  const mockClient = {
    startInputLevelMonitoring: vi.fn(),
    stopInputLevelMonitoring: vi.fn(),
    getInputLevels: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection handling', () => {
    it('should return connection_error when not connected', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_error');
      expect(result.message).toContain('Not connected to REW API');
      expect(result.suggestion).toContain('rew.api_connect');
    });
  });

  describe('Zone determination', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
    });

    it('should return CLIPPING when peak > -3 dBFS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-15],
        peak_levels: [-2],  // Clipping: peak > -3
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('success');
      expect(result.data?.zone).toBe('CLIPPING');
      expect(result.data?.should_block_measurement).toBe(true);
      expect(result.data?.feedback.status).toBe('CLIPPING DETECTED');
    });

    it('should return HOT when rms > -10 dBFS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-8],   // Hot: rms > -10
        peak_levels: [-6],  // Not clipping
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('success');
      expect(result.data?.zone).toBe('HOT');
      expect(result.data?.should_block_measurement).toBe(false);
      expect(result.data?.feedback.status).toBe('Level too hot');
      expect(result.data?.feedback.recommendation).toContain('Reduce mic gain');
    });

    it('should return OPTIMAL when rms between -20 and -10 dBFS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-15],  // Optimal: -20 <= rms <= -10
        peak_levels: [-6],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('success');
      expect(result.data?.zone).toBe('OPTIMAL');
      expect(result.data?.should_block_measurement).toBe(false);
      expect(result.data?.feedback.status).toBe('Level optimal');
      expect(result.data?.feedback.recommendation).toContain('No adjustment needed');
    });

    it('should return LOW when rms between -40 and -20 dBFS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-30],  // Low: -40 <= rms < -20
        peak_levels: [-25],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('success');
      expect(result.data?.zone).toBe('LOW');
      expect(result.data?.should_block_measurement).toBe(false);
      expect(result.data?.feedback.status).toBe('Level low');
      expect(result.data?.feedback.recommendation).toContain('Increase mic gain');
    });

    it('should return VERY_LOW when rms < -40 dBFS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-50],  // Very low: rms < -40
        peak_levels: [-45],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('success');
      expect(result.data?.zone).toBe('VERY_LOW');
      expect(result.data?.should_block_measurement).toBe(true);
      expect(result.data?.feedback.status).toBe('LEVEL TOO LOW');
      expect(result.data?.feedback.recommendation).toContain('Increase mic gain significantly');
    });
  });

  describe('Zone boundary tests', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
    });

    it('should be OPTIMAL at exact boundary -10 dBFS RMS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-10],  // Boundary: -10 is OPTIMAL
        peak_levels: [-5],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});
      expect(result.data?.zone).toBe('OPTIMAL');
    });

    it('should be OPTIMAL at exact boundary -20 dBFS RMS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-20],  // Boundary: -20 is OPTIMAL
        peak_levels: [-15],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});
      expect(result.data?.zone).toBe('OPTIMAL');
    });

    it('should be LOW at -20.1 dBFS RMS (just below OPTIMAL)', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-20.1],  // Just below OPTIMAL boundary
        peak_levels: [-15],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});
      expect(result.data?.zone).toBe('LOW');
    });

    it('should be LOW at exact boundary -40 dBFS RMS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-40],  // Boundary: -40 is LOW
        peak_levels: [-35],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});
      expect(result.data?.zone).toBe('LOW');
    });

    it('should be VERY_LOW at -40.1 dBFS RMS (just below LOW)', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-40.1],  // Just below LOW boundary
        peak_levels: [-35],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});
      expect(result.data?.zone).toBe('VERY_LOW');
    });

    it('should be CLIPPING at exact boundary -3 dBFS peak', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-15],
        peak_levels: [-2.9],  // Just above clipping threshold
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});
      expect(result.data?.zone).toBe('CLIPPING');
    });
  });

  describe('Level calculation', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
    });

    it('should average RMS across channels', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-10, -14],  // Average: (-10 + -14) / 2 = -12
        peak_levels: [-5, -8],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.data?.levels.rms_db).toBe(-12);
      expect(result.data?.zone).toBe('OPTIMAL');
    });

    it('should take max peak across channels', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-15, -15],
        peak_levels: [-5, -8],  // Max peak: -5
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.data?.levels.peak_db).toBe(-5);
    });

    it('should include per-channel levels in response', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-12, -14],
        peak_levels: [-6, -8],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.data?.levels.channel_count).toBe(2);
      expect(result.data?.levels.rms_per_channel).toEqual([-12, -14]);
      expect(result.data?.levels.peak_per_channel).toEqual([-6, -8]);
    });
  });

  describe('Channel mismatch detection', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
    });

    it('should warn on L/R channel mismatch > 3 dB', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-12, -18],  // 6 dB difference > 3 dB threshold
        peak_levels: [-6, -10],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.data?.feedback.warning).toContain('L/R channel imbalance');
      expect(result.data?.feedback.warning).toContain('6.0 dB');
    });

    it('should not warn when L/R channel mismatch <= 3 dB', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-12, -14],  // 2 dB difference <= 3 dB threshold
        peak_levels: [-6, -8],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.data?.feedback.warning).toBeUndefined();
    });

    it('should not warn on single channel', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-12],
        peak_levels: [-6],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      expect(result.data?.feedback.warning).toBeUndefined();
    });
  });

  describe('Target RMS handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
    });

    it('should use default target of -12 dBFS', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-8],  // 4 dB above -12 target
        peak_levels: [-5],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({});

      // HOT zone recommendation should mention -12 target
      expect(result.data?.feedback.recommendation).toContain('-12 dBFS');
    });

    it('should use custom target_rms when provided', async () => {
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-25],  // LOW zone, so adjustment will be suggested
        peak_levels: [-20],
        time_span_seconds: 0.5
      });

      const result = await executeApiCheckLevels({ target_rms: -18 });

      // Level is -25, target is -18, so 7 dB increase needed
      expect(result.data?.feedback.recommendation).toContain('-18 dBFS');
    });
  });

  describe('Cleanup handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should stop monitoring on success', async () => {
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
      mockClient.getInputLevels.mockResolvedValue({
        unit: 'dBFS',
        rms_levels: [-15],
        peak_levels: [-10],
        time_span_seconds: 0.5
      });

      await executeApiCheckLevels({});

      expect(mockClient.stopInputLevelMonitoring).toHaveBeenCalled();
    });

    it('should stop monitoring on error', async () => {
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
      mockClient.getInputLevels.mockRejectedValue(new Error('Test error'));

      await executeApiCheckLevels({});

      expect(mockClient.stopInputLevelMonitoring).toHaveBeenCalled();
    });
  });

  describe('Level reading failure', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.startInputLevelMonitoring.mockResolvedValue(true);
      mockClient.stopInputLevelMonitoring.mockResolvedValue(true);
    });

    it('should return api_error when getInputLevels returns null', async () => {
      mockClient.getInputLevels.mockResolvedValue(null);

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to read input levels');
      expect(result.suggestion).toContain('rew.api_audio');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle validation error for invalid target_rms', async () => {
      const result = await executeApiCheckLevels({ target_rms: 10 } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
    });

    it('should handle REWApiError with CONNECTION_REFUSED', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED', 0)
      );

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should handle REWApiError with NOT_FOUND', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue(
        new REWApiError('Not found', 'NOT_FOUND', 404)
      );

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should handle REWApiError with TIMEOUT', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue(
        new REWApiError('Request timeout', 'TIMEOUT', 408)
      );

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('busy or frozen');
    });

    it('should handle REWApiError with INTERNAL_ERROR', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue(
        new REWApiError('Internal error', 'INTERNAL_ERROR', 500)
      );

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
    });

    it('should handle REWApiError with INVALID_RESPONSE', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue(
        new REWApiError('Invalid response', 'INVALID_RESPONSE', 200)
      );

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('invalid_response');
    });

    it('should handle unknown Error type', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
      expect(result.suggestion).toContain('Check REW API connection');
    });

    it('should handle non-Error thrown values', async () => {
      mockClient.startInputLevelMonitoring.mockRejectedValue('String error');

      const result = await executeApiCheckLevels({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error occurred');
    });
  });
});
