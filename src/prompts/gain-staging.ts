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
export const GAIN_STAGING_PROMPT = {
  name: 'rew_gain_staging',
  title: 'Gain Staging Only',
  description: 'Calibrate monitor levels to target SPL using pink noise and SPL meter',
  arguments: [
    {
      name: 'target_spl_db',
      description: 'Target SPL (default: 85 dB)',
      required: false,
    },
  ],
};

/**
 * Generate goal-oriented messages for gain staging workflow
 *
 * @param args - Optional arguments from prompt invocation
 * @returns Array of prompt messages
 */
export function getGainStagingMessages(
  args?: Record<string, string>
): PromptMessage[] {
  const targetSpl = args?.target_spl_db ? parseInt(args.target_spl_db, 10) : 85;

  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Gain Staging Workflow

## OBJECTIVE

Calibrate my monitor output to ${targetSpl} dB SPL using pink noise and the SPL meter.

This is a standalone workflow - no measurement session required.

## CONTEXT

Target SPL: ${targetSpl} dB (broadcast reference: 85 dB for mixing, 79 dB for extended sessions)

The SPL calibration tool uses a start/check/stop pattern:
- Start generates pink noise
- Check reads current SPL
- Stop ends the calibration

## WORKFLOW GUIDANCE

### When to PAUSE (require my input)
- Before playing pink noise (confirm I'm ready, speakers on)
- When I need to adjust monitor volume (physical knob turn)
- After each adjustment to confirm ready for next reading

### Autonomous Operation
Between checkpoints:
- Start pink noise playback
- Take SPL readings
- Calculate adjustment needed
- Guide me with specific dB adjustments

### Calibration Process
1. Have me position mic at listening position (ear height)
2. Start pink noise at -20 dBFS
3. Read SPL, calculate difference from target
4. Guide me: "Turn up/down by approximately X dB"
5. Read again, iterate until within 1 dB of target
6. Confirm final level, stop calibration

## ERROR HANDLING

If calibration fails:
- Check REW connection (is REW running with API enabled?)
- Check that signal generator is available
- Ensure SPL meter is reading (mic connected, input selected)

## START

Begin by checking REW connection and confirming:
- I have monitors powered on at nominal level
- Mic is positioned at listening position
- I'm ready to hear pink noise`,
      },
    },
  ];
}
