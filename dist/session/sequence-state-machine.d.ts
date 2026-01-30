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
export type SequenceStep = 'idle' | 'measuring_left' | 'measuring_right' | 'measuring_sub' | 'complete';
/**
 * Valid state transitions for the measurement sequence.
 * Each step can only transition to specific next steps.
 */
export declare const validTransitions: Record<SequenceStep, SequenceStep[]>;
/**
 * Validates if a state transition is allowed.
 *
 * @param from - Current state
 * @param to - Desired next state
 * @throws Error if transition is invalid
 */
export declare function validateTransition(from: SequenceStep, to: SequenceStep): void;
/**
 * Gets the next expected step in the sequence.
 *
 * @param current - Current sequence step
 * @returns Next step, or null if sequence is complete
 */
export declare function getNextStep(current: SequenceStep): SequenceStep | null;
/**
 * Gets user-friendly guidance for the current step.
 *
 * @param step - Current sequence step
 * @returns Guidance message for user
 */
export declare function getStepGuidance(step: SequenceStep): string;
/**
 * Maps channel name to corresponding sequence step.
 * Helper for transition validation when recording measurements.
 *
 * @param channel - Channel being measured
 * @returns Corresponding sequence step
 */
export declare function channelToStep(channel: 'left' | 'right' | 'sub'): SequenceStep;
//# sourceMappingURL=sequence-state-machine.d.ts.map