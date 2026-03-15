/**
 * Tool: rew.analyze_room
 *
 * Unified room analysis combining all interpretation modules with prioritized recommendations.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import type { ToolResponse, RoomDimensions } from '../types/index.js';
import { tuiEventBus } from '../events/index.js';
import type { IssueInput, PrioritizedIssue } from '../interpretation/types.js';
import { prioritizeIssues } from '../interpretation/prioritization.js';
import {
  interpretPeaksNulls,
  type PeaksNullsData
} from '../interpretation/peaks-nulls-interpret.js';
import {
  interpretRoomModes,
  type RoomModesData
} from '../interpretation/room-modes-interpret.js';
import {
  interpretSubIntegration,
  type SubIntegrationData
} from '../interpretation/sub-integration-interpret.js';
import {
  interpretLRSymmetry,
  type LRSymmetryData
} from '../interpretation/lr-symmetry.js';
import {
  compareGLMCalibration,
  analyzePostOnly,
  generateGLMSummary,
  type GLMComparisonResult
} from '../interpretation/glm-comparison.js';
import { detectPeaks, detectNulls } from '../analysis/peaks-nulls.js';
import { analyzeSubIntegration } from '../analysis/sub-integration.js';

// Input schema
export const AnalyzeRoomInputSchema = z.object({
  measurement_id: z.string().describe('Primary (post-GLM) measurement for analysis'),
  pre_measurement_id: z.string().optional().describe('Pre-GLM measurement for calibration comparison - if omitted, post-only heuristics are used'),
  left_measurement_id: z.string().optional().describe('Left channel measurement for L/R symmetry'),
  right_measurement_id: z.string().optional().describe('Right channel measurement for L/R symmetry'),
  sub_measurement_id: z.string().optional().describe('Subwoofer measurement for integration analysis'),
  room_dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional().describe('Room dimensions (in feet) for theoretical mode correlation')
});

export type AnalyzeRoomInput = z.infer<typeof AnalyzeRoomInputSchema>;

export interface AnalyzeRoomResult {
  overall_summary: string;
  overall_severity: 'significant' | 'moderate' | 'minor' | 'negligible';
  top_recommendations: Array<{
    priority: number;
    action: string;
    expected_impact: string;
    fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
    category: string;
    priority_score: number;
  }>;
  analysis_sections: {
    peaks_nulls?: {
      summary: string;
      data: PeaksNullsData;
      severity: string;
      confidence: string;
    };
    room_modes?: {
      summary: string;
      data: RoomModesData;
      severity: string;
      confidence: string;
    };
    sub_integration?: {
      summary: string;
      data: SubIntegrationData;
      severity: string;
      confidence: string;
    };
    lr_symmetry?: {
      summary: string;
      data: LRSymmetryData;
      severity: string;
      confidence: string;
    };
    glm_comparison?: {
      summary: string;
      data: GLMComparisonResult;
      confidence: 'high' | 'medium' | 'low';
    };
  };
}

/**
 * Execute unified room analysis tool
 */
export async function executeAnalyzeRoom(input: AnalyzeRoomInput): Promise<ToolResponse<AnalyzeRoomResult>> {
  try {
    const validated = AnalyzeRoomInputSchema.parse(input);

    // Get primary measurement
    const primaryMeasurement = measurementStore.get(validated.measurement_id);
    if (!primaryMeasurement) {
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Primary measurement '${validated.measurement_id}' not found`
      };
    }

    const analysisSections: AnalyzeRoomResult['analysis_sections'] = {};
    const allIssues: IssueInput[] = [];

    // 1. Peaks and Nulls Analysis (always run on primary measurement)
    const peaks = detectPeaks(primaryMeasurement.frequency_response);
    const nulls = detectNulls(primaryMeasurement.frequency_response);
    const peaksNullsInterpretation = interpretPeaksNulls(peaks, nulls);

    analysisSections.peaks_nulls = {
      summary: peaksNullsInterpretation.summary,
      data: peaksNullsInterpretation.data,
      severity: peaksNullsInterpretation.severity,
      confidence: peaksNullsInterpretation.confidence
    };

    // Collect issues from peaks/nulls recommendations
    peaksNullsInterpretation.recommendations.forEach(rec => {
      allIssues.push({
        issue: rec.action,
        severity: peaksNullsInterpretation.severity,
        fixability: rec.fixability,
        category: rec.category
      });
    });

    // 2. Room Modes Analysis (if dimensions provided)
    if (validated.room_dimensions) {
      const roomModesInterpretation = interpretRoomModes(
        peaks,
        validated.room_dimensions as RoomDimensions
      );

      analysisSections.room_modes = {
        summary: roomModesInterpretation.summary,
        data: roomModesInterpretation.data,
        severity: roomModesInterpretation.severity,
        confidence: roomModesInterpretation.confidence
      };

      // Collect issues from room modes recommendations
      roomModesInterpretation.recommendations.forEach(rec => {
        allIssues.push({
          issue: rec.action,
          severity: roomModesInterpretation.severity,
          fixability: rec.fixability,
          category: rec.category
        });
      });
    }

    // 3. Sub Integration Analysis (if sub measurement provided)
    if (validated.sub_measurement_id) {
      const subMeasurement = measurementStore.get(validated.sub_measurement_id);
      if (!subMeasurement) {
        return {
          status: 'error',
          error_type: 'measurement_not_found',
          message: `Sub measurement '${validated.sub_measurement_id}' not found`
        };
      }

      // Analyze sub integration
      const subAnalysis = analyzeSubIntegration(
        primaryMeasurement.frequency_response,
        subMeasurement.frequency_response
      );

      const subIntegrationInterpretation = interpretSubIntegration(subAnalysis);

      analysisSections.sub_integration = {
        summary: subIntegrationInterpretation.summary,
        data: subIntegrationInterpretation.data,
        severity: subIntegrationInterpretation.severity,
        confidence: subIntegrationInterpretation.confidence
      };

      // Collect issues from sub integration recommendations
      subIntegrationInterpretation.recommendations.forEach(rec => {
        allIssues.push({
          issue: rec.action,
          severity: subIntegrationInterpretation.severity,
          fixability: rec.fixability,
          category: rec.category
        });
      });
    }

    // 4. L/R Symmetry Analysis (if both L and R measurements provided)
    if (validated.left_measurement_id && validated.right_measurement_id) {
      const leftMeasurement = measurementStore.get(validated.left_measurement_id);
      const rightMeasurement = measurementStore.get(validated.right_measurement_id);

      if (!leftMeasurement) {
        return {
          status: 'error',
          error_type: 'measurement_not_found',
          message: `Left measurement '${validated.left_measurement_id}' not found`
        };
      }

      if (!rightMeasurement) {
        return {
          status: 'error',
          error_type: 'measurement_not_found',
          message: `Right measurement '${validated.right_measurement_id}' not found`
        };
      }

      const lrSymmetryInterpretation = interpretLRSymmetry(
        leftMeasurement.frequency_response,
        rightMeasurement.frequency_response
      );

      analysisSections.lr_symmetry = {
        summary: lrSymmetryInterpretation.summary,
        data: lrSymmetryInterpretation.data,
        severity: lrSymmetryInterpretation.severity,
        confidence: lrSymmetryInterpretation.confidence
      };

      // Collect issues from L/R symmetry recommendations
      lrSymmetryInterpretation.recommendations.forEach(rec => {
        allIssues.push({
          issue: rec.action,
          severity: lrSymmetryInterpretation.severity,
          fixability: rec.fixability,
          category: rec.category
        });
      });
    }

    // 5. GLM Comparison Analysis (always run - full or heuristic mode)
    if (validated.pre_measurement_id) {
      // Full comparison mode
      const preMeasurement = measurementStore.get(validated.pre_measurement_id);
      if (!preMeasurement) {
        return {
          status: 'error',
          error_type: 'measurement_not_found',
          message: `Pre-GLM measurement '${validated.pre_measurement_id}' not found`
        };
      }

      const glmComparison = compareGLMCalibration(preMeasurement, primaryMeasurement);

      analysisSections.glm_comparison = {
        summary: generateGLMSummary(glmComparison),
        data: glmComparison,
        confidence: 'high'
      };

      // Collect issues from GLM persistent problems for prioritization
      glmComparison.glm_persistent.forEach(persistent => {
        allIssues.push({
          issue: persistent.issue,
          severity: persistent.severity as any, // GLMBeyondScope uses string
          fixability: 'placement', // Most GLM-unfixable issues benefit from placement
          category: 'glm_beyond_scope'
        });
      });

    } else {
      // Post-only heuristic mode
      const glmHeuristic = analyzePostOnly(primaryMeasurement);

      analysisSections.glm_comparison = {
        summary: generateGLMSummary(glmHeuristic),
        data: glmHeuristic,
        confidence: 'medium'
      };

      // Collect issues from heuristic persistent problems
      glmHeuristic.glm_persistent.forEach(persistent => {
        allIssues.push({
          issue: persistent.issue,
          severity: persistent.severity as any,
          fixability: 'placement',
          category: 'glm_beyond_scope'
        });
      });
    }

    // Prioritize all collected issues
    const prioritized: PrioritizedIssue[] = prioritizeIssues(allIssues);

    // Take top 5 recommendations
    const topRecommendations = prioritized.slice(0, 5).map((issue, idx) => ({
      priority: idx + 1,
      action: issue.issue,
      expected_impact: issue.recommendation.expected_impact,
      fixability: issue.fixability,
      category: issue.category,
      priority_score: issue.priority_score
    }));

    // Generate overall summary
    const overallSummary = generateOverallSummary(analysisSections, topRecommendations.length);

    // Determine overall severity (worst of all sections)
    const overallSeverity = determineOverallSeverity(analysisSections);

    const result: AnalyzeRoomResult = {
      overall_summary: overallSummary,
      overall_severity: overallSeverity,
      top_recommendations: topRecommendations,
      analysis_sections: analysisSections
    };

    tuiEventBus.emit('analysis:room_complete', {
      overall_summary: result.overall_summary,
      overall_severity: result.overall_severity,
      top_recommendations: result.top_recommendations,
      analysis_sections: result.analysis_sections,
    });

    return {
      status: 'success',
      data: result
    };

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

/**
 * Generate overall summary from all analysis sections
 */
function generateOverallSummary(
  sections: AnalyzeRoomResult['analysis_sections'],
  recommendationCount: number
): string {
  const sectionNames: string[] = [];

  if (sections.peaks_nulls) sectionNames.push('peaks/nulls');
  if (sections.room_modes) sectionNames.push('room modes');
  if (sections.sub_integration) sectionNames.push('sub integration');
  if (sections.lr_symmetry) sectionNames.push('L/R symmetry');
  if (sections.glm_comparison) sectionNames.push('GLM calibration transparency');

  let summary = `Comprehensive room analysis completed covering: ${sectionNames.join(', ')}. `;

  if (recommendationCount > 0) {
    summary += `Top ${recommendationCount} prioritized recommendations provided based on fixability-first scoring (60% fixability + 40% severity). `;
  } else {
    summary += `No significant issues detected - room response is relatively optimal. `;
  }

  // Add key insights from each section
  if (sections.peaks_nulls) {
    const sbirCount = sections.peaks_nulls.data.sbir_nulls.length;
    if (sbirCount > 0) {
      summary += `${sbirCount} SBIR boundary interference nulls detected - repositioning recommended. `;
    }
  }

  if (sections.room_modes && sections.room_modes.data.dimensions_provided) {
    const correlatedCount = sections.room_modes.data.correlated_peaks?.filter(
      p => p.mode_correlation
    ).length ?? 0;
    if (correlatedCount > 0) {
      summary += `${correlatedCount} detected peaks correlate with theoretical room modes. `;
    }
  }

  if (sections.sub_integration && sections.sub_integration.data.phase_inversion.is_inverted) {
    summary += `Phase inversion detected at subwoofer crossover - polarity flip recommended. `;
  }

  if (sections.lr_symmetry) {
    const rating = sections.lr_symmetry.data.overall_rating;
    if (rating === 'poor' || rating === 'fair') {
      summary += `L/R symmetry is ${rating} - speaker positioning requires attention. `;
    }
  }

  if (sections.glm_comparison) {
    const glmData = sections.glm_comparison.data;
    if (glmData.mode === 'full_comparison' && glmData.glm_successes.length > 0) {
      summary += `GLM successfully corrected ${glmData.glm_successes.length} issue(s). `;
    }
    if (glmData.glm_persistent.length > 0) {
      summary += `${glmData.glm_persistent.length} issue(s) remain beyond GLM scope - positioning recommended. `;
    }
    if (glmData.overcorrection_indicators.bass_flatness.detected) {
      summary += `Note: Very flat sub-bass detected - some prefer slight natural variation. `;
    }
  }

  return summary;
}

/**
 * Determine overall severity from all sections
 */
function determineOverallSeverity(
  sections: AnalyzeRoomResult['analysis_sections']
): 'significant' | 'moderate' | 'minor' | 'negligible' {
  const severities: Array<'significant' | 'moderate' | 'minor' | 'negligible'> = [];

  if (sections.peaks_nulls) severities.push(sections.peaks_nulls.severity as any);
  if (sections.room_modes) severities.push(sections.room_modes.severity as any);
  if (sections.sub_integration) severities.push(sections.sub_integration.severity as any);
  if (sections.lr_symmetry) severities.push(sections.lr_symmetry.severity as any);

  // Map GLM persistent issue count to severity
  if (sections.glm_comparison) {
    const persistentCount = sections.glm_comparison.data.glm_persistent.length;
    if (persistentCount >= 3) severities.push('significant');
    else if (persistentCount >= 2) severities.push('moderate');
    else if (persistentCount >= 1) severities.push('minor');
  }

  // Worst severity drives overall
  const severityOrder = ['negligible', 'minor', 'moderate', 'significant'];
  const worstSeverity = severities.reduce((worst, current) => {
    const worstIndex = severityOrder.indexOf(worst);
    const currentIndex = severityOrder.indexOf(current);
    return currentIndex > worstIndex ? current : worst;
  }, 'negligible' as 'significant' | 'moderate' | 'minor' | 'negligible');

  return worstSeverity;
}
