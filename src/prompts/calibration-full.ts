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
export const CALIBRATION_FULL_PROMPT = {
  name: 'rew_calibration_full',
  title: 'Full Calibration Workflow',
  description: 'Complete studio calibration: gain staging, L/R/Sub measurement, room analysis, optimization guidance',
  arguments: [
    {
      name: 'target_spl_db',
      description: 'Target SPL for monitor calibration (default: 85 dB)',
      required: false,
    },
    {
      name: 'room_dimensions',
      description: 'Room dimensions in feet "LxWxH" (e.g., "12x10x8")',
      required: false,
    },
  ],
};

/**
 * Generate goal-oriented messages for full calibration workflow
 *
 * @param args - Optional arguments from prompt invocation
 * @returns Array of prompt messages
 */
export function getCalibrationFullMessages(
  args?: Record<string, string>
): PromptMessage[] {
  const targetSpl = args?.target_spl_db ? parseInt(args.target_spl_db, 10) : 85;
  const roomDimensions = args?.room_dimensions || null;

  const dimensionsContext = roomDimensions
    ? `Room dimensions provided: ${roomDimensions} (use for room mode analysis)`
    : 'Room dimensions not provided (ask user if needed for room mode analysis)';

  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Full Studio Calibration Workflow

## OBJECTIVES

Help me calibrate my studio monitors through a complete workflow:
1. **Gain Staging**: Set monitor output to ${targetSpl} dB SPL using pink noise
2. **Measurement**: Take L/R/Sub frequency response measurements
3. **Analysis**: Analyze room acoustics (modes, SBIR, symmetry)
4. **Optimization**: Guide placement adjustments with measurement validation

## CONTEXT

${dimensionsContext}

Target SPL: ${targetSpl} dB (broadcast reference standard)

## WORKFLOW GUIDANCE

### When to PAUSE (require my input)
- Before playing audio (confirm I'm ready, speakers on)
- When adjusting monitor volume (I need to physically turn knob)
- Before each measurement (confirm mic position, speaker selection)
- When suggesting speaker/listener position changes (I need to physically move things)
- When making decisions (treatment recommendations, next steps)

### Autonomous Operation
Between checkpoints, work autonomously:
- Execute measurements when I confirm ready
- Analyze results and correlate findings
- Generate recommendations based on data
- Track progress through session state

### Session Management
- Use the measurement session tool to track workflow state
- Create session at start, update after each measurement
- Access session state via session:// resources for context
- Access recommendations via recommendations:// for tracking

### Scientific Method
- Make ONE recommendation at a time
- After I make an adjustment, take a new measurement
- Validate whether adjustment improved the issue
- Only move to next recommendation after validation

## ERROR HANDLING

If something fails:
- Check REW connection (is REW running with API enabled?)
- Check microphone selection in REW
- Retry with troubleshooting guidance
- Don't get stuck - suggest alternatives

## START

Begin by checking REW connection status and confirming I have:
- REW running with API enabled (port 4735)
- Calibrated measurement microphone connected
- Monitors powered on at nominal level

Then proceed to gain staging.`,
      },
    },
  ];
}
