/**
 * Tool: rew.api_check_levels
 *
 * Check REW input levels for mic gain calibration.
 * Provides zone-based feedback (Clipping, Hot, Optimal, Low, Very Low) and guidance.
 */
import { z } from 'zod';
import type { ToolResponse } from '../types/index.js';
export declare const ApiCheckLevelsInputSchema: z.ZodObject<{
    target_rms: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    target_rms?: number | undefined;
}, {
    target_rms?: number | undefined;
}>;
export type ApiCheckLevelsInput = z.infer<typeof ApiCheckLevelsInputSchema>;
type LevelZone = 'CLIPPING' | 'HOT' | 'OPTIMAL' | 'LOW' | 'VERY_LOW';
export interface ApiCheckLevelsResult {
    zone: LevelZone;
    should_block_measurement: boolean;
    levels: {
        rms_db: number;
        peak_db: number;
        channel_count: number;
        rms_per_channel?: number[];
        peak_per_channel?: number[];
    };
    feedback: {
        status: string;
        recommendation: string;
        warning?: string;
    };
}
/**
 * Execute API check levels tool
 */
export declare function executeApiCheckLevels(input: ApiCheckLevelsInput): Promise<ToolResponse<ApiCheckLevelsResult>>;
export {};
//# sourceMappingURL=api-check-levels.d.ts.map