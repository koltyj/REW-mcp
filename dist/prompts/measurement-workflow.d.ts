/**
 * Measurement Workflow Prompt
 *
 * Session-aware prompt for guided L/R/Sub measurement sequence
 * with session state tracking.
 */
import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
/**
 * Prompt definition for MCP ListPrompts
 */
export declare const MEASUREMENT_WORKFLOW_PROMPT: {
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
 * Generate session-aware messages for measurement workflow
 *
 * @param args - Arguments from prompt invocation (requires session_id)
 * @returns Array of prompt messages with embedded session resource
 * @throws Error if session_id is missing or session not found
 */
export declare function getMeasurementWorkflowMessages(args?: Record<string, string>): PromptMessage[];
//# sourceMappingURL=measurement-workflow.d.ts.map