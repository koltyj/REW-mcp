/**
 * Tool: rew.analyze_decay
 *
 * Analyzes decay characteristics from impulse response.
 */
import { z } from 'zod';
import type { ToolResponse, ProblematicDecay, ConfidenceLevel } from '../types/index.js';
export declare const DecayInputSchema: z.ZodObject<{
    measurement_id: z.ZodString;
    frequency_range_hz: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    decay_threshold_seconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    frequency_range_hz: [number, number];
    measurement_id: string;
    decay_threshold_seconds: number;
}, {
    measurement_id: string;
    frequency_range_hz?: [number, number] | undefined;
    decay_threshold_seconds?: number | undefined;
}>;
export type DecayInput = z.infer<typeof DecayInputSchema>;
export interface DecayResult {
    measurement_id: string;
    analysis_type: 'decay_analysis';
    analysis_confidence: ConfidenceLevel;
    frequency_range_analyzed_hz: [number, number];
    decay_data: {
        source: 'impulse_response' | 'waterfall' | 'computed';
        mode: string;
    };
    problematic_frequencies: ProblematicDecay[];
    acceptable_frequencies: Array<{
        frequency_hz: number;
        t60_seconds: number;
        assessment: string;
    }>;
    frequency_band_summary: Array<{
        band: string;
        range_hz: [number, number];
        avg_t60_seconds: number;
        assessment: string;
        target_t60_seconds: number;
    }>;
    overall_assessment: {
        quality: 'good' | 'acceptable' | 'needs_improvement' | 'poor';
        primary_issue_hz?: number;
        dominant_problem?: string;
        average_bass_t60_seconds: number;
    };
    recommendations: Array<{
        priority: number;
        target_frequency_hz: number;
        action: string;
        type: string;
        expected_improvement: string;
        confidence: ConfidenceLevel;
        note?: string;
    }>;
}
/**
 * Execute decay analysis tool
 */
export declare function executeDecay(input: DecayInput): Promise<ToolResponse<DecayResult>>;
//# sourceMappingURL=decay.d.ts.map