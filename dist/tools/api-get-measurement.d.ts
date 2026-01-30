/**
 * Tool: rew.api_get_measurement
 *
 * Fetch a measurement directly from REW via API.
 * Measurement is identified by UUID, not index (per REW docs:
 * "use UUIDs as indices shift when measurements are added/removed").
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiGetMeasurementInputSchema: z.ZodObject<{
    measurement_uuid: z.ZodString;
    include_ir: z.ZodDefault<z.ZodBoolean>;
    smoothing: z.ZodDefault<z.ZodEnum<["none", "1/48", "1/24", "1/12", "1/6", "1/3", "1/1"]>>;
    store_measurement: z.ZodDefault<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodObject<{
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
    smoothing: "none" | "1/48" | "1/24" | "1/12" | "1/6" | "1/3" | "1/1";
    measurement_uuid: string;
    include_ir: boolean;
    store_measurement: boolean;
    metadata?: {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        notes?: string | undefined;
    } | undefined;
}, {
    measurement_uuid: string;
    metadata?: {
        speaker_id?: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR" | undefined;
        condition?: string | undefined;
        notes?: string | undefined;
    } | undefined;
    smoothing?: "none" | "1/48" | "1/24" | "1/12" | "1/6" | "1/3" | "1/1" | undefined;
    include_ir?: boolean | undefined;
    store_measurement?: boolean | undefined;
}>;
export type ApiGetMeasurementInput = z.infer<typeof ApiGetMeasurementInputSchema>;
export interface ApiGetMeasurementResult {
    measurement_id?: string;
    measurement_uuid: string;
    measurement_name: string;
    summary: {
        data_type: 'frequency_response' | 'impulse_response' | 'combined';
        frequency_range_hz: [number, number];
        data_points: number;
        has_phase_data: boolean;
        has_impulse_data: boolean;
        overall_level_db: number;
    };
    quick_stats?: {
        bass_avg_db: number;
        midrange_avg_db: number;
        treble_avg_db: number;
        variance_20_200hz_db: number;
        variance_200_2000hz_db: number;
        variance_2000_20000hz_db: number;
    };
    stored: boolean;
}
/**
 * Execute API get measurement tool
 */
export declare function executeApiGetMeasurement(input: ApiGetMeasurementInput): Promise<ToolResponse<ApiGetMeasurementResult>>;
//# sourceMappingURL=api-get-measurement.d.ts.map