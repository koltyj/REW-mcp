/**
 * Gain Staging Prompt
 *
 * Standalone prompt for calibrating monitor levels to target SPL
 * using pink noise and SPL meter.
 */
import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
/**
 * Prompt definition for MCP ListPrompts
 */
export declare const GAIN_STAGING_PROMPT: {
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
 * Generate goal-oriented messages for gain staging workflow
 *
 * @param args - Optional arguments from prompt invocation
 * @returns Array of prompt messages
 */
export declare function getGainStagingMessages(args?: Record<string, string>): PromptMessage[];
//# sourceMappingURL=gain-staging.d.ts.map