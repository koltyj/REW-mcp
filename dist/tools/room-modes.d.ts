/**
 * Tool: rew.analyze_room_modes
 *
 * Analyzes measurement for room modes, peaks, and nulls.
 */
import { z } from 'zod';
import { assessModeDistribution } from '../analysis/index.js';
import type { ToolResponse, DetectedPeak, DetectedNull, TheoreticalMode } from '../types/index.js';
export declare const RoomModesInputSchema: z.ZodObject<{
    measurement_id: z.ZodString;
    room_dimensions_m: z.ZodOptional<z.ZodObject<{
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
    analysis_options: z.ZodOptional<z.ZodObject<{
        peak_threshold_db: z.ZodDefault<z.ZodNumber>;
        null_threshold_db: z.ZodDefault<z.ZodNumber>;
        frequency_range_hz: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, "strip", z.ZodTypeAny, {
        frequency_range_hz: [number, number];
        peak_threshold_db: number;
        null_threshold_db: number;
    }, {
        frequency_range_hz?: [number, number] | undefined;
        peak_threshold_db?: number | undefined;
        null_threshold_db?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    measurement_id: string;
    room_dimensions_m?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
    analysis_options?: {
        frequency_range_hz: [number, number];
        peak_threshold_db: number;
        null_threshold_db: number;
    } | undefined;
}, {
    measurement_id: string;
    room_dimensions_m?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
    analysis_options?: {
        frequency_range_hz?: [number, number] | undefined;
        peak_threshold_db?: number | undefined;
        null_threshold_db?: number | undefined;
    } | undefined;
}>;
export type RoomModesInput = z.infer<typeof RoomModesInputSchema>;
export interface RoomModesResult {
    measurement_id: string;
    analysis_type: 'room_mode_analysis';
    analysis_confidence: string;
    detected_peaks: DetectedPeak[];
    detected_nulls: DetectedNull[];
    theoretical_room_modes?: TheoreticalMode[];
    mode_distribution_assessment?: ReturnType<typeof assessModeDistribution>;
    summary: {
        total_peaks_detected: number;
        total_nulls_detected: number;
        modes_correlated: number;
        primary_issues: string[];
        glm_addressable_issues: number;
        placement_sensitive_issues: number;
        recommended_priority: Array<{
            priority: number;
            issue: string;
            action: string;
            reasoning: string;
        }>;
    };
}
/**
 * Execute room modes analysis tool
 */
export declare function executeRoomModes(input: RoomModesInput): Promise<ToolResponse<RoomModesResult>>;
//# sourceMappingURL=room-modes.d.ts.map