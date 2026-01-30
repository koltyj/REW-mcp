/**
 * Tool: rew.api_audio
 *
 * Configure REW audio devices via API.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
import { type InputCalibration } from '../api/schemas.js';
export declare const ApiAudioInputSchema: z.ZodObject<{
    action: z.ZodEnum<["status", "list_devices", "set_input", "set_output", "set_sample_rate"]>;
    device: z.ZodOptional<z.ZodString>;
    sample_rate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "status" | "list_devices" | "set_input" | "set_output" | "set_sample_rate";
    device?: string | undefined;
    sample_rate?: number | undefined;
}, {
    action: "status" | "list_devices" | "set_input" | "set_output" | "set_sample_rate";
    device?: string | undefined;
    sample_rate?: number | undefined;
}>;
export type ApiAudioInput = z.infer<typeof ApiAudioInputSchema>;
export interface ApiAudioResult {
    action: string;
    success: boolean;
    message: string;
    audio_status?: {
        enabled: boolean;
        ready: boolean;
        driver?: string;
        sample_rate?: number;
        current_input?: string;
        current_output?: string;
    };
    available_devices?: {
        input_devices: string[];
        output_devices: string[];
        sample_rates: number[];
    };
    input_calibration?: InputCalibration | null;
}
/**
 * Execute API audio tool
 */
export declare function executeApiAudio(input: ApiAudioInput): Promise<ToolResponse<ApiAudioResult>>;
//# sourceMappingURL=api-audio.d.ts.map