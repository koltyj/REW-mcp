/**
 * Tool: rew.optimize_room
 *
 * Multi-action optimization guidance tool providing recommendations,
 * validation, and progress tracking for room optimization workflow.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import { tuiEventBus } from '../events/index.js';
import { detectPeaks, detectNulls } from '../analysis/peaks-nulls.js';
import { analyzeSubIntegration } from '../analysis/sub-integration.js';
import { prioritizeIssues } from '../interpretation/prioritization.js';
import {
  generatePlacementRecommendation,
  generateSubRecommendation,
  generateListeningPositionRecommendation
} from '../optimization/recommendations.js';
import {
  validateAdjustment,
  type ValidationResult,
  type TargetIssue
} from '../optimization/validation.js';
import {
  evaluateSuccessCriteria,
  type SuccessCriteriaResult
} from '../optimization/success-criteria.js';
import type { ToolResponse, RoomDimensions } from '../types/index.js';
import type { IssueInput, PrioritizedIssue } from '../interpretation/types.js';
import type { PlacementRecommendation } from '../optimization/types.js';

// ============================================================================
// Input Schema
// ============================================================================

export const OptimizeRoomInputSchema = z.object({
  action: z.enum(['get_recommendation', 'validate_adjustment', 'check_progress'])
    .describe('Action to perform'),

  // Common parameters
  measurement_id: z.string()
    .describe('Current/post measurement ID'),

  // For validation action
  pre_measurement_id: z.string().optional()
    .describe('Pre-adjustment measurement for validation'),
  target_frequency_hz: z.number().optional()
    .describe('Frequency of issue being validated'),
  target_category: z.string().optional()
    .describe('Category of issue being validated (peak, null, sub_integration, lr_symmetry)'),

  // For recommendation and progress
  session_id: z.string().optional()
    .describe('Session ID for tracking optimization workflow'),
  left_measurement_id: z.string().optional()
    .describe('Left channel measurement for L/R analysis'),
  right_measurement_id: z.string().optional()
    .describe('Right channel measurement for L/R analysis'),
  sub_measurement_id: z.string().optional()
    .describe('Subwoofer measurement for integration analysis'),
  room_dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional()
    .describe('Room dimensions (in feet) for listening position recommendations')
});

export type OptimizeRoomInput = z.infer<typeof OptimizeRoomInputSchema>;

// ============================================================================
// Output Types
// ============================================================================

export interface GetRecommendationResult {
  recommendation: PlacementRecommendation;
  priority_rank: number;
  total_issues: number;
  next_steps: string;
}

export type ValidateAdjustmentResult = ValidationResult;

export type CheckProgressResult = SuccessCriteriaResult;

export type OptimizeRoomResult =
  | GetRecommendationResult
  | ValidateAdjustmentResult
  | CheckProgressResult;

// ============================================================================
// Main Execute Function
// ============================================================================

/**
 * Execute optimization guidance tool
 */
export async function executeOptimizeRoom(
  input: OptimizeRoomInput
): Promise<ToolResponse<OptimizeRoomResult>> {
  try {
    const validated = OptimizeRoomInputSchema.parse(input);

    switch (validated.action) {
      case 'get_recommendation':
        return await getRecommendation(validated);

      case 'validate_adjustment':
        return await validateAdjustmentAction(validated);

      case 'check_progress':
        return await checkProgressAction(validated);

      default:
        return {
          status: 'error',
          error_type: 'validation_error',
          message: `Unknown action: ${(validated as any).action}`
        };
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: `Invalid input: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      };
    }

    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Action: get_recommendation
// ============================================================================

/**
 * Get single prioritized recommendation for next optimization step.
 *
 * One recommendation at a time per scientific approach:
 * "suggest, measure, evaluate, then next"
 */
async function getRecommendation(
  input: OptimizeRoomInput
): Promise<ToolResponse<GetRecommendationResult>> {
  // Get primary measurement
  const measurement = measurementStore.get(input.measurement_id);
  if (!measurement) {
    return {
      status: 'error',
      error_type: 'measurement_not_found',
      message: `Measurement '${input.measurement_id}' not found. Use rew.api_measurement_session get_status to list available measurements.`
    };
  }

  const allIssues: IssueInput[] = [];

  // 1. Detect peaks and nulls
  const peaks = detectPeaks(measurement.frequency_response, { threshold_db: 3 });
  const nulls = detectNulls(measurement.frequency_response, { threshold_db: -3 });

  // Convert peaks to issues
  peaks.forEach(peak => {
    allIssues.push({
      issue: `Peak at ${peak.frequency_hz.toFixed(0)} Hz (${peak.deviation_db.toFixed(1)} dB)`,
      severity: peak.deviation_db > 6 ? 'significant' : peak.deviation_db > 4 ? 'moderate' : 'minor',
      fixability: 'placement',
      category: peak.q_factor > 5 ? 'sbir' : 'peak'
    });
  });

  // Convert nulls to issues
  nulls.forEach(n => {
    allIssues.push({
      issue: `Null at ${n.frequency_hz.toFixed(0)} Hz (${n.depth_db.toFixed(1)} dB)`,
      severity: Math.abs(n.depth_db) > 6 ? 'significant' : Math.abs(n.depth_db) > 4 ? 'moderate' : 'minor',
      fixability: 'placement',
      category: n.q_factor > 5 ? 'sbir' : 'null'
    });
  });

  // 2. L/R symmetry analysis (if provided)
  if (input.left_measurement_id && input.right_measurement_id) {
    const leftMeasurement = measurementStore.get(input.left_measurement_id);
    const rightMeasurement = measurementStore.get(input.right_measurement_id);

    if (!leftMeasurement || !rightMeasurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `L/R measurement not found. Verify IDs.`
      };
    }

    // Calculate L/R deviation
    const lrDeviation = calculateLRDeviation(leftMeasurement, rightMeasurement);
    if (lrDeviation > 2) {
      allIssues.push({
        issue: `L/R imbalance (${lrDeviation.toFixed(1)} dB deviation)`,
        severity: lrDeviation > 4 ? 'significant' : 'moderate',
        fixability: 'placement',
        category: 'lr_symmetry'
      });
    }
  }

  // 3. Sub integration analysis (if provided)
  if (input.sub_measurement_id) {
    const subMeasurement = measurementStore.get(input.sub_measurement_id);
    if (!subMeasurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Sub measurement '${input.sub_measurement_id}' not found`
      };
    }

    const subAnalysis = analyzeSubIntegration(
      measurement.frequency_response,
      subMeasurement.frequency_response
    );

    // Check phase/polarity issues
    if (subAnalysis.polarity_recommendation.invert_recommended) {
      allIssues.push({
        issue: `Phase inversion detected (${subAnalysis.crossover_analysis.phase_difference_deg.toFixed(0)}° difference)`,
        severity: 'significant',
        fixability: 'settings',
        category: 'sub_integration'
      });
    }

    // Check crossover summation
    if (subAnalysis.summation_prediction.current_dip_at_crossover_db < -3) {
      allIssues.push({
        issue: `Crossover dip (${subAnalysis.summation_prediction.current_dip_at_crossover_db.toFixed(1)} dB)`,
        severity: Math.abs(subAnalysis.summation_prediction.current_dip_at_crossover_db) > 6 ? 'significant' : 'moderate',
        fixability: 'settings',
        category: 'sub_integration'
      });
    }
  }

  // If no issues detected
  if (allIssues.length === 0) {
    return {
      status: 'success',
      data: {
        recommendation: {
          element: 'listening_position',
          action: 'No significant issues detected - room response is well optimized',
          reason: 'All measurements show good frequency response within target thresholds',
          confidence: 'high',
          expected_improvement: 'Response is already optimal',
          issue_frequency_hz: 0,
          issue_severity: 'negligible',
          issue_category: 'none'
        },
        priority_rank: 1,
        total_issues: 0,
        next_steps: 'Run check_progress to confirm you have reached target. Consider fine-tuning if desired.'
      }
    };
  }

  // Prioritize issues (fixability-first scoring)
  const prioritized: PrioritizedIssue[] = prioritizeIssues(allIssues);

  // Select top issue (highest priority)
  const topIssue = prioritized[0];

  // Generate appropriate recommendation based on element
  let recommendation: PlacementRecommendation;

  if (topIssue.category === 'sub_integration') {
    // Generate subwoofer recommendation with phase/boundary/crossover context
    const phaseInfo = input.sub_measurement_id ? {
      is_inverted: topIssue.issue.includes('Phase inversion'),
      phase_difference_deg: topIssue.issue.match(/(\d+)°/)?.[1] ? parseFloat(topIssue.issue.match(/(\d+)°/)![1]) : 0
    } : undefined;

    recommendation = generateSubRecommendation(topIssue, phaseInfo);
  } else if (topIssue.category === 'room_modes' || topIssue.issue.toLowerCase().includes('position')) {
    // Generate listening position recommendation
    recommendation = generateListeningPositionRecommendation(
      topIssue,
      input.room_dimensions as RoomDimensions | undefined
    );
  } else {
    // Generate standard placement recommendation
    recommendation = generatePlacementRecommendation(topIssue);
  }

  tuiEventBus.emit('optimization:recommendation', recommendation);

  return {
    status: 'success',
    data: {
      recommendation,
      priority_rank: 1,
      total_issues: allIssues.length,
      next_steps: 'Make this adjustment, then re-measure and call validate_adjustment to check if it helped.'
    }
  };
}

// ============================================================================
// Action: validate_adjustment
// ============================================================================

/**
 * Validate that an adjustment improved the response.
 *
 * Compares pre and post measurements to classify improvement:
 * - success: 50%+ reduction
 * - partial: some improvement but <50%
 * - unchanged: minimal change
 * - worsened: made it worse
 */
async function validateAdjustmentAction(
  input: OptimizeRoomInput
): Promise<ToolResponse<ValidateAdjustmentResult>> {
  // Validate required parameters
  if (!input.pre_measurement_id) {
    return {
      status: 'error',
      error_type: 'validation_error',
      message: 'validate_adjustment action requires pre_measurement_id parameter'
    };
  }

  if (!input.target_frequency_hz || !input.target_category) {
    return {
      status: 'error',
      error_type: 'validation_error',
      message: 'validate_adjustment action requires target_frequency_hz and target_category parameters'
    };
  }

  // Get measurements
  const preMeasurement = measurementStore.get(input.pre_measurement_id);
  const postMeasurement = measurementStore.get(input.measurement_id);

  if (!preMeasurement) {
    return {
      status: 'error',
      error_type: 'measurement_not_found',
      message: `Pre-adjustment measurement '${input.pre_measurement_id}' not found`
    };
  }

  if (!postMeasurement) {
    return {
      status: 'error',
      error_type: 'measurement_not_found',
      message: `Post-adjustment measurement '${input.measurement_id}' not found`
    };
  }

  // Validate the adjustment
  const targetIssue: TargetIssue = {
    frequency_hz: input.target_frequency_hz,
    category: input.target_category
  };

  const validationResult = validateAdjustment(
    preMeasurement,
    postMeasurement,
    targetIssue
  );

  tuiEventBus.emit('optimization:validated', validationResult);

  return {
    status: 'success',
    data: validationResult
  };
}

// ============================================================================
// Action: check_progress
// ============================================================================

/**
 * Check overall progress toward target criteria.
 *
 * Evaluates zone-based success criteria:
 * - smoothness (40-200 Hz variance)
 * - L/R balance (if measurements provided)
 * - sub integration (if sub measurement provided)
 *
 * Returns should_stop flag when smoothness reaches 'good' zone.
 */
async function checkProgressAction(
  input: OptimizeRoomInput
): Promise<ToolResponse<CheckProgressResult>> {
  // Get primary measurement
  const measurement = measurementStore.get(input.measurement_id);
  if (!measurement) {
    return {
      status: 'error',
      error_type: 'measurement_not_found',
      message: `Measurement '${input.measurement_id}' not found`
    };
  }

  // Get optional measurements
  const leftMeasurement = input.left_measurement_id
    ? measurementStore.get(input.left_measurement_id)
    : undefined;

  const rightMeasurement = input.right_measurement_id
    ? measurementStore.get(input.right_measurement_id)
    : undefined;

  const subMeasurement = input.sub_measurement_id
    ? measurementStore.get(input.sub_measurement_id)
    : undefined;

  // Evaluate success criteria
  const result = evaluateSuccessCriteria(measurement, {
    leftMeasurement,
    rightMeasurement,
    subMeasurement
  });

  tuiEventBus.emit('optimization:progress', result);

  return {
    status: 'success',
    data: result
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate maximum L/R deviation in bass region (40-200 Hz).
 */
function calculateLRDeviation(
  leftMeasurement: any,
  rightMeasurement: any
): number {
  const { frequencies_hz: leftFreqs, spl_db: leftSpl } = leftMeasurement.frequency_response;
  const { frequencies_hz: rightFreqs, spl_db: rightSpl } = rightMeasurement.frequency_response;

  let maxDeviation = 0;

  for (let i = 0; i < leftFreqs.length; i++) {
    const freq = leftFreqs[i];
    if (freq < 40 || freq > 200) continue;

    const rightIndex = rightFreqs.findIndex((f: number) => Math.abs(f - freq) < 1);
    if (rightIndex === -1) continue;

    const deviation = Math.abs(leftSpl[i] - rightSpl[rightIndex]);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
    }
  }

  return maxDeviation;
}
