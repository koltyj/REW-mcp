/**
 * Tool: rew.api_measure_workflow
 *
 * Comprehensive measurement workflow orchestration.
 * Handles device setup, level calibration, measurement execution, and result retrieval.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiMeasureWorkflowInputSchema: z.ZodObject<{
    action: z.ZodEnum<["setup", "check_levels", "calibrate_level", "measure", "measure_sequence", "get_status"]>;
    setup: z.ZodOptional<z.ZodObject<{
        input_device: z.ZodOptional<z.ZodString>;
        output_device: z.ZodOptional<z.ZodString>;
        sample_rate: z.ZodOptional<z.ZodNumber>;
        use_blocking: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        use_blocking: boolean;
        sample_rate?: number | undefined;
        input_device?: string | undefined;
        output_device?: string | undefined;
    }, {
        sample_rate?: number | undefined;
        input_device?: string | undefined;
        output_device?: string | undefined;
        use_blocking?: boolean | undefined;
    }>>;
    measurement: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        level_dbfs: z.ZodDefault<z.ZodNumber>;
        start_freq_hz: z.ZodDefault<z.ZodNumber>;
        end_freq_hz: z.ZodDefault<z.ZodNumber>;
        target_spl_db: z.ZodOptional<z.ZodNumber>;
        output_channel: z.ZodDefault<z.ZodEnum<["left", "right", "both"]>>;
    }, "strip", z.ZodTypeAny, {
        start_freq_hz: number;
        end_freq_hz: number;
        level_dbfs: number;
        output_channel: "left" | "right" | "both";
        name?: string | undefined;
        target_spl_db?: number | undefined;
    }, {
        name?: string | undefined;
        start_freq_hz?: number | undefined;
        end_freq_hz?: number | undefined;
        level_dbfs?: number | undefined;
        target_spl_db?: number | undefined;
        output_channel?: "left" | "right" | "both" | undefined;
    }>>;
    sequence: z.ZodOptional<z.ZodObject<{
        measurements: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            output_channel: z.ZodOptional<z.ZodEnum<["left", "right", "both"]>>;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            notes?: string | undefined;
            output_channel?: "left" | "right" | "both" | undefined;
        }, {
            name: string;
            notes?: string | undefined;
            output_channel?: "left" | "right" | "both" | undefined;
        }>, "many">>;
        delay_between_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        delay_between_ms: number;
        measurements?: {
            name: string;
            notes?: string | undefined;
            output_channel?: "left" | "right" | "both" | undefined;
        }[] | undefined;
    }, {
        measurements?: {
            name: string;
            notes?: string | undefined;
            output_channel?: "left" | "right" | "both" | undefined;
        }[] | undefined;
        delay_between_ms?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    action: "setup" | "check_levels" | "calibrate_level" | "measure" | "measure_sequence" | "get_status";
    setup?: {
        use_blocking: boolean;
        sample_rate?: number | undefined;
        input_device?: string | undefined;
        output_device?: string | undefined;
    } | undefined;
    measurement?: {
        start_freq_hz: number;
        end_freq_hz: number;
        level_dbfs: number;
        output_channel: "left" | "right" | "both";
        name?: string | undefined;
        target_spl_db?: number | undefined;
    } | undefined;
    sequence?: {
        delay_between_ms: number;
        measurements?: {
            name: string;
            notes?: string | undefined;
            output_channel?: "left" | "right" | "both" | undefined;
        }[] | undefined;
    } | undefined;
}, {
    action: "setup" | "check_levels" | "calibrate_level" | "measure" | "measure_sequence" | "get_status";
    setup?: {
        sample_rate?: number | undefined;
        input_device?: string | undefined;
        output_device?: string | undefined;
        use_blocking?: boolean | undefined;
    } | undefined;
    measurement?: {
        name?: string | undefined;
        start_freq_hz?: number | undefined;
        end_freq_hz?: number | undefined;
        level_dbfs?: number | undefined;
        target_spl_db?: number | undefined;
        output_channel?: "left" | "right" | "both" | undefined;
    } | undefined;
    sequence?: {
        measurements?: {
            name: string;
            notes?: string | undefined;
            output_channel?: "left" | "right" | "both" | undefined;
        }[] | undefined;
        delay_between_ms?: number | undefined;
    } | undefined;
}>;
export type ApiMeasureWorkflowInput = z.infer<typeof ApiMeasureWorkflowInputSchema>;
export interface WorkflowStatus {
    connected: boolean;
    audio_ready: boolean;
    input_device?: string;
    output_device?: string;
    sample_rate?: number;
    blocking_mode: boolean;
    current_level_dbfs?: number;
    measurement_count: number;
    pro_features: boolean;
    mic_calibrated: boolean;
    cal_sensitivity_db?: number;
}
export interface MeasurementResult {
    success: boolean;
    uuid?: string;
    name?: string;
    duration_ms?: number;
    error?: string;
}
export interface ApiMeasureWorkflowResult {
    action: string;
    success: boolean;
    message: string;
    status?: WorkflowStatus;
    devices?: {
        input_devices: string[];
        output_devices: string[];
        recommended_input?: string;
        recommended_output?: string;
    };
    levels?: {
        input_level_db?: number;
        output_level_dbfs?: number;
        estimated_spl_db?: number;
        clipping: boolean;
        too_low: boolean;
        recommendation?: string;
    };
    measurements?: MeasurementResult[];
    warnings?: string[];
}
/**
 * Execute workflow tool
 */
export declare function executeApiMeasureWorkflow(input: ApiMeasureWorkflowInput): Promise<ToolResponse<ApiMeasureWorkflowResult>>;
//# sourceMappingURL=api-measure-workflow.d.ts.map