/**
 * Tool: rew.api_spl_meter
 *
 * Control REW's SPL meter via API.
 * Useful for live level monitoring with various weightings (A, C, Z).
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiSPLMeterInputSchema: z.ZodObject<{
    action: z.ZodEnum<["start", "stop", "read", "configure"]>;
    meter_id: z.ZodDefault<z.ZodNumber>;
    config: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["SPL", "Leq", "SEL"]>>;
        weighting: z.ZodOptional<z.ZodEnum<["A", "C", "Z"]>>;
        filter: z.ZodOptional<z.ZodEnum<["Slow", "Fast", "Impulse"]>>;
    }, "strip", z.ZodTypeAny, {
        filter?: "Slow" | "Fast" | "Impulse" | undefined;
        mode?: "SPL" | "Leq" | "SEL" | undefined;
        weighting?: "C" | "A" | "Z" | undefined;
    }, {
        filter?: "Slow" | "Fast" | "Impulse" | undefined;
        mode?: "SPL" | "Leq" | "SEL" | undefined;
        weighting?: "C" | "A" | "Z" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    action: "start" | "stop" | "configure" | "read";
    meter_id: number;
    config?: {
        filter?: "Slow" | "Fast" | "Impulse" | undefined;
        mode?: "SPL" | "Leq" | "SEL" | undefined;
        weighting?: "C" | "A" | "Z" | undefined;
    } | undefined;
}, {
    action: "start" | "stop" | "configure" | "read";
    config?: {
        filter?: "Slow" | "Fast" | "Impulse" | undefined;
        mode?: "SPL" | "Leq" | "SEL" | undefined;
        weighting?: "C" | "A" | "Z" | undefined;
    } | undefined;
    meter_id?: number | undefined;
}>;
export type ApiSPLMeterInput = z.infer<typeof ApiSPLMeterInputSchema>;
export interface ApiSPLMeterResult {
    action: string;
    success: boolean;
    message: string;
    meter_id: number;
    levels?: {
        spl_db: number;
        leq_db: number;
        sel_db: number;
        weighting: string;
        filter: string;
        elapsed_time_s?: number;
    };
    config?: {
        mode?: string;
        weighting?: string;
        filter?: string;
    };
}
/**
 * Execute API SPL meter tool
 */
export declare function executeApiSPLMeter(input: ApiSPLMeterInput): Promise<ToolResponse<ApiSPLMeterResult>>;
//# sourceMappingURL=api-spl-meter.d.ts.map