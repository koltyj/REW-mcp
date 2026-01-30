/**
 * Tool: rew.api_calibrate_spl
 *
 * Semi-automated SPL calibration workflow for monitor level setting.
 * Plays pink noise, reads SPL meter, guides user to target level.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiCalibrateSPLInputSchema: z.ZodObject<{
    action: z.ZodEnum<["start", "check", "stop"]>;
    target_spl: z.ZodDefault<z.ZodNumber>;
    tolerance_db: z.ZodDefault<z.ZodNumber>;
    weighting: z.ZodDefault<z.ZodEnum<["A", "C", "Z"]>>;
    meter_id: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "start" | "stop" | "check";
    meter_id: number;
    weighting: "C" | "A" | "Z";
    target_spl: number;
    tolerance_db: number;
}, {
    action: "start" | "stop" | "check";
    meter_id?: number | undefined;
    weighting?: "C" | "A" | "Z" | undefined;
    target_spl?: number | undefined;
    tolerance_db?: number | undefined;
}>;
export type ApiCalibrateSPLInput = z.infer<typeof ApiCalibrateSPLInputSchema>;
export interface ApiCalibrateSPLResult {
    action: string;
    success: boolean;
    message: string;
    calibration_status?: {
        current_spl?: number;
        target_spl: number;
        adjustment_db?: number;
        within_tolerance: boolean;
        tolerance_db: number;
        weighting: string;
        guidance?: string;
    };
}
/**
 * Execute API calibrate SPL tool
 */
export declare function executeApiCalibrateSPL(input: ApiCalibrateSPLInput): Promise<ToolResponse<ApiCalibrateSPLResult>>;
//# sourceMappingURL=api-calibrate-spl.d.ts.map