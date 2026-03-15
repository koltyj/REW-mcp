/**
 * Tool: rew.interpret_with_glm_context
 * 
 * Interprets analysis results with Genelec GLM context.
 */

import { z } from 'zod';
import { measurementStore } from '../store/measurement.js';
import type { ToolResponse, GLMCorrection, GLMBeyondScope, ConfidenceLevel } from '../types/index.js';

// Input schema
export const GLMInterpretInputSchema = z.object({
  comparison_id: z.string().optional(),
  measurement_id: z.string().optional(),
  analysis_results: z.any().optional(),
  glm_version: z.enum(['glm3', 'glm4', 'unknown']).default('unknown')
}).refine(
  data => data.comparison_id || data.measurement_id || data.analysis_results,
  { message: 'Must provide comparison_id, measurement_id, or analysis_results' }
);

export type GLMInterpretInput = z.infer<typeof GLMInterpretInputSchema>;

export interface GLMInterpretResult {
  interpretation_type: 'pre_post_glm_comparison' | 'single_measurement' | 'analysis_interpretation';
  glm_version: 'glm3' | 'glm4' | 'unknown';
  analysis_confidence: ConfidenceLevel;
  glm_effectiveness_assessment?: {
    overall: 'excellent' | 'good' | 'adequate' | 'limited' | 'poor';
    score: number;
    confidence: ConfidenceLevel;
  };
  corrections_successfully_applied: GLMCorrection[];
  issues_beyond_glm_scope: GLMBeyondScope[];
  residual_issues_assessment: Array<{
    issue: string;
    residual_deviation_db: number;
    assessment: 'acceptable' | 'borderline' | 'concerning';
    within_target: boolean;
    explanation: string;
  }>;
  glm_behavior_notes: Array<{
    observation: string;
    explanation: string;
    is_expected: boolean;
  }>;
  overall_verdict: {
    glm_calibration_quality: 'excellent' | 'good' | 'adequate' | 'limited' | 'poor';
    remaining_issues_summary: string[];
    system_readiness: 'ready' | 'ready_with_caveats' | 'needs_attention' | 'not_ready';
    primary_recommendation: string;
    acceptance_note: string;
  };
}

/**
 * Execute GLM interpretation tool
 */
export async function executeGLMInterpret(input: GLMInterpretInput): Promise<ToolResponse<GLMInterpretResult>> {
  try {
    const validated = GLMInterpretInputSchema.parse(input);
    
    // For now, implement basic single measurement interpretation
    // Full comparison interpretation would require storing comparison results
    
    if (validated.measurement_id) {
      const measurement = measurementStore.get(validated.measurement_id);
      if (!measurement) {
        return {
          status: 'error',
          error_type: 'measurement_not_found',
          message: `Measurement with ID '${validated.measurement_id}' not found`
        };
      }
      
      // Analyze from GLM perspective
      const result = interpretSingleMeasurement(measurement, validated.glm_version);
      
      return {
        status: 'success',
        data: result
      };
    }
    
    // Placeholder for comparison interpretation
    return {
      status: 'error',
      error_type: 'not_implemented',
      message: 'Comparison-based interpretation not yet implemented',
      suggestion: 'Provide measurement_id for single measurement interpretation'
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
 * Interpret a single measurement from GLM perspective
 */
function interpretSingleMeasurement(
  measurement: {
    quick_stats: { variance_20_200hz_db: number };
    data_quality: { confidence: ConfidenceLevel };
  },
  glmVersion: 'glm3' | 'glm4' | 'unknown'
): GLMInterpretResult {
  // This is a simplified implementation
  // A real implementation would analyze peaks/nulls and determine GLM's impact
  
  const corrections: GLMCorrection[] = [];
  const beyondScope: GLMBeyondScope[] = [];
  const behaviorNotes: Array<{
    observation: string;
    explanation: string;
    is_expected: boolean;
  }> = [];
  
  // Check variance in bass region
  const bassVariance = measurement.quick_stats.variance_20_200hz_db;
  
  if (bassVariance < 6) {
    behaviorNotes.push({
      observation: 'Low bass variance detected',
      explanation: 'GLM appears to have successfully smoothed bass response',
      is_expected: true
    });
  } else {
    behaviorNotes.push({
      observation: 'Elevated bass variance detected',
      explanation: 'Remaining bass issues may be beyond GLM scope (deep nulls or modes)',
      is_expected: true
    });
  }
  
  // GLM limitations note
  behaviorNotes.push({
    observation: 'GLM uses cut-only correction',
    explanation: 'GLM can reduce peaks but cannot fill nulls - deep nulls remain',
    is_expected: true
  });
  
  const remainingIssues: string[] = [];
  if (bassVariance > 8) {
    remainingIssues.push('Significant bass variance remains - likely room modes or nulls');
  }
  
  let systemReadiness: 'ready' | 'ready_with_caveats' | 'needs_attention' | 'not_ready';
  if (bassVariance < 6) systemReadiness = 'ready';
  else if (bassVariance < 10) systemReadiness = 'ready_with_caveats';
  else if (bassVariance < 15) systemReadiness = 'needs_attention';
  else systemReadiness = 'not_ready';
  
  const result: GLMInterpretResult = {
    interpretation_type: 'single_measurement',
    glm_version: glmVersion,
    analysis_confidence: measurement.data_quality.confidence,
    corrections_successfully_applied: corrections,
    issues_beyond_glm_scope: beyondScope,
    residual_issues_assessment: [],
    glm_behavior_notes: behaviorNotes,
    overall_verdict: {
      glm_calibration_quality: systemReadiness === 'ready' ? 'excellent' : 'good',
      remaining_issues_summary: remainingIssues,
      system_readiness: systemReadiness,
      primary_recommendation: systemReadiness === 'ready'
        ? 'System is well calibrated'
        : 'Consider speaker repositioning or room treatment for remaining bass issues',
      acceptance_note: 'GLM has performed cut-only correction within its capabilities'
    }
  };
  
  return result;
}
