/**
 * Tool: rew.api_measure_workflow
 * 
 * Comprehensive measurement workflow orchestration.
 * Handles device setup, level calibration, measurement execution, and result retrieval.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';
import { type REWClientLike, type SweepConfig } from '../api/schemas.js';
import { tuiEventBus } from '../events/index.js';

// Input schema for workflow
export const ApiMeasureWorkflowInputSchema = z.object({
  action: z.enum([
    'setup',           // Configure devices and validate setup
    'check_levels',    // Check input/output levels
    'calibrate_level', // Auto-calibrate to target SPL
    'measure',         // Execute a measurement
    'measure_sequence', // Execute multiple measurements
    'get_status'       // Get current workflow status
  ]).describe('Workflow action to perform'),

  // Setup options
  setup: z.object({
    input_device: z.string().optional()
      .describe('Input device name (auto-detect if not specified)'),
    output_device: z.string().optional()
      .describe('Output device name (auto-detect if not specified)'),
    sample_rate: z.number().optional()
      .describe('Sample rate in Hz (default: 48000)'),
    use_blocking: z.boolean().default(true)
      .describe('Use blocking mode for synchronous measurements')
  }).optional(),

  // Measurement options
  measurement: z.object({
    name: z.string().optional()
      .describe('Measurement name/notes'),
    level_dbfs: z.number().min(-60).max(0).default(-12)
      .describe('Output level in dBFS'),
    start_freq_hz: z.number().min(1).default(20)
      .describe('Sweep start frequency'),
    end_freq_hz: z.number().max(48000).default(20000)
      .describe('Sweep end frequency'),
    target_spl_db: z.number().min(60).max(100).optional()
      .describe('Target SPL for auto-calibration (e.g., 75 dB)'),
    output_channel: z.enum(['left', 'right', 'both']).default('left')
      .describe('Output channel for measurement')
  }).optional(),

  // Sequence options (for measure_sequence)
  sequence: z.object({
    measurements: z.array(z.object({
      name: z.string(),
      output_channel: z.enum(['left', 'right', 'both']).optional(),
      notes: z.string().optional()
    })).optional()
      .describe('List of measurements to perform'),
    delay_between_ms: z.number().default(2000)
      .describe('Delay between measurements in ms')
  }).optional()
});

export type ApiMeasureWorkflowInput = z.infer<typeof ApiMeasureWorkflowInputSchema>;

export interface WorkflowStatus {
  connected: boolean;
  audio_ready: boolean;
  input_device?: string;
  output_device?: string;
  sample_rate?: number;
  blocking_mode: boolean;
  current_level_dbfs?: number;
  measurement_count: number;
  pro_features: boolean;
  mic_calibrated: boolean;
  cal_sensitivity_db?: number;
}

export interface MeasurementResult {
  success: boolean;
  uuid?: string;
  name?: string;
  duration_ms?: number;
  error?: string;
}

export interface ApiMeasureWorkflowResult {
  action: string;
  success: boolean;
  message: string;
  status?: WorkflowStatus;
  devices?: {
    input_devices: string[];
    output_devices: string[];
    recommended_input?: string;
    recommended_output?: string;
  };
  levels?: {
    input_level_db?: number;
    output_level_dbfs?: number;
    estimated_spl_db?: number;
    clipping: boolean;
    too_low: boolean;
    recommendation?: string;
  };
  measurements?: MeasurementResult[];
  warnings?: string[];
}

/**
 * Execute workflow tool
 */
export async function executeApiMeasureWorkflow(
  input: ApiMeasureWorkflowInput
): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  try {
    const validated = ApiMeasureWorkflowInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    switch (validated.action) {
      case 'get_status': {
        return await getWorkflowStatus(client);
      }

      case 'setup': {
        return await setupWorkflow(client, validated.setup);
      }

      case 'check_levels': {
        return await checkLevels(client, validated.measurement);
      }

      case 'calibrate_level': {
        return await calibrateLevel(client, validated.measurement);
      }

      case 'measure': {
        return await executeMeasurement(client, validated.measurement);
      }

      case 'measure_sequence': {
        return await executeMeasurementSequence(client, validated.measurement, validated.sequence);
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`
        };
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`
      };
    }

    if (error instanceof REWApiError) {
      tuiEventBus.emit('health:api_error', {
        code: error.code,
        httpStatus: error.httpStatus,
        message: error.message,
      });

      const suggestionMap: Record<string, string> = {
        'NOT_FOUND': 'Check REW application for errors',
        'CONNECTION_REFUSED': 'Ensure REW is running with API enabled. Check Preferences → API → Start',
        'TIMEOUT': 'REW took too long to respond. Check if REW is busy or frozen',
        'INTERNAL_ERROR': 'Check REW application for errors',
        'INVALID_RESPONSE': 'Check REW application for errors'
      };

      return {
        status: 'error',
        error_type: error.code.toLowerCase(),
        message: error.message,
        suggestion: suggestionMap[error.code] || 'Check REW application for errors'
      };
    }

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get current workflow status
 */
async function getWorkflowStatus(client: REWClientLike): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  const [
    measurements,
    blocking,
    inputDevice,
    outputDevice,
    sampleRate,
    level,
    inputCal
  ] = await Promise.all([
    client.listMeasurements(),
    client.getBlockingMode(),
    client.getJavaInputDevice(),
    client.getJavaOutputDevice(),
    client.getSampleRate(),
    client.getMeasureLevel(),
    client.getInputCalibration()
  ]);

  const levelData = level as { level?: number; value?: number; unit?: string } | undefined;
  const calData = inputCal as { calDataAllInputs?: { calFilePath?: string; dBFSAt94dBSPL?: number } } | null | undefined;

  const status: WorkflowStatus = {
    connected: true,
    audio_ready: !!(inputDevice && outputDevice),
    input_device: inputDevice || undefined,
    output_device: outputDevice || undefined,
    sample_rate: sampleRate || undefined,
    blocking_mode: blocking,
    current_level_dbfs: levelData?.value ?? levelData?.level,
    measurement_count: measurements?.length || 0,
    pro_features: false, // Will be detected on first measure attempt
    mic_calibrated: !!(calData?.calDataAllInputs?.calFilePath),
    cal_sensitivity_db: calData?.calDataAllInputs?.dBFSAt94dBSPL
  };

  tuiEventBus.emit('workflow:device_status', {
    connected: status.connected,
    input_device: status.input_device,
    output_device: status.output_device,
    sample_rate: status.sample_rate,
    blocking_mode: status.blocking_mode,
    pro_features: status.pro_features,
    mic_calibrated: status.mic_calibrated,
    measurement_count: status.measurement_count,
    current_level_dbfs: status.current_level_dbfs,
    cal_sensitivity_db: status.cal_sensitivity_db,
  });

  const warnings: string[] = [];

  if (!status.audio_ready) {
    warnings.push('Audio devices not configured');
  }
  if (!status.mic_calibrated && calData?.calDataAllInputs?.calFilePath === '') {
    warnings.push('No microphone calibration file loaded - measurements may be inaccurate');
  }
  if (!status.blocking_mode) {
    warnings.push('Blocking mode disabled - measurements may run asynchronously');
  }

  return {
    status: 'success',
    data: {
      action: 'get_status',
      success: true,
      message: status.audio_ready 
        ? `Ready for measurements (${status.measurement_count} existing)`
        : 'Setup required before measurements',
      status,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  };
}

/**
 * Setup workflow - configure devices
 */
async function setupWorkflow(
  client: REWClientLike, 
  options?: ApiMeasureWorkflowInput['setup']
): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  const warnings: string[] = [];
  
  // Get available devices
  const [inputDevices, outputDevices, sampleRates] = await Promise.all([
    client.getJavaInputDevices(),
    client.getJavaOutputDevices(),
    client.getAvailableSampleRates()
  ]);

  // Find recommended devices (look for measurement mics)
  const micKeywords = ['umik', 'earthworks', 'dayton', 'minidsp', 'measurement', 'reference'];
  const recommendedInput = inputDevices.find((d: string) => 
    micKeywords.some(k => d.toLowerCase().includes(k))
  ) || inputDevices.find((d: string) => !d.toLowerCase().includes('default'));

  const recommendedOutput = outputDevices.find((d: string) => 
    !d.toLowerCase().includes('default') && !d.toLowerCase().includes('microphone')
  );

  // Apply settings
  const results: string[] = [];

  // Set input device
  const inputToSet = options?.input_device || recommendedInput;
  if (inputToSet) {
    const success = await client.setJavaInputDevice(inputToSet);
    results.push(`Input: ${success ? inputToSet : 'failed'}`);
    if (!success) warnings.push(`Failed to set input device: ${inputToSet}`);
  }

  // Set output device  
  const outputToSet = options?.output_device || recommendedOutput;
  if (outputToSet) {
    const success = await client.setJavaOutputDevice(outputToSet);
    results.push(`Output: ${success ? outputToSet : 'failed'}`);
    if (!success) warnings.push(`Failed to set output device: ${outputToSet}`);
  }

  // Set sample rate
  const rateToSet = options?.sample_rate || 48000;
  if (sampleRates.includes(rateToSet)) {
    const success = await client.setSampleRate(rateToSet);
    results.push(`Sample rate: ${success ? rateToSet : 'failed'}`);
  }

  // Enable blocking mode for synchronous measurements
  if (options?.use_blocking !== false) {
    const success = await client.setBlockingMode(true);
    results.push(`Blocking mode: ${success ? 'enabled' : 'failed'}`);
  }

  return {
    status: 'success',
    data: {
      action: 'setup',
      success: warnings.length === 0,
      message: `Setup complete: ${results.join(', ')}`,
      devices: {
        input_devices: inputDevices,
        output_devices: outputDevices,
        recommended_input: recommendedInput,
        recommended_output: recommendedOutput
      },
      warnings: warnings.length > 0 ? warnings : undefined
    }
  };
}

/**
 * Check input/output levels
 */
async function checkLevels(
  client: REWClientLike,
  options?: ApiMeasureWorkflowInput['measurement']
): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  // Start generator with pink noise for level check
  await client.setGeneratorSignal('Pink noise');
  const level = options?.level_dbfs ?? -12;
  await client.setGeneratorLevel(level, 'dBFS');
  
  // Run "Check levels" command
  const result = await client.executeMeasureCommand('Check levels') as { success: boolean; status: number };

  const clipping = level > -3;
  const tooLow = level < -30;

  let recommendation: string | undefined;
  if (clipping) {
    recommendation = 'Level too high - risk of clipping. Reduce by 6-10 dB.';
  } else if (tooLow) {
    recommendation = 'Level may be too low for good SNR. Consider increasing by 10-15 dB.';
  } else if (level > -6) {
    recommendation = 'Level is high - ensure no clipping in your signal chain.';
  }

  // Stop generator
  await client.executeGeneratorCommand('Stop');

  return {
    status: 'success',
    data: {
      action: 'check_levels',
      success: result.success,
      message: result.success 
        ? `Level check complete. Output: ${level} dBFS`
        : 'Level check failed',
      levels: {
        output_level_dbfs: level,
        clipping,
        too_low: tooLow,
        recommendation
      }
    }
  };
}

/**
 * Auto-calibrate to target SPL
 */
async function calibrateLevel(
  client: REWClientLike,
  options?: ApiMeasureWorkflowInput['measurement']
): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  const targetSPL = options?.target_spl_db || 75;

  // Start with pink noise
  await client.setGeneratorSignal('Pink noise');
  
  // Start at -20 dBFS and adjust
  let currentLevel = -20;
  await client.setGeneratorLevel(currentLevel, 'dBFS');
  await client.executeGeneratorCommand('Start');

  // Wait a moment for levels to stabilize
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Try to read SPL meter
  const splLevels = await client.getSPLMeterLevels(1) as { spl?: number; leq?: number; sel?: number } | undefined;

  let recommendation: string;

  if (splLevels && splLevels.spl !== undefined) {
    const currentSPL = splLevels.spl;
    const adjustment = targetSPL - currentSPL;
    const newLevel = Math.max(-60, Math.min(0, currentLevel + adjustment));
    
    await client.setGeneratorLevel(newLevel, 'dBFS');
    
    recommendation = `Adjusted from ${currentLevel} to ${newLevel} dBFS. ` +
      `Current SPL: ${currentSPL.toFixed(1)} dB, Target: ${targetSPL} dB`;
    
    currentLevel = newLevel;
  } else {
    recommendation = `SPL meter not running. Start it with rew.api_spl_meter first, ` +
      `then manually adjust level to achieve ${targetSPL} dB SPL.`;
  }

  // Stop generator
  await client.executeGeneratorCommand('Stop');

  return {
    status: 'success',
    data: {
      action: 'calibrate_level',
      success: true,
      message: `Level calibration for ${targetSPL} dB SPL target`,
      levels: {
        output_level_dbfs: currentLevel,
        estimated_spl_db: targetSPL,
        clipping: false,
        too_low: false,
        recommendation
      }
    }
  };
}

/**
 * Execute a single measurement
 */
async function executeMeasurement(
  client: REWClientLike,
  options?: ApiMeasureWorkflowInput['measurement']
): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  // Get current measurement count to detect new measurement
  const beforeMeasurements = await client.listMeasurements();
  const beforeCount = beforeMeasurements?.length || 0;

  // Configure measurement
  if (options?.level_dbfs !== undefined) {
    await client.setMeasureLevel(options.level_dbfs, 'dBFS');
  }

  // Set sweep config
  const sweepConfig: SweepConfig = {};
  if (options?.start_freq_hz) sweepConfig.startFreq = options.start_freq_hz;
  if (options?.end_freq_hz) sweepConfig.endFreq = options.end_freq_hz;
  if (Object.keys(sweepConfig).length > 0) {
    await client.setSweepConfig(sweepConfig);
  }

  // Set notes/name
  if (options?.name) {
    await client.setMeasureNotes(options.name);
  }

  // Ensure blocking mode for synchronous operation
  await client.setBlockingMode(true);

  // Execute measurement
  const startTime = Date.now();
  const result = await client.executeMeasureCommand('Measure') as { success: boolean; status: number; data?: unknown };
  const duration = Date.now() - startTime;

  // Check for Pro license requirement
  if (!result.success && result.status === 403) {
    return {
      status: 'success',
      data: {
        action: 'measure',
        success: false,
        message: 'Automated sweep measurements require REW Pro license',
        measurements: [{
          success: false,
          error: 'PRO_LICENSE_REQUIRED'
        }],
        warnings: ['REW Pro license required for API-triggered measurements']
      }
    };
  }

  if (!result.success) {
    return {
      status: 'success',
      data: {
        action: 'measure',
        success: false,
        message: `Measurement failed: HTTP ${result.status}`,
        measurements: [{
          success: false,
          error: `HTTP ${result.status}`
        }]
      }
    };
  }

  // Get the new measurement
  const afterMeasurements = await client.listMeasurements();
  const afterCount = afterMeasurements?.length || 0;

  if (afterCount > beforeCount) {
    // Find the new measurement (last one added)
    const newMeasurement = afterMeasurements[afterCount - 1] as { uuid?: string; title?: string; name?: string };

    return {
      status: 'success',
      data: {
        action: 'measure',
        success: true,
        message: `Measurement completed in ${duration}ms`,
        measurements: [{
          success: true,
          uuid: newMeasurement?.uuid,
          name: newMeasurement?.title || newMeasurement?.name || options?.name,
          duration_ms: duration
        }]
      }
    };
  }

  return {
    status: 'success',
    data: {
      action: 'measure',
      success: true,
      message: `Measurement command accepted (${duration}ms)`,
      measurements: [{
        success: true,
        duration_ms: duration
      }],
      warnings: ['Could not verify new measurement was created']
    }
  };
}

/**
 * Execute a sequence of measurements
 */
async function executeMeasurementSequence(
  client: REWClientLike,
  measurementOptions?: ApiMeasureWorkflowInput['measurement'],
  sequenceOptions?: ApiMeasureWorkflowInput['sequence']
): Promise<ToolResponse<ApiMeasureWorkflowResult>> {
  const measurements = sequenceOptions?.measurements || [
    { name: 'Left Speaker', output_channel: 'left' as const },
    { name: 'Right Speaker', output_channel: 'right' as const }
  ];

  const delay = sequenceOptions?.delay_between_ms || 2000;
  const results: MeasurementResult[] = [];
  const warnings: string[] = [];

  // Ensure blocking mode
  await client.setBlockingMode(true);

  for (let i = 0; i < measurements.length; i++) {
    const meas = measurements[i];

    // Get count before
    const beforeMeasurements = await client.listMeasurements();
    const beforeCount = beforeMeasurements?.length || 0;

    // Apply measurement level if specified
    if (measurementOptions?.level_dbfs !== undefined) {
      await client.setMeasureLevel(measurementOptions.level_dbfs, 'dBFS');
    }

    // Set notes
    const notes = meas.notes ? `${meas.name} - ${meas.notes}` : meas.name;
    await client.setMeasureNotes(notes);

    // Execute
    const startTime = Date.now();
    const result = await client.executeMeasureCommand('Measure') as { success: boolean; status: number };
    const duration = Date.now() - startTime;

    if (!result.success) {
      if (result.status === 403) {
        warnings.push('REW Pro license required');
        results.push({
          success: false,
          name: meas.name,
          error: 'PRO_LICENSE_REQUIRED'
        });
        break; // Stop sequence if Pro required
      }
      
      results.push({
        success: false,
        name: meas.name,
        error: `HTTP ${result.status}`,
        duration_ms: duration
      });
      continue;
    }

    // Get the new measurement UUID
    const afterMeasurements = await client.listMeasurements();
    const afterCount = afterMeasurements?.length || 0;

    const newMeas = afterCount > beforeCount ? (afterMeasurements[afterCount - 1] as { uuid?: string }) : null;

    results.push({
      success: true,
      uuid: newMeas?.uuid,
      name: meas.name,
      duration_ms: duration
    });

    // Delay between measurements (except after last)
    if (i < measurements.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const successful = results.filter(r => r.success).length;

  return {
    status: 'success',
    data: {
      action: 'measure_sequence',
      success: successful === measurements.length,
      message: `Completed ${successful}/${measurements.length} measurements`,
      measurements: results,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  };
}
