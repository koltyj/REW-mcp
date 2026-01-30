/**
 * Tool: rew.api_measure
 *
 * Control REW measurements via API.
 * Note: Automated sweep measurements require REW Pro license.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiMeasureInputSchema: z.ZodObject<{
    action: z.ZodEnum<["status", "sweep", "spl", "cancel", "configure"]>;
    config: z.ZodOptional<z.ZodObject<{
        level_db: z.ZodOptional<z.ZodNumber>;
        start_freq_hz: z.ZodOptional<z.ZodNumber>;
        end_freq_hz: z.ZodOptional<z.ZodNumber>;
        sweep_length: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
        name_prefix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        notes?: string | undefined;
        level_db?: number | undefined;
        start_freq_hz?: number | undefined;
        end_freq_hz?: number | undefined;
        sweep_length?: number | undefined;
        name_prefix?: string | undefined;
    }, {
        notes?: string | undefined;
        level_db?: number | undefined;
        start_freq_hz?: number | undefined;
        end_freq_hz?: number | undefined;
        sweep_length?: number | undefined;
        name_prefix?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    action: "spl" | "status" | "sweep" | "cancel" | "configure";
    config?: {
        notes?: string | undefined;
        level_db?: number | undefined;
        start_freq_hz?: number | undefined;
        end_freq_hz?: number | undefined;
        sweep_length?: number | undefined;
        name_prefix?: string | undefined;
    } | undefined;
}, {
    action: "spl" | "status" | "sweep" | "cancel" | "configure";
    config?: {
        notes?: string | undefined;
        level_db?: number | undefined;
        start_freq_hz?: number | undefined;
        end_freq_hz?: number | undefined;
        sweep_length?: number | undefined;
        name_prefix?: string | undefined;
    } | undefined;
}>;
export type ApiMeasureInput = z.infer<typeof ApiMeasureInputSchema>;
export interface ApiMeasureResult {
    action: string;
    success: boolean;
    message: string;
    current_config?: {
        level_db?: number;
        level_unit?: string;
        sweep_start_hz?: number;
        sweep_end_hz?: number;
        sweep_length?: number;
    };
    available_commands?: string[];
    pro_license_required?: boolean;
}
/**
 * Execute API measure tool
 */
export declare function executeApiMeasure(input: ApiMeasureInput): Promise<ToolResponse<ApiMeasureResult>>;
//# sourceMappingURL=api-measure.d.ts.map