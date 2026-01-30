/**
 * Tool: rew.analyze_sub_integration
 *
 * Analyze subwoofer integration with main speakers.
 * Evaluates phase alignment, timing, and polarity at the crossover region.
 * Provides delay and polarity recommendations for optimal summation.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const SubIntegrationInputSchema: z.ZodObject<{
    mains_measurement_id: z.ZodString;
    sub_measurement_id: z.ZodString;
    combined_measurement_id: z.ZodOptional<z.ZodString>;
    crossover_hz: z.ZodOptional<z.ZodNumber>;
    current_sub_delay_ms: z.ZodDefault<z.ZodNumber>;
    current_sub_polarity: z.ZodDefault<z.ZodEnum<["normal", "inverted"]>>;
    store_predicted_combined: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    mains_measurement_id: string;
    sub_measurement_id: string;
    current_sub_delay_ms: number;
    current_sub_polarity: "normal" | "inverted";
    store_predicted_combined: boolean;
    combined_measurement_id?: string | undefined;
    crossover_hz?: number | undefined;
}, {
    mains_measurement_id: string;
    sub_measurement_id: string;
    combined_measurement_id?: string | undefined;
    crossover_hz?: number | undefined;
    current_sub_delay_ms?: number | undefined;
    current_sub_polarity?: "normal" | "inverted" | undefined;
    store_predicted_combined?: boolean | undefined;
}>;
export type SubIntegrationInput = z.infer<typeof SubIntegrationInputSchema>;
export interface SubIntegrationToolResult {
    analysis_type: 'sub_integration';
    crossover_analysis: {
        detected_crossover_hz: number;
        mains_rolloff_hz: number;
        sub_rolloff_hz: number;
        overlap_range_hz: [number, number];
        phase_at_crossover_mains_deg: number;
        phase_at_crossover_sub_deg: number;
        phase_difference_deg: number;
        phase_alignment_quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
    timing_recommendations: {
        current_delay_ms: number;
        optimal_delay_ms: number;
        adjustment_needed_ms: number;
        alignment_method_used: string;
    };
    polarity_recommendation: {
        current_polarity: string;
        recommended_polarity: string;
        invert_recommended: boolean;
        expected_improvement_db: number;
    };
    summation_prediction: {
        current_dip_at_crossover_db: number;
        predicted_dip_after_optimization_db: number;
        improvement_db: number;
    };
    ir_based_delay?: {
        estimated_delay_ms: number;
        confidence: string;
    };
    predicted_combined_measurement_id?: string;
    confidence: string;
    warnings: string[];
    recommendations: string[];
}
/**
 * Execute sub integration analysis tool
 */
export declare function executeSubIntegration(input: SubIntegrationInput): Promise<ToolResponse<SubIntegrationToolResult>>;
//# sourceMappingURL=sub-integration.d.ts.map