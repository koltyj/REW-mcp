/**
 * Tool: rew.api_audio
 * 
 * Configure REW audio devices via API.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';
import { type InputCalibration } from '../api/schemas.js';

// Input schema
export const ApiAudioInputSchema = z.object({
  action: z.enum(['status', 'list_devices', 'set_input', 'set_output', 'set_sample_rate', 'get_channels', 'set_input_channel', 'set_output_mapping', 'get_output_cal'])
    .describe('Audio configuration action'),
  
  device: z.string().optional()
    .describe('Device name (for set_input or set_output)'),
  
  sample_rate: z.number().optional()
    .describe('Sample rate in Hz (for set_sample_rate)'),

  channel: z.number().optional()
    .describe('Channel number (for set_input_channel)'),

  mapping: z.unknown().optional()
    .describe('Output channel mapping (for set_output_mapping)')
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
  input_calibration?: InputCalibration | null;
  channels?: {
    input_channel?: number;
    ref_input_channel?: number;
    last_input_channel?: number;
    output_channel_mapping?: unknown;
    stereo_only?: boolean;
  };
  output_calibration?: unknown;
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

      case 'get_channels': {
        const [inputChannel, refInputChannel, lastInputChannel, outputMapping, stereoOnly] = await Promise.all([
          client.getJavaInputChannel(),
          client.getJavaRefInputChannel(),
          client.getJavaLastInputChannel(),
          client.getJavaOutputChannelMapping(),
          client.getJavaStereoOnly()
        ]);

        return {
          status: 'success',
          data: {
            action: 'get_channels',
            success: true,
            message: 'Channel configuration retrieved',
            channels: {
              input_channel: inputChannel,
              ref_input_channel: refInputChannel,
              last_input_channel: lastInputChannel,
              output_channel_mapping: outputMapping,
              stereo_only: stereoOnly
            }
          }
        };
      }

      case 'set_input_channel': {
        if (validated.channel === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Channel number required for set_input_channel action',
            suggestion: 'Use action: get_channels to see current channel configuration'
          };
        }

        const success = await client.setJavaInputChannel(validated.channel);

        return {
          status: 'success',
          data: {
            action: 'set_input_channel',
            success,
            message: success
              ? `Input channel set to: ${validated.channel}`
              : 'Failed to set input channel'
          }
        };
      }

      case 'set_output_mapping': {
        if (validated.mapping === undefined) {
          return {
            status: 'error',
            error_type: 'validation_error',
            message: 'Mapping required for set_output_mapping action',
            suggestion: 'Use action: get_channels to see current mapping'
          };
        }

        const success = await client.setJavaOutputChannelMapping(validated.mapping);

        return {
          status: 'success',
          data: {
            action: 'set_output_mapping',
            success,
            message: success
              ? 'Output channel mapping updated'
              : 'Failed to update output channel mapping'
          }
        };
      }

      case 'get_output_cal': {
        const outputCal = await client.getOutputCalibration();

        return {
          status: 'success',
          data: {
            action: 'get_output_cal',
            success: true,
            message: 'Output calibration retrieved',
            output_calibration: outputCal
          }
        };
      }

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${validated.action}`,
          suggestion: 'Use one of: status, list_devices, set_input, set_output, set_sample_rate, get_channels, set_input_channel, set_output_mapping, get_output_cal'
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

    if (error instanceof REWApiError) {
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
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestion: 'Check REW API connection'
    };
  }
}
