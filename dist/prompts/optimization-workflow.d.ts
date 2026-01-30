/**
 * Optimization Workflow Prompt
 *
 * Session-aware prompt for iterative room optimization
 * with measurement validation.
 */
import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
/**
 * Prompt definition for MCP ListPrompts
 */
export declare const OPTIMIZATION_WORKFLOW_PROMPT: {
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
 * Generate session-aware messages for optimization workflow
 *
 * @param args - Arguments from prompt invocation (requires session_id)
 * @returns Array of prompt messages with embedded session resource
 * @throws Error if session_id is missing, session not found, or no measurements
 */
export declare function getOptimizationWorkflowMessages(args?: Record<string, string>): PromptMessage[];
//# sourceMappingURL=optimization-workflow.d.ts.map