/**
 * Unit tests for executeApiGenerator tool handler
 *
 * Tests all action branches, error paths, and edge cases.
 * Target: 70%+ line coverage of api-generator.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiGenerator } from './api-generator.js';
import { REWApiError } from '../api/rew-api-error.js';
import { z } from 'zod';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));
import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiGenerator', () => {
  // Mock client structure
  const mockClient = {
    getGeneratorStatus: vi.fn(),
    getGeneratorSignal: vi.fn(),
    getGeneratorLevel: vi.fn(),
    getGeneratorFrequency: vi.fn(),
    getGeneratorCommands: vi.fn(),
    getGeneratorSignals: vi.fn(),
    executeGeneratorCommand: vi.fn(),
    setGeneratorSignal: vi.fn(),
    setGeneratorLevel: vi.fn(),
    setGeneratorFrequency: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection handling', () => {
    it('should return connection_error when no active client', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_error');
      expect(result.message).toContain('Not connected to REW API');
      expect(result.suggestion).toContain('rew.api_connect');
    });
  });

  describe('status action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return complete generator status when playing', async () => {
      mockClient.getGeneratorStatus.mockResolvedValue({
        enabled: true,
        playing: true,
        signal: 'pinknoise',
        level: -18
      });
      mockClient.getGeneratorSignal.mockResolvedValue('Pink noise');
      mockClient.getGeneratorLevel.mockResolvedValue({ level: -18, unit: 'dBFS' });
      mockClient.getGeneratorFrequency.mockResolvedValue(1000);
      mockClient.getGeneratorCommands.mockResolvedValue(['Play', 'Stop']);

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('status');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toBe('Generator is playing');
      expect(result.data?.generator_status?.enabled).toBe(true);
      expect(result.data?.generator_status?.playing).toBe(true);
      expect(result.data?.generator_status?.signal).toBe('Pink noise');
      expect(result.data?.generator_status?.level_db).toBe(-18);
      expect(result.data?.generator_status?.frequency_hz).toBe(1000);
      expect(result.data?.available_commands).toEqual(['Play', 'Stop']);
    });

    it('should return complete generator status when stopped', async () => {
      mockClient.getGeneratorStatus.mockResolvedValue({
        enabled: true,
        playing: false,
        signal: 'sine',
        level: -12
      });
      mockClient.getGeneratorSignal.mockResolvedValue('Sine');
      mockClient.getGeneratorLevel.mockResolvedValue({ level: -12, unit: 'dBFS' });
      mockClient.getGeneratorFrequency.mockResolvedValue(500);
      mockClient.getGeneratorCommands.mockResolvedValue(['Play', 'Stop']);

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.status).toBe('success');
      expect(result.data?.message).toBe('Generator is stopped');
      expect(result.data?.generator_status?.playing).toBe(false);
    });

    it('should handle null/undefined status values gracefully', async () => {
      mockClient.getGeneratorStatus.mockResolvedValue(null);
      mockClient.getGeneratorSignal.mockResolvedValue(null);
      mockClient.getGeneratorLevel.mockResolvedValue(null);
      mockClient.getGeneratorFrequency.mockResolvedValue(null);
      mockClient.getGeneratorCommands.mockResolvedValue([]);

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.status).toBe('success');
      expect(result.data?.message).toBe('Generator is stopped');
      expect(result.data?.generator_status?.enabled).toBe(false);
      expect(result.data?.generator_status?.playing).toBe(false);
      expect(result.data?.generator_status?.signal).toBeUndefined();
      expect(result.data?.generator_status?.level_db).toBeUndefined();
      expect(result.data?.generator_status?.frequency_hz).toBeUndefined();
    });

    it('should prioritize getGeneratorSignal over status.signal', async () => {
      mockClient.getGeneratorStatus.mockResolvedValue({
        enabled: true,
        playing: false,
        signal: 'old-signal',
        level: -18
      });
      mockClient.getGeneratorSignal.mockResolvedValue('Pink noise');
      mockClient.getGeneratorLevel.mockResolvedValue({ level: -18, unit: 'dBFS' });
      mockClient.getGeneratorFrequency.mockResolvedValue(1000);
      mockClient.getGeneratorCommands.mockResolvedValue(['Play', 'Stop']);

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.data?.generator_status?.signal).toBe('Pink noise');
    });

    it('should prioritize getGeneratorLevel over status.level', async () => {
      mockClient.getGeneratorStatus.mockResolvedValue({
        enabled: true,
        playing: false,
        signal: 'pinknoise',
        level: -20
      });
      mockClient.getGeneratorSignal.mockResolvedValue('Pink noise');
      mockClient.getGeneratorLevel.mockResolvedValue({ level: -15, unit: 'dBFS' });
      mockClient.getGeneratorFrequency.mockResolvedValue(1000);
      mockClient.getGeneratorCommands.mockResolvedValue(['Play', 'Stop']);

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.data?.generator_status?.level_db).toBe(-15);
    });
  });

  describe('list_signals action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return available signals list', async () => {
      mockClient.getGeneratorSignals.mockResolvedValue([
        'Pink noise',
        'White noise',
        'Sine',
        'Sweep'
      ]);

      const result = await executeApiGenerator({ action: 'list_signals' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('list_signals');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('4 signals available');
      expect(result.data?.available_signals).toHaveLength(4);
      expect(result.data?.available_signals).toContain('Pink noise');
    });

    it('should handle empty signals list', async () => {
      mockClient.getGeneratorSignals.mockResolvedValue([]);

      const result = await executeApiGenerator({ action: 'list_signals' });

      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('0 signals available');
      expect(result.data?.available_signals).toEqual([]);
    });
  });

  describe('start action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should call executeGeneratorCommand with Play when successful', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiGenerator({ action: 'start' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('start');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toBe('Generator started');
      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Play');
    });

    it('should return failure message when executeGeneratorCommand returns false', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(false);

      const result = await executeApiGenerator({ action: 'start' });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toBe('Failed to start generator');
    });
  });

  describe('stop action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should call executeGeneratorCommand with Stop when successful', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiGenerator({ action: 'stop' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('stop');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toBe('Generator stopped');
      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
    });

    it('should return failure message when executeGeneratorCommand returns false', async () => {
      mockClient.executeGeneratorCommand.mockResolvedValue(false);

      const result = await executeApiGenerator({ action: 'stop' });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toBe('Failed to stop generator');
    });
  });

  describe('set_signal action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when signal not provided', async () => {
      const result = await executeApiGenerator({ action: 'set_signal' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Signal type required');
      expect(result.suggestion).toContain('list_signals');
    });

    it('should return success when setGeneratorSignal succeeds', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);

      const result = await executeApiGenerator({
        action: 'set_signal',
        signal: 'Pink noise'
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('set_signal');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Pink noise');
      expect(mockClient.setGeneratorSignal).toHaveBeenCalledWith('Pink noise');
    });

    it('should return success with failure message when setGeneratorSignal returns false', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(false);

      const result = await executeApiGenerator({
        action: 'set_signal',
        signal: 'Invalid Signal'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to set signal');
      expect(result.data?.message).toContain('Check signal name is correct');
    });
  });

  describe('set_level action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when level_db not provided', async () => {
      const result = await executeApiGenerator({ action: 'set_level' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Level required');
      expect(result.suggestion).toContain('between -60 and 0');
    });

    it('should return success when setGeneratorLevel succeeds', async () => {
      mockClient.setGeneratorLevel.mockResolvedValue(true);

      const result = await executeApiGenerator({
        action: 'set_level',
        level_db: -18
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('set_level');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('-18 dBFS');
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-18, 'dBFS');
    });

    it('should handle level_db = 0 (valid edge case)', async () => {
      mockClient.setGeneratorLevel.mockResolvedValue(true);

      const result = await executeApiGenerator({
        action: 'set_level',
        level_db: 0
      });

      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('0 dBFS');
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(0, 'dBFS');
    });

    it('should return success with failure message when setGeneratorLevel returns false', async () => {
      mockClient.setGeneratorLevel.mockResolvedValue(false);

      const result = await executeApiGenerator({
        action: 'set_level',
        level_db: -25
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to set level');
    });
  });

  describe('set_frequency action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when frequency_hz not provided', async () => {
      const result = await executeApiGenerator({ action: 'set_frequency' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Frequency required');
      expect(result.suggestion).toContain('between 20 and 20000');
    });

    it('should return success when setGeneratorFrequency succeeds', async () => {
      mockClient.setGeneratorFrequency.mockResolvedValue(true);

      const result = await executeApiGenerator({
        action: 'set_frequency',
        frequency_hz: 1000
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('set_frequency');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('1000 Hz');
      expect(mockClient.setGeneratorFrequency).toHaveBeenCalledWith(1000);
    });

    it('should handle edge case frequencies (20 Hz, 20000 Hz)', async () => {
      mockClient.setGeneratorFrequency.mockResolvedValue(true);

      const result20 = await executeApiGenerator({
        action: 'set_frequency',
        frequency_hz: 20
      });
      expect(result20.data?.message).toContain('20 Hz');

      const result20k = await executeApiGenerator({
        action: 'set_frequency',
        frequency_hz: 20000
      });
      expect(result20k.data?.message).toContain('20000 Hz');
    });

    it('should return success with failure message when setGeneratorFrequency returns false', async () => {
      mockClient.setGeneratorFrequency.mockResolvedValue(false);

      const result = await executeApiGenerator({
        action: 'set_frequency',
        frequency_hz: 500
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to set frequency');
      expect(result.data?.message).toContain('may not support frequency');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation_error for invalid action (ZodError)', async () => {
      // @ts-expect-error - Testing invalid action
      const result = await executeApiGenerator({ action: 'invalid_action' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
      expect(result.suggestion).toContain('Check input parameters');
    });

    it('should return validation_error for missing required action', async () => {
      // @ts-expect-error - Testing missing action
      const result = await executeApiGenerator({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
    });

    it('should return typed error for REWApiError with NOT_FOUND', async () => {
      mockClient.getGeneratorStatus.mockRejectedValue(
        new REWApiError('Not found', 'NOT_FOUND', 404)
      );

      const result = await executeApiGenerator({ action: 'status' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
      expect(result.message).toBe('Not found');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should return typed error for REWApiError with CONNECTION_REFUSED', async () => {
      mockClient.executeGeneratorCommand.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED', 0)
      );

      const result = await executeApiGenerator({ action: 'start' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should return typed error for REWApiError with TIMEOUT', async () => {
      mockClient.setGeneratorSignal.mockRejectedValue(
        new REWApiError('Request timed out', 'TIMEOUT', 0)
      );

      const result = await executeApiGenerator({
        action: 'set_signal',
        signal: 'Pink noise'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('REW is busy or frozen');
    });

    it('should return typed error for REWApiError with INTERNAL_ERROR', async () => {
      mockClient.setGeneratorLevel.mockRejectedValue(
        new REWApiError('Internal error', 'INTERNAL_ERROR', 500)
      );

      const result = await executeApiGenerator({
        action: 'set_level',
        level_db: -18
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should return typed error for REWApiError with INVALID_RESPONSE', async () => {
      mockClient.setGeneratorFrequency.mockRejectedValue(
        new REWApiError('Invalid response format', 'INVALID_RESPONSE', 0)
      );

      const result = await executeApiGenerator({
        action: 'set_frequency',
        frequency_hz: 1000
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('invalid_response');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should return internal_error for unknown error types', async () => {
      mockClient.getGeneratorSignals.mockRejectedValue(new Error('Unexpected error'));

      const result = await executeApiGenerator({ action: 'list_signals' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
      expect(result.suggestion).toContain('Check REW API connection');
    });

    it('should handle non-Error thrown values', async () => {
      mockClient.executeGeneratorCommand.mockRejectedValue('String error');

      const result = await executeApiGenerator({ action: 'stop' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error occurred');
    });
  });
});
