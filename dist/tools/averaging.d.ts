/**
 * Tool: rew.average_measurements
 *
 * Create a spatial average from multiple measurement positions.
 * Implements REW's averaging methods: RMS (incoherent, ignores phase),
 * Vector (coherent, requires IR data), or hybrid methods.
 */
import { z } from 'zod';
import { AveragingMethod } from '../analysis/averaging.js';
import type { ToolResponse } from '../types/index.js';
export declare const AveragingInputSchema: z.ZodObject<{
    measurement_ids: z.ZodArray<z.ZodString, "many">;
    method: z.ZodDefault<z.ZodEnum<["rms", "db", "vector", "rms_phase", "db_phase"]>>;
    align_spl: z.ZodDefault<z.ZodBoolean>;
    alignment_range_hz: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    weights: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    store_result: z.ZodDefault<z.ZodBoolean>;
    result_metadata: z.ZodOptional<z.ZodObject<{
        speaker_id: z.ZodDefault<z.ZodEnum<["L", "R", "C", "Sub", "Combined", "LFE", "SL", "SR", "RL", "RR"]>>;
        condition: z.ZodDefault<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        notes?: string | undefined;
    }, {
        speaker_id?: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR" | undefined;
        condition?: string | undefined;
        notes?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    measurement_ids: string[];
    method: "db" | "rms" | "vector" | "rms_phase" | "db_phase";
    align_spl: boolean;
    alignment_range_hz: number[];
    store_result: boolean;
    weights?: number[] | undefined;
    result_metadata?: {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        notes?: string | undefined;
    } | undefined;
}, {
    measurement_ids: string[];
    method?: "db" | "rms" | "vector" | "rms_phase" | "db_phase" | undefined;
    align_spl?: boolean | undefined;
    alignment_range_hz?: number[] | undefined;
    weights?: number[] | undefined;
    store_result?: boolean | undefined;
    result_metadata?: {
        speaker_id?: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR" | undefined;
        condition?: string | undefined;
        notes?: string | undefined;
    } | undefined;
}>;
export type AveragingInput = z.infer<typeof AveragingInputSchema>;
export interface AveragingToolResult {
    averaged_measurement_id: string | null;
    method_used: AveragingMethod;
    input_measurements: number;
    frequency_range_hz: [number, number];
    spl_alignment_applied: boolean;
    alignment_offsets_db: number[];
    quick_stats: {
        bass_avg_db: number;
        midrange_avg_db: number;
        treble_avg_db: number;
        variance_20_200hz_db: number;
        variance_200_2000hz_db: number;
        variance_2000_20000hz_db: number;
    };
    source_measurements: Array<{
        id: string;
        speaker_id: string;
        condition: string;
    }>;
    warnings: string[];
}
/**
 * Execute average measurements tool
 */
export declare function executeAveraging(input: AveragingInput): Promise<ToolResponse<AveragingToolResult>>;
//# sourceMappingURL=averaging.d.ts.map