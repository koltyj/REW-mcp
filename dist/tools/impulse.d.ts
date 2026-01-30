/**
 * Tool: rew.analyze_impulse
 *
 * Analyzes impulse response for early reflections.
 */
import { z } from 'zod';
import type { ToolResponse, EarlyReflection, ClarityMetrics, ConfidenceLevel } from '../types/index.js';
export declare const ImpulseInputSchema: z.ZodObject<{
    measurement_id: z.ZodString;
    analysis_options: z.ZodOptional<z.ZodObject<{
        max_reflection_time_ms: z.ZodDefault<z.ZodNumber>;
        reflection_threshold_db: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_reflection_time_ms: number;
        reflection_threshold_db: number;
    }, {
        max_reflection_time_ms?: number | undefined;
        reflection_threshold_db?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    measurement_id: string;
    analysis_options?: {
        max_reflection_time_ms: number;
        reflection_threshold_db: number;
    } | undefined;
}, {
    measurement_id: string;
    analysis_options?: {
        max_reflection_time_ms?: number | undefined;
        reflection_threshold_db?: number | undefined;
    } | undefined;
}>;
export type ImpulseInput = z.infer<typeof ImpulseInputSchema>;
export interface ImpulseResult {
    measurement_id: string;
    analysis_type: 'impulse_response_analysis';
    analysis_confidence: ConfidenceLevel;
    direct_sound: {
        arrival_time_ms: number;
        level_db: number;
        peak_sample_index: number;
    };
    early_reflections: EarlyReflection[];
    initial_time_delay_gap: {
        itd_ms: number;
        assessment: 'excellent' | 'good' | 'acceptable' | 'short' | 'poor';
        note: string;
        ideal_minimum_ms: number;
        impact: string;
    };
    reflection_pattern_analysis: {
        total_early_reflections: number;
        significant_reflections: number;
        average_level_db: number;
        reflection_density: 'sparse' | 'moderate' | 'dense';
    };
    comb_filtering_risk: {
        level: 'severe' | 'moderate' | 'low' | 'minimal';
        primary_concern?: {
            source: string;
            first_null_frequency_hz: number;
            affected_range: string;
        };
        expected_audible_effect: string;
    };
    clarity_metrics: ClarityMetrics;
    summary: {
        primary_issues: string[];
        reflection_quality: 'excellent' | 'good' | 'acceptable' | 'needs_improvement' | 'poor';
        recommended_priority: Array<{
            priority: number;
            issue: string;
            action: string;
            impact: string;
        }>;
    };
}
/**
 * Execute impulse analysis tool
 */
export declare function executeImpulse(input: ImpulseInput): Promise<ToolResponse<ImpulseResult>>;
//# sourceMappingURL=impulse.d.ts.map