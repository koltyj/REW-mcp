/**
 * Unit tests for executeApiAudio tool handler
 *
 * Tests all action branches, error paths, and edge cases.
 * Target: 70%+ line coverage of api-audio.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiAudio } from './api-audio.js';
import { REWApiError } from '../api/rew-api-error.js';
import { z } from 'zod';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));
import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiAudio', () => {
  // Mock client structure
  const mockClient = {
    getAudioStatus: vi.fn(),
    getAudioDriver: vi.fn(),
    getSampleRate: vi.fn(),
    getJavaInputDevice: vi.fn(),
    getJavaOutputDevice: vi.fn(),
    getInputCalibration: vi.fn(),
    getJavaInputDevices: vi.fn(),
    getJavaOutputDevices: vi.fn(),
    getAvailableSampleRates: vi.fn(),
    setJavaInputDevice: vi.fn(),
    setJavaOutputDevice: vi.fn(),
    setSampleRate: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection handling', () => {
    it('should return connection_error when no active client', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiAudio({ action: 'status' });

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

    it('should return complete audio status with all fields populated', async () => {
      mockClient.getAudioStatus.mockResolvedValue({ enabled: true, ready: true, driver: 'Java' });
      mockClient.getAudioDriver.mockResolvedValue('CoreAudio');
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getJavaInputDevice.mockResolvedValue('Built-in Microphone');
      mockClient.getJavaOutputDevice.mockResolvedValue('Built-in Output');
      mockClient.getInputCalibration.mockResolvedValue({
        enabled: true,
        filename: 'cal.txt',
        offset: 94.0
      });

      const result = await executeApiAudio({ action: 'status' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('status');
      expect(result.data?.success).toBe(true);
      expect(result.data?.audio_status?.enabled).toBe(true);
      expect(result.data?.audio_status?.ready).toBe(true);
      expect(result.data?.audio_status?.driver).toBe('CoreAudio');
      expect(result.data?.audio_status?.sample_rate).toBe(48000);
      expect(result.data?.audio_status?.current_input).toBe('Built-in Microphone');
      expect(result.data?.audio_status?.current_output).toBe('Built-in Output');
      expect(result.data?.input_calibration?.enabled).toBe(true);
    });

    it('should handle null/undefined values gracefully', async () => {
      mockClient.getAudioStatus.mockResolvedValue(null);
      mockClient.getAudioDriver.mockResolvedValue(null);
      mockClient.getSampleRate.mockResolvedValue(null);
      mockClient.getJavaInputDevice.mockResolvedValue(null);
      mockClient.getJavaOutputDevice.mockResolvedValue(null);
      mockClient.getInputCalibration.mockResolvedValue(null);

      const result = await executeApiAudio({ action: 'status' });

      expect(result.status).toBe('success');
      expect(result.data?.audio_status?.enabled).toBe(false);
      expect(result.data?.audio_status?.ready).toBe(false);
      expect(result.data?.audio_status?.driver).toBeUndefined();
      expect(result.data?.audio_status?.sample_rate).toBeUndefined();
      expect(result.data?.input_calibration).toBeNull();
    });

    it('should prioritize driver from getAudioDriver over status', async () => {
      mockClient.getAudioStatus.mockResolvedValue({ enabled: true, ready: true, driver: 'Java' });
      mockClient.getAudioDriver.mockResolvedValue('CoreAudio');
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getJavaInputDevice.mockResolvedValue('Built-in Microphone');
      mockClient.getJavaOutputDevice.mockResolvedValue('Built-in Output');
      mockClient.getInputCalibration.mockResolvedValue(null);

      const result = await executeApiAudio({ action: 'status' });

      expect(result.data?.audio_status?.driver).toBe('CoreAudio');
    });
  });

  describe('list_devices action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return all device lists and sample rates', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Input 1', 'Input 2', 'Input 3']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Output 1', 'Output 2']);
      mockClient.getAvailableSampleRates.mockResolvedValue([44100, 48000, 96000]);

      const result = await executeApiAudio({ action: 'list_devices' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('list_devices');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('3 input devices');
      expect(result.data?.message).toContain('2 output devices');
      expect(result.data?.available_devices?.input_devices).toHaveLength(3);
      expect(result.data?.available_devices?.output_devices).toHaveLength(2);
      expect(result.data?.available_devices?.sample_rates).toEqual([44100, 48000, 96000]);
    });

    it('should handle empty device lists', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue([]);
      mockClient.getJavaOutputDevices.mockResolvedValue([]);
      mockClient.getAvailableSampleRates.mockResolvedValue([]);

      const result = await executeApiAudio({ action: 'list_devices' });

      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('0 input devices');
      expect(result.data?.message).toContain('0 output devices');
      expect(result.data?.available_devices?.input_devices).toEqual([]);
      expect(result.data?.available_devices?.output_devices).toEqual([]);
      expect(result.data?.available_devices?.sample_rates).toEqual([]);
    });
  });

  describe('set_input action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when device not provided', async () => {
      const result = await executeApiAudio({ action: 'set_input' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Device name required');
      expect(result.suggestion).toContain('list_devices');
    });

    it('should return success when setJavaInputDevice succeeds', async () => {
      mockClient.setJavaInputDevice.mockResolvedValue(true);

      const result = await executeApiAudio({
        action: 'set_input',
        device: 'Built-in Microphone'
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('set_input');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Built-in Microphone');
      expect(mockClient.setJavaInputDevice).toHaveBeenCalledWith('Built-in Microphone');
    });

    it('should return success with failure message when setJavaInputDevice returns false', async () => {
      mockClient.setJavaInputDevice.mockResolvedValue(false);

      const result = await executeApiAudio({
        action: 'set_input',
        device: 'Invalid Device'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to set input device');
      expect(result.data?.message).toContain('Check device name is correct');
    });
  });

  describe('set_output action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when device not provided', async () => {
      const result = await executeApiAudio({ action: 'set_output' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Device name required');
      expect(result.suggestion).toContain('list_devices');
    });

    it('should return success when setJavaOutputDevice succeeds', async () => {
      mockClient.setJavaOutputDevice.mockResolvedValue(true);

      const result = await executeApiAudio({
        action: 'set_output',
        device: 'Built-in Output'
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('set_output');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('Built-in Output');
      expect(mockClient.setJavaOutputDevice).toHaveBeenCalledWith('Built-in Output');
    });

    it('should return success with failure message when setJavaOutputDevice returns false', async () => {
      mockClient.setJavaOutputDevice.mockResolvedValue(false);

      const result = await executeApiAudio({
        action: 'set_output',
        device: 'Invalid Device'
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to set output device');
      expect(result.data?.message).toContain('Check device name is correct');
    });
  });

  describe('set_sample_rate action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation error when sample_rate not provided', async () => {
      const result = await executeApiAudio({ action: 'set_sample_rate' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Sample rate required');
      expect(result.suggestion).toContain('list_devices');
    });

    it('should return success when setSampleRate succeeds', async () => {
      mockClient.setSampleRate.mockResolvedValue(true);

      const result = await executeApiAudio({
        action: 'set_sample_rate',
        sample_rate: 96000
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('set_sample_rate');
      expect(result.data?.success).toBe(true);
      expect(result.data?.message).toContain('96000 Hz');
      expect(mockClient.setSampleRate).toHaveBeenCalledWith(96000);
    });

    it('should return success with failure message when setSampleRate returns false', async () => {
      mockClient.setSampleRate.mockResolvedValue(false);

      const result = await executeApiAudio({
        action: 'set_sample_rate',
        sample_rate: 192000
      });

      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('Failed to set sample rate');
      expect(result.data?.message).toContain('not be supported');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return validation_error for invalid action (ZodError)', async () => {
      // @ts-expect-error - Testing invalid action
      const result = await executeApiAudio({ action: 'invalid_action' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
      expect(result.suggestion).toContain('Check input parameters');
    });

    it('should return validation_error for missing required action', async () => {
      // @ts-expect-error - Testing missing action
      const result = await executeApiAudio({});

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
    });

    it('should return typed error for REWApiError with NOT_FOUND', async () => {
      mockClient.getAudioStatus.mockRejectedValue(new REWApiError('Not found', 'NOT_FOUND', 404));

      const result = await executeApiAudio({ action: 'status' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('not_found');
      expect(result.message).toBe('Not found');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should return typed error for REWApiError with CONNECTION_REFUSED', async () => {
      mockClient.getAudioStatus.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED', 0)
      );

      const result = await executeApiAudio({ action: 'status' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should return typed error for REWApiError with TIMEOUT', async () => {
      mockClient.getJavaInputDevices.mockRejectedValue(
        new REWApiError('Request timed out', 'TIMEOUT', 0)
      );

      const result = await executeApiAudio({ action: 'list_devices' });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('REW is busy or frozen');
    });

    it('should return typed error for REWApiError with INTERNAL_ERROR', async () => {
      mockClient.setJavaInputDevice.mockRejectedValue(
        new REWApiError('Internal error', 'INTERNAL_ERROR', 500)
      );

      const result = await executeApiAudio({
        action: 'set_input',
        device: 'Test Device'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should return typed error for REWApiError with INVALID_RESPONSE', async () => {
      mockClient.setJavaOutputDevice.mockRejectedValue(
        new REWApiError('Invalid response format', 'INVALID_RESPONSE', 0)
      );

      const result = await executeApiAudio({
        action: 'set_output',
        device: 'Test Device'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('invalid_response');
      expect(result.suggestion).toContain('Check REW application');
    });

    it('should return internal_error for unknown error types', async () => {
      mockClient.setSampleRate.mockRejectedValue(new Error('Unexpected error'));

      const result = await executeApiAudio({
        action: 'set_sample_rate',
        sample_rate: 48000
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
      expect(result.suggestion).toContain('Check REW API connection');
    });

    it('should handle non-Error thrown values', async () => {
      mockClient.setJavaInputDevice.mockRejectedValue('String error');

      const result = await executeApiAudio({
        action: 'set_input',
        device: 'Test Device'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error occurred');
    });
  });
});
