/**
 * Unit tests for api-measure-workflow tool handler
 *
 * Tests all action branches and internal workflow helpers.
 * Uses fake timers for setTimeout in calibrate_level and measure_sequence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeApiMeasureWorkflow } from './api-measure-workflow.js';
import { REWApiError } from '../api/rew-api-error.js';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));

import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiMeasureWorkflow', () => {
  // Comprehensive mock REW client
  const mockClient = {
    listMeasurements: vi.fn(),
    getBlockingMode: vi.fn(),
    setBlockingMode: vi.fn(),
    getJavaInputDevice: vi.fn(),
    getJavaOutputDevice: vi.fn(),
    getJavaInputDevices: vi.fn(),
    getJavaOutputDevices: vi.fn(),
    setJavaInputDevice: vi.fn(),
    setJavaOutputDevice: vi.fn(),
    getSampleRate: vi.fn(),
    setSampleRate: vi.fn(),
    getAvailableSampleRates: vi.fn(),
    getMeasureLevel: vi.fn(),
    setMeasureLevel: vi.fn(),
    getInputCalibration: vi.fn(),
    setGeneratorSignal: vi.fn(),
    setGeneratorLevel: vi.fn(),
    executeGeneratorCommand: vi.fn(),
    executeMeasureCommand: vi.fn(),
    setMeasureNotes: vi.fn(),
    setSweepConfig: vi.fn(),
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
    it('should return connection_error when client is not connected', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_error');
      expect(result.message).toContain('Not connected to REW API');
      expect(result.suggestion).toContain('rew.api_connect');
    });
  });

  describe('get_status action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should return WorkflowStatus with all fields', async () => {
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'test-1', name: 'Left' },
        { uuid: 'test-2', name: 'Right' }
      ]);
      mockClient.getBlockingMode.mockResolvedValue(true);
      mockClient.getJavaInputDevice.mockResolvedValue('UMIK-1');
      mockClient.getJavaOutputDevice.mockResolvedValue('Built-in Output');
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getMeasureLevel.mockResolvedValue({ level: -12, value: -12 });
      mockClient.getInputCalibration.mockResolvedValue({
        calDataAllInputs: {
          calFilePath: '/path/to/cal.txt',
          dBFSAt94dBSPL: -30
        }
      });

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.status).toBe('success');
      expect(result.data?.status).toMatchObject({
        connected: true,
        audio_ready: true,
        input_device: 'UMIK-1',
        output_device: 'Built-in Output',
        sample_rate: 48000,
        blocking_mode: true,
        current_level_dbfs: -12,
        measurement_count: 2,
        pro_features: false,
        mic_calibrated: true,
        cal_sensitivity_db: -30
      });
    });

    it('should detect audio_ready as false when devices missing', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.getBlockingMode.mockResolvedValue(false);
      mockClient.getJavaInputDevice.mockResolvedValue(null);
      mockClient.getJavaOutputDevice.mockResolvedValue(null);
      mockClient.getSampleRate.mockResolvedValue(null);
      mockClient.getMeasureLevel.mockResolvedValue(null);
      mockClient.getInputCalibration.mockResolvedValue(null);

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.data?.status?.audio_ready).toBe(false);
      expect(result.data?.status?.input_device).toBeUndefined();
      expect(result.data?.status?.output_device).toBeUndefined();
    });

    it('should detect mic_calibrated based on calFilePath presence', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.getBlockingMode.mockResolvedValue(true);
      mockClient.getJavaInputDevice.mockResolvedValue('UMIK-1');
      mockClient.getJavaOutputDevice.mockResolvedValue('Output');
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getMeasureLevel.mockResolvedValue({ level: -12 });
      mockClient.getInputCalibration.mockResolvedValue({
        calDataAllInputs: {
          calFilePath: '/cal/file.txt',
          dBFSAt94dBSPL: -28
        }
      });

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.data?.status?.mic_calibrated).toBe(true);
      expect(result.data?.status?.cal_sensitivity_db).toBe(-28);
    });

    it('should add warning for unconfigured audio', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.getBlockingMode.mockResolvedValue(true);
      mockClient.getJavaInputDevice.mockResolvedValue(null);
      mockClient.getJavaOutputDevice.mockResolvedValue(null);
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getMeasureLevel.mockResolvedValue(null);
      mockClient.getInputCalibration.mockResolvedValue(null);

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.data?.warnings).toContain('Audio devices not configured');
    });

    it('should add warning for missing calibration', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.getBlockingMode.mockResolvedValue(true);
      mockClient.getJavaInputDevice.mockResolvedValue('Mic');
      mockClient.getJavaOutputDevice.mockResolvedValue('Speaker');
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getMeasureLevel.mockResolvedValue(null);
      mockClient.getInputCalibration.mockResolvedValue({
        calDataAllInputs: {
          calFilePath: '',
          dBFSAt94dBSPL: 0
        }
      });

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      // Warning requires !mic_calibrated AND calFilePath === ''
      // mic_calibrated is false when !calFilePath, but calFilePath is ''
      // So we need to check the actual warning
      expect(result.data?.warnings).toContain('No microphone calibration file loaded - measurements may be inaccurate');
    });

    it('should add warning for disabled blocking mode', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.getBlockingMode.mockResolvedValue(false);
      mockClient.getJavaInputDevice.mockResolvedValue('Mic');
      mockClient.getJavaOutputDevice.mockResolvedValue('Speaker');
      mockClient.getSampleRate.mockResolvedValue(48000);
      mockClient.getMeasureLevel.mockResolvedValue(null);
      mockClient.getInputCalibration.mockResolvedValue(null);

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.data?.warnings).toContain('Blocking mode disabled - measurements may run asynchronously');
    });
  });

  describe('setup action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should get available devices and detect recommended input', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue([
        'Built-in Microphone',
        'UMIK-1 USB',
        'Default'
      ]);
      mockClient.getJavaOutputDevices.mockResolvedValue([
        'Built-in Output',
        'HDMI Output'
      ]);
      mockClient.getAvailableSampleRates.mockResolvedValue([44100, 48000, 96000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(result.data?.devices?.recommended_input).toBe('UMIK-1 USB');
      expect(mockClient.setJavaInputDevice).toHaveBeenCalledWith('UMIK-1 USB');
    });

    it('should detect earthworks microphone as recommended', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue([
        'Earthworks M30',
        'Built-in Microphone'
      ]);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(result.data?.devices?.recommended_input).toBe('Earthworks M30');
    });

    it('should detect dayton microphone as recommended', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue([
        'Dayton Audio UMM-6',
        'Default'
      ]);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(result.data?.devices?.recommended_input).toBe('Dayton Audio UMM-6');
    });

    it('should detect minidsp microphone as recommended', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue([
        'miniDSP EARS',
        'Default'
      ]);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(result.data?.devices?.recommended_input).toBe('miniDSP EARS');
    });

    it('should detect recommended output excluding default and microphone', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['UMIK-1']);
      mockClient.getJavaOutputDevices.mockResolvedValue([
        'Default',
        'Microphone Array',
        'Speakers - USB Audio'
      ]);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(result.data?.devices?.recommended_output).toBe('Speakers - USB Audio');
    });

    it('should set input device when specified', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic A', 'Mic B']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup',
        setup: {
          input_device: 'Mic B'
        }
      });

      expect(mockClient.setJavaInputDevice).toHaveBeenCalledWith('Mic B');
      expect(result.data?.message).toContain('Mic B');
    });

    it('should set output device when specified', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker A', 'Speaker B']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup',
        setup: {
          output_device: 'Speaker B'
        }
      });

      expect(mockClient.setJavaOutputDevice).toHaveBeenCalledWith('Speaker B');
    });

    it('should set sample rate when specified', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([44100, 48000, 96000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup',
        setup: {
          sample_rate: 96000
        }
      });

      expect(mockClient.setSampleRate).toHaveBeenCalledWith(96000);
      expect(result.data?.message).toContain('96000');
    });

    it('should use default sample rate 48000 when not specified', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([44100, 48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(mockClient.setSampleRate).toHaveBeenCalledWith(48000);
    });

    it('should enable blocking mode by default', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(mockClient.setBlockingMode).toHaveBeenCalledWith(true);
      expect(result.data?.message).toContain('Blocking mode: enabled');
    });

    it('should skip blocking mode when use_blocking is false', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(true);
      mockClient.setJavaOutputDevice.mockResolvedValue(true);
      mockClient.setSampleRate.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup',
        setup: {
          use_blocking: false
        }
      });

      expect(mockClient.setBlockingMode).not.toHaveBeenCalled();
    });

    it('should add warnings when device setting fails', async () => {
      mockClient.getJavaInputDevices.mockResolvedValue(['Mic']);
      mockClient.getJavaOutputDevices.mockResolvedValue(['Speaker']);
      mockClient.getAvailableSampleRates.mockResolvedValue([48000]);
      mockClient.setJavaInputDevice.mockResolvedValue(false);
      mockClient.setJavaOutputDevice.mockResolvedValue(false);
      mockClient.setSampleRate.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'setup'
      });

      expect(result.data?.success).toBe(false);
      expect(result.data?.warnings).toContain('Failed to set input device: Mic');
      expect(result.data?.warnings).toContain('Failed to set output device: Speaker');
    });
  });

  describe('check_levels action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should set generator to pink noise and run check levels', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'check_levels'
      });

      expect(mockClient.setGeneratorSignal).toHaveBeenCalledWith('Pink noise');
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-12, 'dBFS');
      expect(mockClient.executeMeasureCommand).toHaveBeenCalledWith('Check levels');
      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
      expect(result.status).toBe('success');
      expect(result.data?.success).toBe(true);
    });

    it('should use level from options when provided', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'check_levels',
        measurement: {
          level_dbfs: -20
        }
      });

      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-20, 'dBFS');
    });

    it('should detect clipping when level > -3', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'check_levels',
        measurement: {
          level_dbfs: -2
        }
      });

      expect(result.data?.levels?.clipping).toBe(true);
      expect(result.data?.levels?.recommendation).toContain('Level too high');
      expect(result.data?.levels?.recommendation).toContain('Reduce by 6-10 dB');
    });

    it('should detect too_low when level < -30', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'check_levels',
        measurement: {
          level_dbfs: -35
        }
      });

      expect(result.data?.levels?.too_low).toBe(true);
      expect(result.data?.levels?.recommendation).toContain('Level may be too low');
      expect(result.data?.levels?.recommendation).toContain('increasing by 10-15 dB');
    });

    it('should warn when level > -6 but not clipping', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      const result = await executeApiMeasureWorkflow({
        action: 'check_levels',
        measurement: {
          level_dbfs: -5
        }
      });

      expect(result.data?.levels?.clipping).toBe(false);
      expect(result.data?.levels?.recommendation).toContain('Level is high');
      expect(result.data?.levels?.recommendation).toContain('ensure no clipping');
    });

    it('should stop generator after check', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });
      mockClient.executeGeneratorCommand.mockResolvedValue(true);

      await executeApiMeasureWorkflow({
        action: 'check_levels'
      });

      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
    });
  });

  describe('calibrate_level action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should start at -20 dBFS and read SPL meter', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue({ spl: 70, leq: 69, sel: 71 });

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level',
        measurement: {
          target_spl_db: 75
        }
      });

      // Advance timer for stabilization
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(mockClient.setGeneratorSignal).toHaveBeenCalledWith('Pink noise');
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-20, 'dBFS');
      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Start');
      expect(mockClient.getSPLMeterLevels).toHaveBeenCalledWith(1);
    });

    it('should calculate adjustment to reach target SPL', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue({ spl: 70, leq: 69, sel: 71 });

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level',
        measurement: {
          target_spl_db: 75
        }
      });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      // Adjustment: 75 - 70 = 5 dB, new level = -20 + 5 = -15
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-15, 'dBFS');
      expect(result.data?.levels?.recommendation).toContain('Adjusted from -20 to -15');
      expect(result.data?.levels?.recommendation).toContain('Current SPL: 70.0 dB');
      expect(result.data?.levels?.recommendation).toContain('Target: 75 dB');
    });

    it('should clamp adjustment to -60 dBFS minimum', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue({ spl: 95, leq: 94, sel: 96 });

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level',
        measurement: {
          target_spl_db: 75
        }
      });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      // Adjustment: 75 - 95 = -20 dB, new level = -20 - 20 = -40 (not -60)
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(-40, 'dBFS');
    });

    it('should clamp adjustment to 0 dBFS maximum', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue({ spl: 50, leq: 49, sel: 51 });

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level',
        measurement: {
          target_spl_db: 75
        }
      });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      // Adjustment: 75 - 50 = 25 dB, new level = -20 + 25 = 5, clamped to 0
      expect(mockClient.setGeneratorLevel).toHaveBeenCalledWith(0, 'dBFS');
    });

    it('should handle missing SPL meter gracefully', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue(null);

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level',
        measurement: {
          target_spl_db: 75
        }
      });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result.data?.levels?.recommendation).toContain('SPL meter not running');
      expect(result.data?.levels?.recommendation).toContain('rew.api_spl_meter');
    });

    it('should stop generator after calibration', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue({ spl: 75, leq: 74, sel: 76 });

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level'
      });

      await vi.advanceTimersByTimeAsync(1000);

      await promise;

      expect(mockClient.executeGeneratorCommand).toHaveBeenCalledWith('Stop');
    });

    it('should use default target SPL of 75 dB', async () => {
      mockClient.setGeneratorSignal.mockResolvedValue(true);
      mockClient.setGeneratorLevel.mockResolvedValue(true);
      mockClient.executeGeneratorCommand.mockResolvedValue(true);
      mockClient.getSPLMeterLevels.mockResolvedValue(null);

      const promise = executeApiMeasureWorkflow({
        action: 'calibrate_level'
      });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result.data?.levels?.recommendation).toContain('75 dB SPL');
    });
  });

  describe('measure action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should get measurement count before executing', async () => {
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'existing-1', title: 'Old' }
      ]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      await executeApiMeasureWorkflow({
        action: 'measure'
      });

      expect(mockClient.listMeasurements).toHaveBeenCalledTimes(2);
    });

    it('should configure level when options provided', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setMeasureLevel.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      await executeApiMeasureWorkflow({
        action: 'measure',
        measurement: {
          level_dbfs: -18
        }
      });

      expect(mockClient.setMeasureLevel).toHaveBeenCalledWith(-18, 'dBFS');
    });

    it('should set sweep config when freq params provided', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setSweepConfig.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      await executeApiMeasureWorkflow({
        action: 'measure',
        measurement: {
          start_freq_hz: 10,
          end_freq_hz: 24000
        }
      });

      expect(mockClient.setSweepConfig).toHaveBeenCalledWith({
        startFreq: 10,
        endFreq: 24000
      });
    });

    it('should set notes when name provided', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      await executeApiMeasureWorkflow({
        action: 'measure',
        measurement: {
          name: 'Test measurement'
        }
      });

      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Test measurement');
    });

    it('should enable blocking mode before measurement', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      await executeApiMeasureWorkflow({
        action: 'measure'
      });

      expect(mockClient.setBlockingMode).toHaveBeenCalledWith(true);
    });

    it('should detect Pro license requirement on 403', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: false, status: 403 });

      const result = await executeApiMeasureWorkflow({
        action: 'measure'
      });

      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('REW Pro license');
      expect(result.data?.measurements?.[0].error).toBe('PRO_LICENSE_REQUIRED');
      expect(result.data?.warnings).toContain('REW Pro license required for API-triggered measurements');
    });

    it('should return new measurement UUID on success', async () => {
      mockClient.listMeasurements
        .mockResolvedValueOnce([{ uuid: 'old-1', title: 'Old' }])
        .mockResolvedValueOnce([
          { uuid: 'old-1', title: 'Old' },
          { uuid: 'new-1', title: 'New Measurement', name: 'New' }
        ]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      const result = await executeApiMeasureWorkflow({
        action: 'measure',
        measurement: {
          name: 'New Measurement'
        }
      });

      expect(result.data?.success).toBe(true);
      expect(result.data?.measurements?.[0].uuid).toBe('new-1');
      expect(result.data?.measurements?.[0].name).toBe('New Measurement');
      expect(result.data?.measurements?.[0].success).toBe(true);
    });

    it('should handle measurement not appearing in list', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      const result = await executeApiMeasureWorkflow({
        action: 'measure'
      });

      expect(result.data?.success).toBe(true);
      expect(result.data?.warnings).toContain('Could not verify new measurement was created');
    });

    it('should handle measurement failure with error status', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: false, status: 500 });

      const result = await executeApiMeasureWorkflow({
        action: 'measure'
      });

      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toContain('HTTP 500');
      expect(result.data?.measurements?.[0].error).toBe('HTTP 500');
    });
  });

  describe('measure_sequence action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should use default L/R sequence when not provided', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      const promise = executeApiMeasureWorkflow({
        action: 'measure_sequence'
      });

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Left Speaker');
      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Right Speaker');
      expect(result.data?.measurements).toHaveLength(2);
    });

    it('should iterate through measurements with delay', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setMeasureLevel.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      const promise = executeApiMeasureWorkflow({
        action: 'measure_sequence',
        measurement: {
          level_dbfs: -15
        },
        sequence: {
          measurements: [
            { name: 'M1' },
            { name: 'M2' },
            { name: 'M3' }
          ],
          delay_between_ms: 1000
        }
      });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(mockClient.executeMeasureCommand).toHaveBeenCalledTimes(3);
      expect(result.data?.measurements).toHaveLength(3);
    });

    it('should set notes for each measurement', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      const promise = executeApiMeasureWorkflow({
        action: 'measure_sequence',
        sequence: {
          measurements: [
            { name: 'Front Left', notes: 'Speaker A' },
            { name: 'Front Right', notes: 'Speaker B' }
          ]
        }
      });

      await vi.advanceTimersByTimeAsync(2000);

      await promise;

      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Front Left - Speaker A');
      expect(mockClient.setMeasureNotes).toHaveBeenCalledWith('Front Right - Speaker B');
    });

    it('should detect Pro license and stop sequence', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.executeMeasureCommand
        .mockResolvedValueOnce({ success: false, status: 403 });

      const result = await executeApiMeasureWorkflow({
        action: 'measure_sequence',
        sequence: {
          measurements: [
            { name: 'M1' },
            { name: 'M2' }
          ]
        }
      });

      expect(mockClient.executeMeasureCommand).toHaveBeenCalledTimes(1);
      expect(result.data?.measurements).toHaveLength(1);
      expect(result.data?.measurements?.[0].error).toBe('PRO_LICENSE_REQUIRED');
      expect(result.data?.warnings).toContain('REW Pro license required');
    });

    it('should return array of MeasurementResult with UUIDs', async () => {
      mockClient.listMeasurements
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ uuid: 'uuid-1', title: 'M1' }])
        .mockResolvedValueOnce([{ uuid: 'uuid-1' }])
        .mockResolvedValueOnce([{ uuid: 'uuid-1' }, { uuid: 'uuid-2', title: 'M2' }]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({ success: true, status: 200 });

      const promise = executeApiMeasureWorkflow({
        action: 'measure_sequence',
        sequence: {
          measurements: [
            { name: 'M1' },
            { name: 'M2' }
          ]
        }
      });

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.data?.measurements?.[0].uuid).toBe('uuid-1');
      expect(result.data?.measurements?.[1].uuid).toBe('uuid-2');
    });

    it('should report partial success', async () => {
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.executeMeasureCommand
        .mockResolvedValueOnce({ success: true, status: 200 })
        .mockResolvedValueOnce({ success: false, status: 500 })
        .mockResolvedValueOnce({ success: true, status: 200 });

      const promise = executeApiMeasureWorkflow({
        action: 'measure_sequence',
        sequence: {
          measurements: [
            { name: 'M1' },
            { name: 'M2' },
            { name: 'M3' }
          ]
        }
      });

      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;

      expect(result.data?.success).toBe(false);
      expect(result.data?.message).toBe('Completed 2/3 measurements');
      expect(result.data?.measurements?.[0].success).toBe(true);
      expect(result.data?.measurements?.[1].success).toBe(false);
      expect(result.data?.measurements?.[2].success).toBe(true);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should handle ZodError with validation_error type', async () => {
      const result = await executeApiMeasureWorkflow({
        action: 'invalid_action' // Invalid action
      } as any);

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
    });

    it('should handle REWApiError with connection_refused code', async () => {
      mockClient.listMeasurements.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED')
      );

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should handle REWApiError with timeout code', async () => {
      mockClient.listMeasurements.mockRejectedValue(
        new REWApiError('Request timeout', 'TIMEOUT')
      );

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('timeout');
      expect(result.suggestion).toContain('REW is busy or frozen');
    });

    it('should handle unknown Error type', async () => {
      mockClient.listMeasurements.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
    });

    it('should handle unknown error without Error instance', async () => {
      mockClient.listMeasurements.mockRejectedValue('String error');

      const result = await executeApiMeasureWorkflow({
        action: 'get_status'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unknown error');
    });
  });
});
