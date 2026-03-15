/**
 * Tool: rew.api_check_levels
 *
 * Check REW input levels for mic gain calibration.
 * Provides zone-based feedback (Clipping, Hot, Optimal, Low, Very Low) and guidance.
 */

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiCheckLevelsInputSchema = z.object({
  target_rms: z.number().min(-60).max(0).default(-12).optional()
    .describe('Target RMS level in dBFS (default: -12 dBFS for measurement)')
});

export type ApiCheckLevelsInput = z.infer<typeof ApiCheckLevelsInputSchema>;

type LevelZone = 'CLIPPING' | 'HOT' | 'OPTIMAL' | 'LOW' | 'VERY_LOW';

export interface ApiCheckLevelsResult {
  zone: LevelZone;
  should_block_measurement: boolean;
  levels: {
    rms_db: number;
    peak_db: number;
    channel_count: number;
    rms_per_channel?: number[];
    peak_per_channel?: number[];
  };
  feedback: {
    status: string;
    recommendation: string;
    warning?: string;
  };
}

/**
 * Determine level zone based on RMS and peak values
 */
function determineLevelZone(rms: number, peak: number): LevelZone {
  // Priority: Clipping first (SETV-02)
  if (peak > -3) return 'CLIPPING';

  // RMS zones (SETV-01, SETV-03)
  if (rms > -10) return 'HOT';
  if (rms >= -20 && rms <= -10) return 'OPTIMAL';  // Target: -12 dBFS
  if (rms >= -40 && rms < -20) return 'LOW';

  return 'VERY_LOW';  // < -40 dBFS (SETV-03)
}

/**
 * Generate feedback based on zone
 */
function generateFeedback(zone: LevelZone, rms: number, targetRms: number): { status: string; recommendation: string; warning?: string } {
  switch (zone) {
    case 'CLIPPING':
      return {
        status: 'CLIPPING DETECTED',
        recommendation: 'Reduce mic gain or generator level immediately. Signal is distorting.'
      };

    case 'HOT':
      return {
        status: 'Level too hot',
        recommendation: `Reduce mic gain by ${Math.abs(rms - targetRms).toFixed(1)} dB to reach target of ${targetRms} dBFS.`
      };

    case 'OPTIMAL':
      return {
        status: 'Level optimal',
        recommendation: `Current level (${rms.toFixed(1)} dBFS) is good for measurement. No adjustment needed.`
      };

    case 'LOW':
      return {
        status: 'Level low',
        recommendation: `Increase mic gain by ${Math.abs(targetRms - rms).toFixed(1)} dB to reach target of ${targetRms} dBFS.`
      };

    case 'VERY_LOW':
      return {
        status: 'LEVEL TOO LOW',
        recommendation: `Increase mic gain significantly (${Math.abs(targetRms - rms).toFixed(1)} dB) or increase generator level. Signal may be too weak for accurate measurement.`
      };
  }
}

/**
 * Check for L/R channel mismatch
 */
function checkChannelMismatch(rmsLevels: number[]): string | undefined {
  if (rmsLevels.length !== 2) return undefined;

  const diff = Math.abs(rmsLevels[0] - rmsLevels[1]);
  if (diff > 3) {
    return `L/R channel imbalance detected: ${diff.toFixed(1)} dB difference. Check mic positioning or channel configuration.`;
  }

  return undefined;
}

/**
 * Execute API check levels tool
 */
export async function executeApiCheckLevels(input: ApiCheckLevelsInput): Promise<ToolResponse<ApiCheckLevelsResult>> {
  try {
    const validated = ApiCheckLevelsInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    const targetRms = validated.target_rms ?? -12;

    try {
      // Start input level monitoring
      await client.startInputLevelMonitoring();

      // Get input levels
      const levels = await client.getInputLevels('dBFS');

      if (!levels) {
        return {
          status: 'error',
          error_type: 'api_error',
          message: 'Failed to read input levels. Monitoring may not have started or no audio device is active.',
          suggestion: 'Check that REW has an input device selected via rew.api_audio'
        };
      }

      // Calculate average RMS and max peak across channels
      const avgRms = levels.rms_levels.reduce((sum, val) => sum + val, 0) / levels.rms_levels.length;
      const maxPeak = Math.max(...levels.peak_levels);

      // Determine zone
      const zone = determineLevelZone(avgRms, maxPeak);

      // Generate feedback
      const feedback = generateFeedback(zone, avgRms, targetRms);

      // Check for channel mismatch
      const mismatchWarning = checkChannelMismatch(levels.rms_levels);
      if (mismatchWarning) {
        feedback.warning = mismatchWarning;
      }

      // Determine if measurement should be blocked (SETV-02, SETV-03)
      const shouldBlock = zone === 'CLIPPING' || zone === 'VERY_LOW';

      return {
        status: 'success',
        data: {
          zone,
          should_block_measurement: shouldBlock,
          levels: {
            rms_db: avgRms,
            peak_db: maxPeak,
            channel_count: levels.rms_levels.length,
            rms_per_channel: levels.rms_levels,
            peak_per_channel: levels.peak_levels
          },
          feedback: {
            status: feedback.status,
            recommendation: feedback.recommendation,
            warning: feedback.warning
          }
        }
      };

    } finally {
      // Always stop monitoring in cleanup
      await client.stopInputLevelMonitoring();
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
