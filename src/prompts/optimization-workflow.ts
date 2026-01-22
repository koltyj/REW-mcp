/**
 * Optimization Workflow Prompt
 *
 * Session-aware prompt for iterative room optimization
 * with measurement validation.
 */

import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { getSession } from '../session/index.js';

/**
 * Prompt definition for MCP ListPrompts
 */
export const OPTIMIZATION_WORKFLOW_PROMPT = {
  name: 'rew_optimization_workflow',
  title: 'Room Optimization',
  description: 'Iterative placement optimization with measurement validation',
  arguments: [
    {
      name: 'session_id',
      description: 'Session with completed measurements',
      required: true,
    },
  ],
};

/**
 * Generate session-aware messages for optimization workflow
 *
 * @param args - Arguments from prompt invocation (requires session_id)
 * @returns Array of prompt messages with embedded session resource
 * @throws Error if session_id is missing, session not found, or no measurements
 */
export function getOptimizationWorkflowMessages(
  args?: Record<string, string>
): PromptMessage[] {
  if (!args?.session_id) {
    throw new Error('session_id is required for optimization workflow prompt');
  }

  // Validate session exists and has measurements
  const session = getSession(args.session_id);

  if (session.measurements.length === 0) {
    throw new Error(
      `Session ${args.session_id} has no measurements. Complete measurement workflow first.`
    );
  }

  // Build session state summary for embedded resource
  const sessionSummary = {
    session_id: session.session_id,
    sequence_step: session.sequence_step,
    measurements: session.measurements.map(m => ({
      channel: m.channel,
      name: m.name,
      uuid: m.uuid,
      timestamp: new Date(m.timestamp).toISOString(),
    })),
    target_spl: session.target_spl,
    notes: session.notes,
  };

  const measurementsList = session.measurements
    .map(m => `- ${m.channel}: ${m.name}`)
    .join('\n');

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
        text: `# Room Optimization Workflow

## OBJECTIVE

Analyze room acoustics and guide iterative optimization for session ${session.session_id.substring(0, 8)}.

Available measurements:
${measurementsList}

## CONTEXT

Current session state is embedded above. Use analysis and optimization tools to:
- Analyze room acoustics (modes, SBIR, symmetry)
- Get recommendations (one at a time)
- Validate adjustments with new measurements

## OPTIMIZATION PROCESS

### Analysis Phase
1. Run unified room analysis on measurements
2. Review identified issues (SBIR, modes, symmetry)
3. Check severity and recommended fixes

### Optimization Loop (Scientific Method)
For each recommendation:
1. Get ONE recommendation from optimize_room tool
2. Explain the recommendation to me (what, why, expected improvement)
3. PAUSE - I make the physical adjustment
4. Take a new measurement to validate
5. Use validate_adjustment to assess improvement
6. If improved: check_progress, then next recommendation
7. If not improved: suggest alternative or try opposite direction

### Stop Conditions
- Smoothness reaches "good" rating
- User satisfied with results
- Diminishing returns (small improvements only)

## WORKFLOW GUIDANCE

### When to PAUSE (require my input)
- Before any physical adjustment (speaker/listener position)
- When deciding whether to continue optimization
- If recommendation requires treatment (may want to skip)
- After significant improvement (celebrate, decide next steps)

### Autonomous Operation
Between checkpoints:
- Analyze measurements and correlate findings
- Generate recommendations with confidence levels
- Validate improvements after I confirm adjustment made
- Track overall progress

### Recommendation Types
- **Placement**: Move speakers/listener (free, high impact)
- **Settings**: Phase, crossover, EQ (free, medium impact)
- **Treatment**: Absorption, bass traps (cost, variable impact)

Prioritize placement and settings before treatment.

## ERROR HANDLING

If analysis fails:
- Check measurement data is valid (frequency response present)
- Ensure measurements are from this session
- Retry analysis with troubleshooting

If recommendation doesn't improve:
- Try opposite direction (e.g., move closer instead of further)
- Consider if room constraints limit options
- Move to next recommendation

## START

Analyze the session measurements and present a summary of room acoustic issues, then proceed to first recommendation.`,
      },
    },
  ];
}
