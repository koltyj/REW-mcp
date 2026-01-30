/**
 * Tool: rew.api_measurement_session
 *
 * Guided L/R/Sub measurement workflow with session state.
 * Sessions persist across tool calls and can be resumed.
 * REW Pro license required for automated measurements.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
import { type SessionState, type SessionMeasurement } from '../session/index.js';
import { type SequenceStep } from '../session/index.js';
export declare const ApiMeasurementSessionInputSchema: z.ZodObject<{
    action: z.ZodEnum<["start_session", "measure", "get_status", "stop_session"]>;
    session_id: z.ZodOptional<z.ZodString>;
    channel: z.ZodOptional<z.ZodEnum<["left", "right", "sub"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "measure" | "get_status" | "start_session" | "stop_session";
    notes?: string | undefined;
    session_id?: string | undefined;
    channel?: "left" | "right" | "sub" | undefined;
}, {
    action: "measure" | "get_status" | "start_session" | "stop_session";
    notes?: string | undefined;
    session_id?: string | undefined;
    channel?: "left" | "right" | "sub" | undefined;
}>;
export type ApiMeasurementSessionInput = z.infer<typeof ApiMeasurementSessionInputSchema>;
export interface ApiMeasurementSessionResult {
    action: string;
    session_id?: string;
    sequence_step?: SequenceStep;
    next_step?: string | null;
    message: string;
    guidance?: string;
    measurements?: SessionMeasurement[];
    session?: SessionState;
    active_sessions?: SessionState[];
}
/**
 * Execute API measurement session tool
 */
export declare function executeApiMeasurementSession(input: ApiMeasurementSessionInput): Promise<ToolResponse<ApiMeasurementSessionResult>>;
//# sourceMappingURL=api-measurement-session.d.ts.map