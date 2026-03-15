/**
 * Unit tests for api-measure tool handler
 *
 * Tests all action branches (status, configure, sweep, spl, cancel) and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiMeasure } from './api-measure.js';
import { REWApiError } from '../api/rew-api-error.js';
import { z } from 'zod';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));

import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiMeasure', () => {
  // Mock REW client
  const mockClient = {
    getMeasureLevel: vi.fn(),
    getSweepConfig: vi.fn(),
    getMeasureCommands: vi.fn(),
    setMeasureLevel: vi.fn(),
    setSweepConfig: vi.fn(),
    setMeasureNotes: vi.fn(),
    executeMeasureCommand: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection handling', () => {
    it('should return connection_error when client is not connected', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiMeasure({
        action: 'status'
      });

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

    it('should return current measurement status with all config fields', async () => {
      mockClient.getMeasureLevel.mockResolvedValue({ level: -12, unit: 'dBFS' });
      mockClient.getSweepConfig.mockResolvedValue({
        startFreq: 20,
        endFreq: 20000,
        length: 131072
      });
      mockClient.getMeasureCommands.mockResolvedValue(['Measure', 'SPL', 'Cancel']);

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('success');
      expect(result.data).toMatchObject({
        action: 'status',
        success: true,
        message: 'Measurement status retrieved',
        current_config: {
          level_db: -12,
          level_unit: 'dBFS',
          sweep_start_hz: 20,
          sweep_end_hz: 20000,
          sweep_length: 131072
        },
        available_commands: ['Measure', 'SPL', 'Cancel']
      });
    });

    it('should handle null/undefined values in status gracefully', async () => {
      mockClient.getMeasureLevel.mockResolvedValue(null);
      mockClient.getSweepConfig.mockResolvedValue(null);
      mockClient.getMeasureCommands.mockResolvedValue([]);

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('success');
      expect(result.data?.current_config).toEqual({
        level_db: undefined,
        level_unit: undefined,
        sweep_start_hz: undefined,
        sweep_end_hz: undefined,
        sweep_length: undefined
      });
      expect(result.data?.available_commands).toEqual([]);
    });
  });

  describe('configure action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when config not provided', async () => {
      const result = await executeApiMeasure({
        action: 'configure'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Configuration options required');
      expect(result.suggestion).toContain('Provide config object');
    });

    it('should set level_db when provided', async () => {
      mockClient.setMeasureLevel.mockResolvedValue(true);

      const result = await executeApiMeasure({
        action: 'configure',
        config: {
          level_db: -18
        }
      });

      expect(mockClient.setMeasureLevel).toHaveBeenCalledWith(-18, 'dBFS');
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Level: set');
    });

    it('should set sweep config when freq params provided', async () => {
      mockClient.setSweepConfig.mockResolvedValue(true);

      const result = await executeApiMeasure({
        action: 'configure',
        config: {
          start_freq_hz: 10,
          end_freq_hz: 24000,
          sweep_length: 262144
        }
      });

      expect(mockClient.setSweepConfig).toHaveBeenCalledWith({
        startFreq: 10,
        endFreq: 24000,
        length: 262144
      });
      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('Sweep config: set');
    });

    it('should set notes when provided', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);

      const result = await executeApiMeasure({
        action: 'configure',
        config: {
          notes: 'Test measurement'
        }
      });

      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Test measurement');
      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('Notes: set');
    });

    it('should set multiple config options in one call', async () => {
      mockClient.setMeasureLevel.mockResolvedValue(true);
      mockClient.setSweepConfig.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);

      const result = await executeApiMeasure({
        action: 'configure',
        config: {
          level_db: -15,
          start_freq_hz: 20,
          end_freq_hz: 20000,
          notes: 'Full config test'
        }
      });

      expect(mockClient.setMeasureLevel).toHaveBeenCalledWith(-15, 'dBFS');
      expect(mockClient.setSweepConfig).toHaveBeenCalledWith({
        startFreq: 20,
        endFreq: 20000
      });
      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Full config test');
      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('Level: set');
      expect(result.data?.message).toContain('Sweep config: set');
      expect(result.data?.message).toContain('Notes: set');
    });

    it('should report failed configuration', async () => {
      mockClient.setMeasureLevel.mockResolvedValue(false);

      const result = await executeApiMeasure({
        action: 'configure',
        config: {
          level_db: -12
        }
      });

      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('Level: failed');
    });
  });

  describe('sweep action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should apply config before sweep when provided', async () => {
      mockClient.setMeasureLevel.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const result = await executeApiMeasure({
        action: 'sweep',
        config: {
          level_db: -12,
          notes: 'Pre-config sweep'
        }
      });

      expect(mockClient.setMeasureLevel).toHaveBeenCalledWith(-12, 'dBFS');
      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Pre-config sweep');
      expect(mockClient.executeMeasureCommand).toHaveBeenCalledWith('Measure');
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
    });

    it('should return success with async message on 202 status', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 202
      });

      const result = await executeApiMeasure({
        action: 'sweep'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('asynchronously');
    });

    it('should return success with completed message on 200 status', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const result = await executeApiMeasure({
        action: 'sweep'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('completed');
    });

    it('should detect Pro license requirement on 403 status', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 403
      });

      const result = await executeApiMeasure({
        action: 'sweep'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('REW Pro license');
      expect(result.data?.pro_license_required).toBe(true);
    });

    it('should detect Pro license from data containing "pro"', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 500,
        data: 'REW Pro required for this feature'
      });

      const result = await executeApiMeasure({
        action: 'sweep'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('REW Pro license');
      expect(result.data?.pro_license_required).toBe(true);
    });

    it('should handle sweep failure with generic message', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 500
      });

      const result = await executeApiMeasure({
        action: 'sweep'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('HTTP 500');
      expect(result.data?.pro_license_required).toBe(false);
    });
  });

  describe('spl action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should call executeMeasureCommand with SPL on success', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const result = await executeApiMeasure({
        action: 'spl'
      });

      expect(mockClient.executeMeasureCommand).toHaveBeenCalledWith('SPL');
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('SPL measurement started');
    });

    it('should return failure when SPL command fails', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 500
      });

      const result = await executeApiMeasure({
        action: 'spl'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('SPL measurement failed');
      expect(result.data?.message).toContain('HTTP 500');
    });
  });

  describe('cancel action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should call executeMeasureCommand with Cancel on success', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const result = await executeApiMeasure({
        action: 'cancel'
      });

      expect(mockClient.executeMeasureCommand).toHaveBeenCalledWith('Cancel');
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Measurement cancelled');
    });

    it('should return failure message when cancel fails', async () => {
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 404
      });

      const result = await executeApiMeasure({
        action: 'cancel'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('No measurement to cancel');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle ZodError with validation_error type', async () => {
      const result = await executeApiMeasure({
        action: 'status',
        config: {
          level_db: 100 // Out of range
        }
      } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
      expect(result.suggestion).toContain('Check input parameters');
    });

    it('should handle REWApiError with connection_refused code', async () => {
      mockClient.getMeasureLevel.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED')
      );

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.message).toBe('Connection refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should handle REWApiError with not_found code', async () => {
      mockClient.getMeasureLevel.mockRejectedValue(
        new REWApiError('Endpoint not found', 'NOT_FOUND')
      );

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
      expect(result.suggestion).toContain('Check REW application for errors');
    });

    it('should handle REWApiError with timeout code', async () => {
      mockClient.getMeasureLevel.mockRejectedValue(
        new REWApiError('Request timeout', 'TIMEOUT')
      );

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('REW is busy or frozen');
    });

    it('should handle REWApiError with internal_error code', async () => {
      mockClient.getMeasureLevel.mockRejectedValue(
        new REWApiError('Internal server error', 'INTERNAL_ERROR')
      );

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.suggestion).toContain('Check REW application for errors');
    });

    it('should handle REWApiError with invalid_response code', async () => {
      mockClient.getMeasureLevel.mockRejectedValue(
        new REWApiError('Invalid response format', 'INVALID_RESPONSE')
      );

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('invalid_response');
      expect(result.suggestion).toContain('Check REW application for errors');
    });

    it('should handle unknown Error type', async () => {
      mockClient.getMeasureLevel.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
      expect(result.suggestion).toContain('Check REW API connection');
    });

    it('should handle unknown error without Error instance', async () => {
      mockClient.getMeasureLevel.mockRejectedValue('String error');

      const result = await executeApiMeasure({
        action: 'status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error occurred');
      expect(result.suggestion).toContain('Check REW API connection');
    });
  });
});
