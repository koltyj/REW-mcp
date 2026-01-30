/**
 * Tool: rew.api_generator
 *
 * Control REW's signal generator via API.
 * Useful for generating test tones, pink noise, sweeps, etc.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiGeneratorInputSchema: z.ZodObject<{
    action: z.ZodEnum<["status", "start", "stop", "set_signal", "set_level", "set_frequency", "list_signals"]>;
    signal: z.ZodOptional<z.ZodString>;
    level_db: z.ZodOptional<z.ZodNumber>;
    frequency_hz: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "status" | "start" | "stop" | "set_signal" | "set_level" | "set_frequency" | "list_signals";
    frequency_hz?: number | undefined;
    level_db?: number | undefined;
    signal?: string | undefined;
}, {
    action: "status" | "start" | "stop" | "set_signal" | "set_level" | "set_frequency" | "list_signals";
    frequency_hz?: number | undefined;
    level_db?: number | undefined;
    signal?: string | undefined;
}>;
export type ApiGeneratorInput = z.infer<typeof ApiGeneratorInputSchema>;
export interface ApiGeneratorResult {
    action: string;
    success: boolean;
    message: string;
    generator_status?: {
        enabled: boolean;
        playing: boolean;
        signal?: string;
        level_db?: number;
        frequency_hz?: number;
    };
    available_signals?: string[];
    available_commands?: string[];
}
/**
 * Execute API generator tool
 */
export declare function executeApiGenerator(input: ApiGeneratorInput): Promise<ToolResponse<ApiGeneratorResult>>;
//# sourceMappingURL=api-generator.d.ts.map