/**
 * Tool: rew.analyze_room
 *
 * Unified room analysis combining all interpretation modules with prioritized recommendations.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
import { type PeaksNullsData } from '../interpretation/peaks-nulls-interpret.js';
import { type RoomModesData } from '../interpretation/room-modes-interpret.js';
import { type SubIntegrationData } from '../interpretation/sub-integration-interpret.js';
import { type LRSymmetryData } from '../interpretation/lr-symmetry.js';
import { type GLMComparisonResult } from '../interpretation/glm-comparison.js';
export declare const AnalyzeRoomInputSchema: z.ZodObject<{
    measurement_id: z.ZodString;
    pre_measurement_id: z.ZodOptional<z.ZodString>;
    left_measurement_id: z.ZodOptional<z.ZodString>;
    right_measurement_id: z.ZodOptional<z.ZodString>;
    sub_measurement_id: z.ZodOptional<z.ZodString>;
    room_dimensions: z.ZodOptional<z.ZodObject<{
        length: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        length: number;
        width: number;
        height: number;
    }, {
        length: number;
        width: number;
        height: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    measurement_id: string;
    pre_measurement_id?: string | undefined;
    left_measurement_id?: string | undefined;
    right_measurement_id?: string | undefined;
    sub_measurement_id?: string | undefined;
    room_dimensions?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
}, {
    measurement_id: string;
    pre_measurement_id?: string | undefined;
    left_measurement_id?: string | undefined;
    right_measurement_id?: string | undefined;
    sub_measurement_id?: string | undefined;
    room_dimensions?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
}>;
export type AnalyzeRoomInput = z.infer<typeof AnalyzeRoomInputSchema>;
export interface AnalyzeRoomResult {
    overall_summary: string;
    overall_severity: 'significant' | 'moderate' | 'minor' | 'negligible';
    top_recommendations: Array<{
        priority: number;
        action: string;
        expected_impact: string;
        fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
        category: string;
        priority_score: number;
    }>;
    analysis_sections: {
        peaks_nulls?: {
            summary: string;
            data: PeaksNullsData;
            severity: string;
            confidence: string;
        };
        room_modes?: {
            summary: string;
            data: RoomModesData;
            severity: string;
            confidence: string;
        };
        sub_integration?: {
            summary: string;
            data: SubIntegrationData;
            severity: string;
            confidence: string;
        };
        lr_symmetry?: {
            summary: string;
            data: LRSymmetryData;
            severity: string;
            confidence: string;
        };
        glm_comparison?: {
            summary: string;
            data: GLMComparisonResult;
            confidence: 'high' | 'medium' | 'low';
        };
    };
}
/**
 * Execute unified room analysis tool
 */
export declare function executeAnalyzeRoom(input: AnalyzeRoomInput): Promise<ToolResponse<AnalyzeRoomResult>>;
//# sourceMappingURL=analyze-room.d.ts.map