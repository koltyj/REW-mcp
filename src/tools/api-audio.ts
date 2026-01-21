/**
 * Tool: rew.api_audio
 * 
 * Configure REW audio devices via API.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiAudioInputSchema = z.object({
  action: z.enum(['status', 'list_devices', 'set_input', 'set_output', 'set_sample_rate'])
    .describe('Audio configuration action'),
  
  device: z.string().optional()
    .describe('Device name (for set_input or set_output)'),
  
  sample_rate: z.number().optional()
    .describe('Sample rate in Hz (for set_sample_rate)')
});

export type ApiAudioInput = z.infer<typeof ApiAudioInputSchema>;

export interface ApiAudioResult {
  action: string;
  success: boolean;
  message: string;
  audio_status?: {
    enabled: boolean;
    ready: boolean;
    driver?: string;
    sample_rate?: number;
    current_input?: string;
    current_output?: string;
  };
  available_devices?: {
    input_devices: string[];
    output_devices: string[];
    sample_rates: number[];
  };
  input_calibration?: any;
}

/**
 * Execute API audio tool
 */
export async function executeApiAudio(input: ApiAudioInput): Promise<ToolResponse<ApiAudioResult>> {
  try {
    const validated = ApiAudioInputSchema.parse(input);
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
      case 'status': {
        const [audioStatus, driver, sampleRate, inputDevice, outputDevice, inputCal] = await Promise.all([
          client.getAudioStatus(),
          client.getAudioDriver(),
          client.getSampleRate(),
          client.getJavaInputDevice(),
          client.getJavaOutputDevice(),
          client.getInputCalibration()
        ]);

        return {
          status: 'success',
          data: {
            action: 'status',
            success: true,
            message: 'Audio status retrieved',
            audio_status: {
              enabled: audioStatus?.enabled ?? false,
              ready: audioStatus?.ready ?? false,
              driver: driver || audioStatus?.driver,
              sample_rate: sampleRate ?? undefined,
              current_input: inputDevice ?? undefined,
              current_output: outputDevice ?? undefined
            },
            input_calibration: inputCal
          }
        };
      }

      case 'list_devices': {
        const [inputDevices, outputDevices, sampleRates] = await Promise.all([
          client.getJavaInputDevices(),
          client.getJavaOutputDevices(),
          client.getAvailableSampleRates()
        ]);

        return {
          status: 'success',
          data: {
            action: 'list_devices',
            success: true,
            message: `Found ${inputDevices.length} input devices, ${outputDevices.length} output devices`,
            available_devices: {
              input_devices: inputDevices,
              output_devices: outputDevices,
              sample_rates: sampleRates
            }
          }
        };
      }

      case 'set_input': {
        if (!validated.device) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Device name required for set_input action',
            suggestion: 'Use action: list_devices to see available input devices'
          };
        }

        const success = await client.setJavaInputDevice(validated.device);

        return {
          status: 'success',
          data: {
            action: 'set_input',
            success,
            message: success 
              ? `Input device set to: ${validated.device}`
              : `Failed to set input device. Check device name is correct.`
          }
        };
      }

      case 'set_output': {
        if (!validated.device) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Device name required for set_output action',
            suggestion: 'Use action: list_devices to see available output devices'
          };
        }

        const success = await client.setJavaOutputDevice(validated.device);

        return {
          status: 'success',
          data: {
            action: 'set_output',
            success,
            message: success 
              ? `Output device set to: ${validated.device}`
              : `Failed to set output device. Check device name is correct.`
          }
        };
      }

      case 'set_sample_rate': {
        if (!validated.sample_rate) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Sample rate required for set_sample_rate action',
            suggestion: 'Use action: list_devices to see available sample rates'
          };
        }

        const success = await client.setSampleRate(validated.sample_rate);

        return {
          status: 'success',
          data: {
            action: 'set_sample_rate',
            success,
            message: success 
              ? `Sample rate set to: ${validated.sample_rate} Hz`
              : `Failed to set sample rate. Rate may not be supported by current device.`
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: status, list_devices, set_input, set_output, set_sample_rate'
        };
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`,
        suggestion: 'Check input parameters'
      };
    }

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestion: 'Check REW API connection'
    };
  }
}
