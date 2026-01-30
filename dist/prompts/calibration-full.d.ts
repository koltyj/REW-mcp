/**
 * Full Calibration Workflow Prompt
 *
 * Master prompt for complete studio calibration workflow covering
 * gain staging, L/R/Sub measurement, room analysis, and optimization guidance.
 */
import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
/**
 * Prompt definition for MCP ListPrompts
 */
export declare const CALIBRATION_FULL_PROMPT: {
    name: string;
    title: string;
    description: string;
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
};
/**
 * Generate goal-oriented messages for full calibration workflow
 *
 * @param args - Optional arguments from prompt invocation
 * @returns Array of prompt messages
 */
export declare function getCalibrationFullMessages(args?: Record<string, string>): PromptMessage[];
//# sourceMappingURL=calibration-full.d.ts.map