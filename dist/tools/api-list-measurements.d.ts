/**
 * Tool: rew.api_list_measurements
 *
 * List all measurements available in the connected REW instance.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiListMeasurementsInputSchema: z.ZodObject<{
    filter_type: z.ZodDefault<z.ZodEnum<["all", "frequency_response", "impulse_response"]>>;
}, "strip", z.ZodTypeAny, {
    filter_type: "frequency_response" | "impulse_response" | "all";
}, {
    filter_type?: "frequency_response" | "impulse_response" | "all" | undefined;
}>;
export type ApiListMeasurementsInput = z.infer<typeof ApiListMeasurementsInputSchema>;
export interface MeasurementListItem {
    uuid: string;
    name: string;
    index: number;
    type: string;
    has_ir: boolean;
    has_fr: boolean;
}
export interface ApiListMeasurementsResult {
    connected: boolean;
    measurement_count: number;
    measurements: MeasurementListItem[];
}
/**
 * Execute API list measurements tool
 */
export declare function executeApiListMeasurements(input: ApiListMeasurementsInput): Promise<ToolResponse<ApiListMeasurementsResult>>;
//# sourceMappingURL=api-list-measurements.d.ts.map