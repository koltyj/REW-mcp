/**
 * Tool: rew.compare_measurements
 *
 * Compares two or more measurements.
 */
import { z } from 'zod';
import type { ToolResponse, FrequencyBandAnalysis, ComparisonType, AssessmentVerdict, ConfidenceLevel } from '../types/index.js';
export declare const CompareInputSchema: z.ZodObject<{
    measurement_ids: z.ZodArray<z.ZodString, "many">;
    comparison_type: z.ZodEnum<["before_after", "placement_comparison", "lr_symmetry", "with_without_sub"]>;
    reference_measurement_id: z.ZodOptional<z.ZodString>;
    frequency_range_hz: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
}, "strip", z.ZodTypeAny, {
    measurement_ids: string[];
    comparison_type: "before_after" | "placement_comparison" | "lr_symmetry" | "with_without_sub";
    reference_measurement_id?: string | undefined;
    frequency_range_hz?: [number, number] | undefined;
}, {
    measurement_ids: string[];
    comparison_type: "before_after" | "placement_comparison" | "lr_symmetry" | "with_without_sub";
    reference_measurement_id?: string | undefined;
    frequency_range_hz?: [number, number] | undefined;
}>;
export type CompareInput = z.infer<typeof CompareInputSchema>;
export interface CompareResult {
    comparison_id: string;
    comparison_type: ComparisonType;
    measurements_compared: Array<{
        id: string;
        role: string;
        condition: string;
    }>;
    frequency_band_analysis: FrequencyBandAnalysis[];
    overall_assessment: {
        verdict: AssessmentVerdict;
        confidence: ConfidenceLevel;
        improvement_score: number;
        summary: {
            bands_improved: number;
            bands_regressed: number;
            bands_unchanged: number;
        };
    };
    analysis_confidence: ConfidenceLevel;
    analysis_limitations: string[];
}
/**
 * Execute compare measurements tool
 */
export declare function executeCompare(input: CompareInput): Promise<ToolResponse<CompareResult>>;
//# sourceMappingURL=compare.d.ts.map