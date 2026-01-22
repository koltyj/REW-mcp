/**
 * Prompt Registration
 *
 * Registers all MCP prompts for calibration workflows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  CALIBRATION_FULL_PROMPT,
  getCalibrationFullMessages,
} from './calibration-full.js';
import {
  GAIN_STAGING_PROMPT,
  getGainStagingMessages,
} from './gain-staging.js';
import {
  MEASUREMENT_WORKFLOW_PROMPT,
  getMeasurementWorkflowMessages,
} from './measurement-workflow.js';
import {
  OPTIMIZATION_WORKFLOW_PROMPT,
  getOptimizationWorkflowMessages,
} from './optimization-workflow.js';

/**
 * All registered prompt definitions
 */
const ALL_PROMPTS = [
  CALIBRATION_FULL_PROMPT,
  GAIN_STAGING_PROMPT,
  MEASUREMENT_WORKFLOW_PROMPT,
  OPTIMIZATION_WORKFLOW_PROMPT,
];

/**
 * Register all prompts with the MCP server
 */
export function registerPrompts(server: Server): void {
  // List prompts handler - returns all available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: ALL_PROMPTS,
    };
  });

  // Get prompt handler - returns messages for a specific prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'rew_calibration_full': {
        const messages = getCalibrationFullMessages(args);
        return {
          description: CALIBRATION_FULL_PROMPT.description,
          messages,
        };
      }

      case 'rew_gain_staging': {
        const messages = getGainStagingMessages(args);
        return {
          description: GAIN_STAGING_PROMPT.description,
          messages,
        };
      }

      case 'rew_measurement_workflow': {
        const messages = getMeasurementWorkflowMessages(args);
        return {
          description: MEASUREMENT_WORKFLOW_PROMPT.description,
          messages,
        };
      }

      case 'rew_optimization_workflow': {
        const messages = getOptimizationWorkflowMessages(args);
        return {
          description: OPTIMIZATION_WORKFLOW_PROMPT.description,
          messages,
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });
}
