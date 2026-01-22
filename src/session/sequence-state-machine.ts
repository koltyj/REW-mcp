/**
 * State machine for L/R/Sub measurement sequence enforcement.
 *
 * Ensures measurements are taken in the correct order:
 * idle -> Left -> Right -> Sub -> complete
 *
 * Prevents out-of-order measurements and provides user guidance.
 */

/**
 * Measurement sequence steps.
 */
export type SequenceStep =
  | 'idle'              // Session created, no measurements yet
  | 'measuring_left'    // Left speaker measured
  | 'measuring_right'   // Right speaker measured
  | 'measuring_sub'     // Subwoofer measured
  | 'complete';         // All measurements done

/**
 * Valid state transitions for the measurement sequence.
 * Each step can only transition to specific next steps.
 */
export const validTransitions: Record<SequenceStep, SequenceStep[]> = {
  idle: ['measuring_left'],
  measuring_left: ['measuring_right'],
  measuring_right: ['measuring_sub'],
  measuring_sub: ['complete'],
  complete: [], // No further transitions allowed
};

/**
 * Validates if a state transition is allowed.
 *
 * @param from - Current state
 * @param to - Desired next state
 * @throws Error if transition is invalid
 */
export function validateTransition(from: SequenceStep, to: SequenceStep): void {
  const validNext = validTransitions[from];

  if (!validNext.includes(to)) {
    const expected = validNext.length > 0
      ? validNext.join(' or ')
      : 'none (sequence complete)';

    throw new Error(
      `Invalid measurement sequence: Cannot go from '${from}' to '${to}'. Expected next step: ${expected}`
    );
  }
}

/**
 * Gets the next expected step in the sequence.
 *
 * @param current - Current sequence step
 * @returns Next step, or null if sequence is complete
 */
export function getNextStep(current: SequenceStep): SequenceStep | null {
  const validNext = validTransitions[current];
  return validNext.length > 0 ? validNext[0] : null;
}

/**
 * Gets user-friendly guidance for the current step.
 *
 * @param step - Current sequence step
 * @returns Guidance message for user
 */
export function getStepGuidance(step: SequenceStep): string {
  switch (step) {
    case 'idle':
      return 'Ready to start. Measure Left speaker first.';
    case 'measuring_left':
      return 'Left speaker measured. Measure Right speaker next.';
    case 'measuring_right':
      return 'Left and Right measured. Measure Subwoofer next.';
    case 'measuring_sub':
      return 'All speakers measured. Sequence complete.';
    case 'complete':
      return 'Measurement sequence complete. Use stop_session to end.';
  }
}

/**
 * Maps channel name to corresponding sequence step.
 * Helper for transition validation when recording measurements.
 *
 * @param channel - Channel being measured
 * @returns Corresponding sequence step
 */
export function channelToStep(channel: 'left' | 'right' | 'sub'): SequenceStep {
  switch (channel) {
    case 'left':
      return 'measuring_left';
    case 'right':
      return 'measuring_right';
    case 'sub':
      return 'measuring_sub';
  }
}
