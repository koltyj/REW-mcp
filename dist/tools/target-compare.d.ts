/**
 * Tool: rew.compare_to_target
 *
 * Compare a measurement against a target response curve.
 * Supports flat, house curves, and REW room curve with LF rise and HF fall.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const TargetCompareInputSchema: z.ZodObject<{
    measurement_id: z.ZodString;
    target_type: z.ZodDefault<z.ZodEnum<["flat", "rew_room_curve", "harman", "bk_house", "custom"]>>;
    custom_curve_points: z.ZodOptional<z.ZodArray<z.ZodObject<{
        frequency_hz: z.ZodNumber;
        level_db: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        frequency_hz: number;
        level_db: number;
    }, {
        frequency_hz: number;
        level_db: number;
    }>, "many">>;
    alignment_frequency_hz: z.ZodDefault<z.ZodNumber>;
    evaluation_range_hz: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    measurement_id: string;
    target_type: "flat" | "rew_room_curve" | "harman" | "bk_house" | "custom";
    alignment_frequency_hz: number;
    evaluation_range_hz: number[];
    custom_curve_points?: {
        frequency_hz: number;
        level_db: number;
    }[] | undefined;
}, {
    measurement_id: string;
    target_type?: "flat" | "rew_room_curve" | "harman" | "bk_house" | "custom" | undefined;
    custom_curve_points?: {
        frequency_hz: number;
        level_db: number;
    }[] | undefined;
    alignment_frequency_hz?: number | undefined;
    evaluation_range_hz?: number[] | undefined;
}>;
export type TargetCompareInput = z.infer<typeof TargetCompareInputSchema>;
export interface TargetCompareToolResult {
    measurement_id: string;
    analysis_type: 'target_comparison';
    target_used: string;
    alignment_offset_db: number;
    deviation_statistics: {
        average_deviation_db: number;
        max_positive_deviation_db: number;
        max_negative_deviation_db: number;
        rms_deviation_db: number;
    };
    by_band: Array<{
        band_name: string;
        range_hz: [number, number];
        average_deviation_db: number;
        assessment: string;
    }>;
    worst_deviations: Array<{
        frequency_hz: number;
        deviation_db: number;
        type: 'peak' | 'null';
    }>;
    overall_grade: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'poor';
    recommendations: string[];
}
/**
 * Execute target compare tool
 */
export declare function executeTargetCompare(input: TargetCompareInput): Promise<ToolResponse<TargetCompareToolResult>>;
//# sourceMappingURL=target-compare.d.ts.map