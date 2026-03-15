/**
 * Unit tests for api-spl-meter tool handler
 *
 * Tests all action branches (start, stop, read, configure) and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiSPLMeter } from './api-spl-meter.js';
import { REWApiError } from '../api/rew-api-error.js';
import { z } from 'zod';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));

import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiSPLMeter', () => {
  // Mock REW client
  const mockClient = {
    setSPLMeterConfig: vi.fn(),
    executeSPLMeterCommand: vi.fn(),
    getSPLMeterLevels: vi.fn(),
    getSPLMeterConfig: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection handling', () => {
    it('should return connection_error when client is not connected', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiSPLMeter({
        action: 'start'
      });

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

    it('should start SPL meter without config', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'start'
      });

      expect(mockClient.setSPLMeterConfig).not.toHaveBeenCalled();
      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(1, 'Start');
      expect(result.status).toBe('success');
      expect(result.data).toMatchObject({
        action: 'start',
        success: true,
        message: 'SPL meter 1 started',
        meter_id: 1
      });
    });

    it('should configure meter before starting when config provided', async () => {
      mockClient.setSPLMeterConfig.mockResolvedValue(true);
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'start',
        config: {
          weighting: 'A',
          filter: 'Slow'
        }
      });

      expect(mockClient.setSPLMeterConfig).toHaveBeenCalledWith(1, {
        weighting: 'A',
        filter: 'Slow'
      });
      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(1, 'Start');
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
    });

    it('should work with meter_id 2', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'start',
        meter_id: 2
      });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(2, 'Start');
      expect(result.data?.meter_id).toBe(2);
      expect(result.data?.message).toContain('SPL meter 2');
    });

    it('should work with meter_id 3', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'start',
        meter_id: 3
      });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(3, 'Start');
      expect(result.data?.meter_id).toBe(3);
    });

    it('should work with meter_id 4', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'start',
        meter_id: 4
      });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(4, 'Start');
      expect(result.data?.meter_id).toBe(4);
    });

    it('should return failure when start command fails', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(false);

      const result = await executeApiSPLMeter({
        action: 'start'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to start SPL meter 1');
    });
  });

  describe('stop action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should stop SPL meter successfully', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'stop'
      });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(1, 'Stop');
      expect(result.status).toBe('success');
      expect(result.data).toMatchObject({
        action: 'stop',
        success: true,
        message: 'SPL meter 1 stopped',
        meter_id: 1
      });
    });

    it('should stop specific meter by ID', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'stop',
        meter_id: 3
      });

      expect(mockClient.executeSPLMeterCommand).toHaveBeenCalledWith(3, 'Stop');
      expect(result.data?.meter_id).toBe(3);
      expect(result.data?.message).toContain('SPL meter 3');
    });

    it('should return failure when stop command fails', async () => {
      mockClient.executeSPLMeterCommand.mockResolvedValue(false);

      const result = await executeApiSPLMeter({
        action: 'stop',
        meter_id: 2
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to stop SPL meter 2');
    });
  });

  describe('read action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return failure when getSPLMeterLevels returns null', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue(null);

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(mockClient.getSPLMeterLevels).toHaveBeenCalledWith(1);
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to read SPL meter');
      expect(result.data?.message).toContain('Meter may not be running');
    });

    it('should return levels object with all fields', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 75.4,
        leq: 74.8,
        sel: 76.2,
        weighting: 'A',
        filter: 'Slow'
      });

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toBe('SPL: 75.4 dBA');
      expect(result.data?.levels).toEqual({
        spl_db: 75.4,
        leq_db: 74.8,
        sel_db: 76.2,
        weighting: 'A',
        filter: 'Slow'
      });
    });

    it('should format SPL message with C weighting', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 82.1,
        leq: 81.5,
        sel: 83.0,
        weighting: 'C',
        filter: 'Fast'
      });

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(result.data?.message).toBe('SPL: 82.1 dBC');
    });

    it('should format SPL message with Z weighting', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 90.5,
        leq: 89.8,
        sel: 91.2,
        weighting: 'Z',
        filter: 'Impulse'
      });

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(result.data?.message).toBe('SPL: 90.5 dBZ');
    });

    it('should read from specific meter ID', async () => {
      mockClient.getSPLMeterLevels.mockResolvedValue({
        spl: 70.0,
        leq: 69.5,
        sel: 70.5,
        weighting: 'A',
        filter: 'Slow'
      });

      const result = await executeApiSPLMeter({
        action: 'read',
        meter_id: 4
      });

      expect(mockClient.getSPLMeterLevels).toHaveBeenCalledWith(4);
      expect(result.data?.meter_id).toBe(4);
    });
  });

  describe('configure action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return current config when config not provided', async () => {
      mockClient.getSPLMeterConfig.mockResolvedValue({
        mode: 'SPL',
        weighting: 'A',
        filter: 'Slow'
      });

      const result = await executeApiSPLMeter({
        action: 'configure'
      });

      expect(mockClient.getSPLMeterConfig).toHaveBeenCalledWith(1);
      expect(mockClient.setSPLMeterConfig).not.toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.data).toMatchObject({
        action: 'configure',
        success: true,
        message: 'Current SPL meter configuration',
        meter_id: 1,
        config: {
          mode: 'SPL',
          weighting: 'A',
          filter: 'Slow'
        }
      });
    });

    it('should handle null config from getSPLMeterConfig', async () => {
      mockClient.getSPLMeterConfig.mockResolvedValue(null);

      const result = await executeApiSPLMeter({
        action: 'configure'
      });

      expect(result.data?.config).toEqual({});
    });

    it('should set config when provided', async () => {
      mockClient.setSPLMeterConfig.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'configure',
        config: {
          mode: 'Leq',
          weighting: 'C',
          filter: 'Fast'
        }
      });

      expect(mockClient.setSPLMeterConfig).toHaveBeenCalledWith(1, {
        mode: 'Leq',
        weighting: 'C',
        filter: 'Fast'
      });
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('SPL meter 1 configured');
      expect(result.data?.config).toEqual({
        mode: 'Leq',
        weighting: 'C',
        filter: 'Fast'
      });
    });

    it('should configure specific meter by ID', async () => {
      mockClient.setSPLMeterConfig.mockResolvedValue(true);

      const result = await executeApiSPLMeter({
        action: 'configure',
        meter_id: 2,
        config: {
          weighting: 'Z'
        }
      });

      expect(mockClient.setSPLMeterConfig).toHaveBeenCalledWith(2, {
        weighting: 'Z'
      });
      expect(result.data?.meter_id).toBe(2);
    });

    it('should return failure when setSPLMeterConfig fails', async () => {
      mockClient.setSPLMeterConfig.mockResolvedValue(false);

      const result = await executeApiSPLMeter({
        action: 'configure',
        config: {
          weighting: 'A'
        }
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to configure SPL meter 1');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle ZodError with validation_error type', async () => {
      const result = await executeApiSPLMeter({
        action: 'start',
        meter_id: 0 // Below minimum of 1
      } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
      expect(result.suggestion).toContain('Check input parameters');
    });

    it('should handle REWApiError with connection_refused code', async () => {
      mockClient.executeSPLMeterCommand.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED')
      );

      const result = await executeApiSPLMeter({
        action: 'start'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.message).toBe('Connection refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should handle REWApiError with not_found code', async () => {
      mockClient.getSPLMeterLevels.mockRejectedValue(
        new REWApiError('Endpoint not found', 'NOT_FOUND')
      );

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
      expect(result.suggestion).toContain('Check REW application for errors');
    });

    it('should handle REWApiError with timeout code', async () => {
      mockClient.getSPLMeterConfig.mockRejectedValue(
        new REWApiError('Request timeout', 'TIMEOUT')
      );

      const result = await executeApiSPLMeter({
        action: 'configure'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('REW is busy or frozen');
    });

    it('should handle REWApiError with internal_error code', async () => {
      mockClient.executeSPLMeterCommand.mockRejectedValue(
        new REWApiError('Internal server error', 'INTERNAL_ERROR')
      );

      const result = await executeApiSPLMeter({
        action: 'stop'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.suggestion).toContain('Check REW application for errors');
    });

    it('should handle REWApiError with invalid_response code', async () => {
      mockClient.getSPLMeterLevels.mockRejectedValue(
        new REWApiError('Invalid response format', 'INVALID_RESPONSE')
      );

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('invalid_response');
      expect(result.suggestion).toContain('Check REW application for errors');
    });

    it('should handle unknown Error type', async () => {
      mockClient.executeSPLMeterCommand.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await executeApiSPLMeter({
        action: 'start'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
      expect(result.suggestion).toContain('Check REW API connection');
    });

    it('should handle unknown error without Error instance', async () => {
      mockClient.getSPLMeterLevels.mockRejectedValue('String error');

      const result = await executeApiSPLMeter({
        action: 'read'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error occurred');
      expect(result.suggestion).toContain('Check REW API connection');
    });
  });
});
