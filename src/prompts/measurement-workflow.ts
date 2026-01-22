/**
 * Measurement Workflow Prompt
 *
 * Session-aware prompt for guided L/R/Sub measurement sequence
 * with session state tracking.
 */

import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { getSession } from '../session/index.js';

/**
 * Prompt definition for MCP ListPrompts
 */
export const MEASUREMENT_WORKFLOW_PROMPT = {
  name: 'rew_measurement_workflow',
  title: 'Measurement Sequence',
  description: 'Guided L/R/Sub measurement with session state tracking',
  arguments: [
    {
      name: 'session_id',
      description: 'Active session ID',
      required: true,
    },
  ],
};

/**
 * Generate session-aware messages for measurement workflow
 *
 * @param args - Arguments from prompt invocation (requires session_id)
 * @returns Array of prompt messages with embedded session resource
 * @throws Error if session_id is missing or session not found
 */
export function getMeasurementWorkflowMessages(
  args?: Record<string, string>
): PromptMessage[] {
  if (!args?.session_id) {
    throw new Error('session_id is required for measurement workflow prompt');
  }

  // Validate session exists and get current state
  const session = getSession(args.session_id);

  // Build session state summary for embedded resource
  const sessionSummary = {
    session_id: session.session_id,
    sequence_step: session.sequence_step,
    measurements_completed: session.measurements.length,
    measurements: session.measurements.map(m => ({
      channel: m.channel,
      name: m.name,
      timestamp: new Date(m.timestamp).toISOString(),
    })),
    target_spl: session.target_spl,
    notes: session.notes,
  };

  const completedChannels = session.measurements.map(m => m.channel);
  const remainingSteps = [];
  if (!completedChannels.includes('left')) remainingSteps.push('Left Speaker');
  if (!completedChannels.includes('right')) remainingSteps.push('Right Speaker');
  if (!completedChannels.includes('sub')) remainingSteps.push('Subwoofer');

  const progressContext = remainingSteps.length > 0
    ? `Remaining measurements: ${remainingSteps.join(', ')}`
    : 'All measurements complete';

  return [
    {
      role: 'assistant',
      content: {
        type: 'resource',
        resource: {
          uri: `session://${session.session_id}`,
          mimeType: 'application/json',
          text: JSON.stringify(sessionSummary, null, 2),
        },
      },
    },
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Measurement Sequence Workflow

## OBJECTIVE

Complete the L/R/Sub frequency response measurement sequence for session ${session.session_id.substring(0, 8)}.

${progressContext}

## CONTEXT

Current session state is embedded above. Use measurement session tool to:
- Check current sequence step
- Execute measurements
- Track progress

## MEASUREMENT SEQUENCE

Standard order: Left Speaker -> Right Speaker -> Subwoofer

For each measurement:
1. Confirm speaker selection with me (which speaker to measure)
2. Confirm mic position (at listening position, pointing at speaker)
3. Execute measurement via session tool (measure action)
4. Verify measurement captured (check session state)

## WORKFLOW GUIDANCE

### When to PAUSE (require my input)
- Before each measurement (confirm speaker, mic position)
- If measurement fails (troubleshoot together)
- After all measurements (review results, next steps)

### Autonomous Operation
Between checkpoints:
- Execute measurements when I confirm ready
- Check session state after each measurement
- Move to next step in sequence automatically

### Measurement Naming
Measurements are auto-named based on session ID and channel:
- Left: "{session_id_prefix} L"
- Right: "{session_id_prefix} R"
- Sub: "{session_id_prefix} Sub"

## ERROR HANDLING

If measurement fails:
- Check REW connection and microphone selection
- Verify signal is reaching mic (check input levels)
- Retry measurement for that channel
- Don't skip - each channel is needed for analysis

## START

Review the embedded session state, then confirm with me which measurement to take next.`,
      },
    },
  ];
}
