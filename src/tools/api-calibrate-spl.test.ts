/**
 * Unit tests for api-calibrate-spl tool handler
 *
 * Tests all action branches (start, check, stop) and error paths.
 * Uses vi.useFakeTimers for setTimeout delays.
 * Target: 70%+ line coverage of api-calibrate-spl.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeApiCalibrateSPL } from './api-calibrate-spl.js';
import { REWApiError } from '../api/rew-api-error.js';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));

import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiCalibrateSPL', () => {
  // Mock client structure
  const mockClient = {
    setGeneratorSignal: vi.fn(),
    setGeneratorLevel: vi.fn(),
    executeGeneratorCommand: vi.fn(),
    setSPLMeterConfig: vi.fn(),
    executeSPLMeterCommand: vi.fn(),
    getSPLMeterLevels: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Connection handling', () => {
    it('should return connection_error when not connected', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_error');
      expect(result.message).toContain('Not connected to REW API');
      expect(result.suggestion).toContain('rew.api_connect');
    });
  });

  describe('start action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should configure generator with pink noise', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({ action: 'start' });
      await vi.advanceTimersByTimeAsync(3000);
      await promise;

      expect(mockClient.setGeneratorSignal).toHaveBeenCalledWith('Pink noise');
    });

    it('should set generator level to -20 dBFS', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({ action: 'start' });
      await vi.advanceTimersByTimeAsync(3000);
      await promise;

      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-20, 'dBFS');
    });

    it('should start generator and wait for 2s stabilization delay', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({ action: 'start' });

      // After 1.9s, SPL meter config should not be called yet
      await vi.advanceTimersByTimeAsync(1900);
      expect(mockClient.setSPLMeterConfig).not.toHaveBeenCalled();

      // After 2s total, SPL meter config should be called
      await vi.advanceTimersByTimeAsync(200);
      expect(mockClient.setSPLMeterConfig).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      await promise;
    });

    it('should configure SPL meter with weighting', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({ action: 'start', weighting: 'C' });
      await vi.advanceTimersByTimeAsync(3000);
      await promise;

      expect(mockClient.setSPLMeterConfig).toHaveBeenCalledWith(1, {
        weighting: 'C',
        filter: 'Slow'
      });
    });

    it('should start SPL meter and wait for 1s averaging delay', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({ action: 'start' });

      // After 2.5s (2s gen delay + 0.5s), result should not be ready
      await vi.advanceTimersByTimeAsync(2500);
      // Execute meter command should be called but we're waiting on 1s delay
      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalled();

      // After 3s total, result should be ready
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result.status).toBe('success');
    });

    it('should return success with calibration status', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({
        action: 'start',
        target_spl: 85,
        tolerance_db: 1.0,
        weighting: 'C'
      });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('start');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Calibration started');
      expect(result.data?.calibration_status?.target_spl).toBe(85);
      expect(result.data?.calibration_status?.tolerance_db).toBe(1.0);
      expect(result.data?.calibration_status?.weighting).toBe('C');
      expect(result.data?.calibration_status?.within_tolerance).toBe(false);
    });

    it('should return error when setGeneratorSignal fails', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(false);

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to set generator signal');
    });

    it('should return error when setGeneratorLevel fails', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(false);

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to set generator level');
    });

    it('should return error when executeGeneratorCommand Play fails', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(false);

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to start generator');
    });

    it('should stop generator and return error when setSPLMeterConfig fails', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(false);

      const promise = executeApiCalibrateSPL({ action: 'start' });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to configure SPL meter');
      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
    });

    it('should stop generator and return error when executeSPLMeterCommand Start fails', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(false);

      const promise = executeApiCalibrateSPL({ action: 'start' });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to start SPL meter');
      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
    });
  });

  describe('check action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should read SPL meter and return current level', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 82.5,
        leq: 81.0,
        sel: 82.0,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check', target_spl: 85 });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('check');
      expect(result.data?.calibration_status?.current_spl).toBe(82.5);
    });

    it('should calculate adjustment needed', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 82,
        leq: 81.0,
        sel: 82.0,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check', target_spl: 85 });

      // target=85, current=82, adjustment=+3
      expect(result.data?.calibration_status?.adjustment_db).toBe(3);
    });

    it('should return within_tolerance true when in range', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 84.5,  // 85 +/- 1 = [84, 86], 84.5 is within
        leq: 84.0,
        sel: 84.5,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({
        action: 'check',
        target_spl: 85,
        tolerance_db: 1.0
      });

      expect(result.data?.calibration_status?.within_tolerance).toBe(true);
      expect(result.data?.calibration_status?.guidance).toContain('Target achieved');
    });

    it('should return within_tolerance false when out of range', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 82,  // 85 +/- 1 = [84, 86], 82 is outside
        leq: 81.0,
        sel: 82.0,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({
        action: 'check',
        target_spl: 85,
        tolerance_db: 1.0
      });

      expect(result.data?.calibration_status?.within_tolerance).toBe(false);
    });

    it('should provide increase guidance when low', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 82,  // Below target 85
        leq: 81.0,
        sel: 82.0,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check', target_spl: 85 });

      expect(result.data?.calibration_status?.guidance).toContain('Too quiet');
      expect(result.data?.calibration_status?.guidance).toContain('Increase');
      expect(result.data?.calibration_status?.guidance).toContain('3.0 dB');
    });

    it('should provide decrease guidance when high', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 88,  // Above target 85
        leq: 87.0,
        sel: 88.0,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check', target_spl: 85 });

      expect(result.data?.calibration_status?.guidance).toContain('Too loud');
      expect(result.data?.calibration_status?.guidance).toContain('Decrease');
      expect(result.data?.calibration_status?.guidance).toContain('3.0 dB');
    });

    it('should return success with failure message when SPL meter read fails', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue(null);

      const result = await executeApiCalibrateSPL({ action: 'check' });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to read SPL meter');
      expect(result.data?.message).toContain('action: start');
    });

    it('should read from specified meter_id', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 85.0,
        leq: 84.5,
        sel: 85.0,
        weighting: 'C',
        filter: 'Slow'
      });

      await executeApiCalibrateSPL({ action: 'check', meter_id: 2 });

      expect(mockClient.getSPLMeterLevels).toHaveBeenCalledWith(2);
    });

    it('should include weighting from SPL meter response', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 85.0,
        leq: 84.5,
        sel: 85.0,
        weighting: 'A',  // Different from default C
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check' });

      expect(result.data?.calibration_status?.weighting).toBe('A');
    });
  });

  describe('stop action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should stop generator', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      await executeApiCalibrateSPL({ action: 'stop' });

      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
    });

    it('should stop SPL meter', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      await executeApiCalibrateSPL({ action: 'stop', meter_id: 2 });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(2, 'Stop');
    });

    it('should return success message when both stop successfully', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiCalibrateSPL({ action: 'stop' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('stop');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Calibration stopped');
      expect(result.data?.message).toContain('Generator and SPL meter stopped');
    });

    it('should return warning message when generator stop fails', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(false);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiCalibrateSPL({ action: 'stop' });

      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('warnings');
    });

    it('should return warning message when SPL meter stop fails', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(false);

      const result = await executeApiCalibrateSPL({ action: 'stop' });

      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('warnings');
    });
  });

  describe('Validation errors', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle validation error for invalid action', async () => {
      const result = await executeApiCalibrateSPL({ action: 'invalid' } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
    });

    it('should handle validation error for target_spl out of range', async () => {
      const result = await executeApiCalibrateSPL({ action: 'check', target_spl: 150 } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
    });

    it('should handle validation error for invalid weighting', async () => {
      const result = await executeApiCalibrateSPL({ action: 'start', weighting: 'X' } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
    });

    it('should handle validation error for meter_id out of range', async () => {
      const result = await executeApiCalibrateSPL({ action: 'check', meter_id: 5 } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
    });
  });

  describe('REWApiError handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle REWApiError with CONNECTION_REFUSED', async () => {
      mockClient.setGeneratorSignal.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED', 0)
      );

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should handle REWApiError with NOT_FOUND', async () => {
      mockClient.getSPLMeterLevels.mockRejectedValue(
        new REWApiError('Not found', 'NOT_FOUND', 404)
      );

      const result = await executeApiCalibrateSPL({ action: 'check' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should handle REWApiError with TIMEOUT', async () => {
      mockClient.executeGeneratorCommand.mockRejectedValue(
        new REWApiError('Request timeout', 'TIMEOUT', 408)
      );

      const result = await executeApiCalibrateSPL({ action: 'stop' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('busy or frozen');
    });

    it('should handle REWApiError with INTERNAL_ERROR', async () => {
      mockClient.setGeneratorLevel.mockRejectedValue(
        new REWApiError('Internal error', 'INTERNAL_ERROR', 500)
      );
      mockClient.setGeneratorSignal.mockResolvedValue(true);

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
    });

    it('should handle REWApiError with INVALID_RESPONSE', async () => {
      mockClient.getSPLMeterLevels.mockRejectedValue(
        new REWApiError('Invalid response', 'INVALID_RESPONSE', 200)
      );

      const result = await executeApiCalibrateSPL({ action: 'check' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('invalid_response');
    });
  });

  describe('Unknown error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle unknown Error type', async () => {
      mockClient.executeGeneratorCommand.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await executeApiCalibrateSPL({ action: 'stop' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
      expect(result.suggestion).toContain('Check REW API connection');
    });

    it('should handle non-Error thrown values', async () => {
      mockClient.setGeneratorSignal.mockRejectedValue('String error');

      const result = await executeApiCalibrateSPL({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error occurred');
    });
  });

  describe('Default parameter values', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should use default target_spl of 85', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 85.0,
        leq: 84.5,
        sel: 85.0,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check' });

      expect(result.data?.calibration_status?.target_spl).toBe(85);
    });

    it('should use default tolerance_db of 1.0', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 85.5,  // Within default 1.0 dB tolerance of 85
        leq: 85.0,
        sel: 85.5,
        weighting: 'C',
        filter: 'Slow'
      });

      const result = await executeApiCalibrateSPL({ action: 'check' });

      expect(result.data?.calibration_status?.tolerance_db).toBe(1.0);
      expect(result.data?.calibration_status?.within_tolerance).toBe(true);
    });

    it('should use default weighting of C', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const promise = executeApiCalibrateSPL({ action: 'start' });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(mockClient.setSPLMeterConfig).toHaveBeenCalledWith(1, {
        weighting: 'C',
        filter: 'Slow'
      });
      expect(result.data?.calibration_status?.weighting).toBe('C');
    });

    it('should use default meter_id of 1', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      await executeApiCalibrateSPL({ action: 'stop' });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(1, 'Stop');
    });
  });
});
