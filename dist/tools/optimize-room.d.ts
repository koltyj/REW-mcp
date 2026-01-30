/**
 * Tool: rew.optimize_room
 *
 * Multi-action optimization guidance tool providing recommendations,
 * validation, and progress tracking for room optimization workflow.
 */
import { z } from 'zod';
import { type ValidationResult } from '../optimization/validation.js';
import { type SuccessCriteriaResult } from '../optimization/success-criteria.js';
import type { ToolResponse } from '../types/index.js';
import type { PlacementRecommendation } from '../optimization/types.js';
export declare const OptimizeRoomInputSchema: z.ZodObject<{
    action: z.ZodEnum<["get_recommendation", "validate_adjustment", "check_progress"]>;
    measurement_id: z.ZodString;
    pre_measurement_id: z.ZodOptional<z.ZodString>;
    target_frequency_hz: z.ZodOptional<z.ZodNumber>;
    target_category: z.ZodOptional<z.ZodString>;
    session_id: z.ZodOptional<z.ZodString>;
    left_measurement_id: z.ZodOptional<z.ZodString>;
    right_measurement_id: z.ZodOptional<z.ZodString>;
    sub_measurement_id: z.ZodOptional<z.ZodString>;
    room_dimensions: z.ZodOptional<z.ZodObject<{
        length: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        length: number;
        width: number;
        height: number;
    }, {
        length: number;
        width: number;
        height: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    measurement_id: string;
    action: "get_recommendation" | "validate_adjustment" | "check_progress";
    session_id?: string | undefined;
    pre_measurement_id?: string | undefined;
    left_measurement_id?: string | undefined;
    right_measurement_id?: string | undefined;
    sub_measurement_id?: string | undefined;
    room_dimensions?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
    target_frequency_hz?: number | undefined;
    target_category?: string | undefined;
}, {
    measurement_id: string;
    action: "get_recommendation" | "validate_adjustment" | "check_progress";
    session_id?: string | undefined;
    pre_measurement_id?: string | undefined;
    left_measurement_id?: string | undefined;
    right_measurement_id?: string | undefined;
    sub_measurement_id?: string | undefined;
    room_dimensions?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
    target_frequency_hz?: number | undefined;
    target_category?: string | undefined;
}>;
export type OptimizeRoomInput = z.infer<typeof OptimizeRoomInputSchema>;
export interface GetRecommendationResult {
    recommendation: PlacementRecommendation;
    priority_rank: number;
    total_issues: number;
    next_steps: string;
}
export interface ValidateAdjustmentResult extends ValidationResult {
}
export interface CheckProgressResult extends SuccessCriteriaResult {
}
export type OptimizeRoomResult = GetRecommendationResult | ValidateAdjustmentResult | CheckProgressResult;
/**
 * Execute optimization guidance tool
 */
export declare function executeOptimizeRoom(input: OptimizeRoomInput): Promise<ToolResponse<OptimizeRoomResult>>;
//# sourceMappingURL=optimize-room.d.ts.map