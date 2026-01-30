/**
 * Tool: rew.ingest_measurement
 *
 * Parses and stores REW measurement data.
 */
import { z } from 'zod';
import type { IngestResult, ToolResponse } from '../types/index.js';
export declare const IngestInputSchema: z.ZodObject<{
    file_contents: z.ZodString;
    metadata: z.ZodObject<{
        speaker_id: z.ZodEnum<["L", "R", "C", "Sub", "Combined", "LFE", "SL", "SR", "RL", "RR"]>;
        condition: z.ZodString;
        mic_position_id: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        mic_position_id?: string | undefined;
        notes?: string | undefined;
    }, {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        mic_position_id?: string | undefined;
        notes?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    file_contents: string;
    metadata: {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        mic_position_id?: string | undefined;
        notes?: string | undefined;
    };
}, {
    file_contents: string;
    metadata: {
        speaker_id: "L" | "R" | "C" | "Sub" | "Combined" | "LFE" | "SL" | "SR" | "RL" | "RR";
        condition: string;
        mic_position_id?: string | undefined;
        notes?: string | undefined;
    };
}>;
export type IngestInput = z.infer<typeof IngestInputSchema>;
/**
 * Execute ingest measurement tool
 */
export declare function executeIngest(input: IngestInput): Promise<ToolResponse<IngestResult>>;
//# sourceMappingURL=ingest.d.ts.map