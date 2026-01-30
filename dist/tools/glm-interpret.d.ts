/**
 * Tool: rew.interpret_with_glm_context
 *
 * Interprets analysis results with Genelec GLM context.
 */
import { z } from 'zod';
import type { ToolResponse, GLMCorrection, GLMBeyondScope, ConfidenceLevel } from '../types/index.js';
export declare const GLMInterpretInputSchema: z.ZodEffects<z.ZodObject<{
    comparison_id: z.ZodOptional<z.ZodString>;
    measurement_id: z.ZodOptional<z.ZodString>;
    analysis_results: z.ZodOptional<z.ZodAny>;
    glm_version: z.ZodDefault<z.ZodEnum<["glm3", "glm4", "unknown"]>>;
}, "strip", z.ZodTypeAny, {
    glm_version: "unknown" | "glm3" | "glm4";
    measurement_id?: string | undefined;
    comparison_id?: string | undefined;
    analysis_results?: any;
}, {
    measurement_id?: string | undefined;
    comparison_id?: string | undefined;
    analysis_results?: any;
    glm_version?: "unknown" | "glm3" | "glm4" | undefined;
}>, {
    glm_version: "unknown" | "glm3" | "glm4";
    measurement_id?: string | undefined;
    comparison_id?: string | undefined;
    analysis_results?: any;
}, {
    measurement_id?: string | undefined;
    comparison_id?: string | undefined;
    analysis_results?: any;
    glm_version?: "unknown" | "glm3" | "glm4" | undefined;
}>;
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
export declare function executeGLMInterpret(input: GLMInterpretInput): Promise<ToolResponse<GLMInterpretResult>>;
//# sourceMappingURL=glm-interpret.d.ts.map