/**
 * Unit tests for sequence state machine
 *
 * Tests L/R/Sub measurement sequence enforcement, transitions, and guidance.
 * Target: 80%+ line coverage of sequence-state-machine.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  getNextStep,
  getStepGuidance,
  channelToStep,
  type SequenceStep,
} from './sequence-state-machine.js';

describe('sequence-state-machine', () => {
  describe('validateTransition', () => {
    describe('Valid transitions', () => {
      it('should allow idle -> measuring_left', () => {
        expect(() => validateTransition('idle', 'measuring_left')).not.toThrow();
      });

      it('should allow measuring_left -> measuring_right', () => {
        expect(() => validateTransition('measuring_left', 'measuring_right')).not.toThrow();
      });

      it('should allow measuring_right -> measuring_sub', () => {
        expect(() => validateTransition('measuring_right', 'measuring_sub')).not.toThrow();
      });

      it('should allow measuring_sub -> complete', () => {
        expect(() => validateTransition('measuring_sub', 'complete')).not.toThrow();
      });
    });

    describe('Invalid transitions', () => {
      it('should reject idle -> measuring_right (must start with left)', () => {
        expect(() => validateTransition('idle', 'measuring_right')).toThrow();
      });

      it('should reject idle -> measuring_sub (must start with left)', () => {
        expect(() => validateTransition('idle', 'measuring_sub')).toThrow();
      });

      it('should reject idle -> complete (must measure first)', () => {
        expect(() => validateTransition('idle', 'complete')).toThrow();
      });

      it('should reject measuring_left -> measuring_sub (skipping right)', () => {
        expect(() => validateTransition('measuring_left', 'measuring_sub')).toThrow();
      });

      it('should reject measuring_left -> complete (skipping right and sub)', () => {
        expect(() => validateTransition('measuring_left', 'complete')).toThrow();
      });

      it('should reject measuring_right -> measuring_left (backward)', () => {
        expect(() => validateTransition('measuring_right', 'measuring_left')).toThrow();
      });

      it('should reject measuring_right -> complete (skipping sub)', () => {
        expect(() => validateTransition('measuring_right', 'complete')).toThrow();
      });

      it('should reject complete -> measuring_left (sequence finished)', () => {
        expect(() => validateTransition('complete', 'measuring_left')).toThrow();
      });

      it('should reject complete -> measuring_right (sequence finished)', () => {
        expect(() => validateTransition('complete', 'measuring_right')).toThrow();
      });

      it('should reject complete -> measuring_sub (sequence finished)', () => {
        expect(() => validateTransition('complete', 'measuring_sub')).toThrow();
      });
    });

    describe('Error messages', () => {
      it('should include from step in error message', () => {
        expect(() => validateTransition('idle', 'measuring_right')).toThrow(/idle/);
      });

      it('should include to step in error message', () => {
        expect(() => validateTransition('idle', 'measuring_right')).toThrow(/measuring_right/);
      });

      it('should include expected next step in error message', () => {
        expect(() => validateTransition('idle', 'measuring_right')).toThrow(/measuring_left/);
      });

      it('should indicate no transitions allowed when complete', () => {
        expect(() => validateTransition('complete', 'measuring_left')).toThrow(/none.*sequence complete/i);
      });
    });
  });

  describe('getNextStep', () => {
    it('should return measuring_left for idle', () => {
      const next = getNextStep('idle');
      expect(next).toBe('measuring_left');
    });

    it('should return measuring_right for measuring_left', () => {
      const next = getNextStep('measuring_left');
      expect(next).toBe('measuring_right');
    });

    it('should return measuring_sub for measuring_right', () => {
      const next = getNextStep('measuring_right');
      expect(next).toBe('measuring_sub');
    });

    it('should return complete for measuring_sub', () => {
      const next = getNextStep('measuring_sub');
      expect(next).toBe('complete');
    });

    it('should return null for complete (sequence finished)', () => {
      const next = getNextStep('complete');
      expect(next).toBeNull();
    });
  });

  describe('getStepGuidance', () => {
    it('should return non-empty string for idle', () => {
      const guidance = getStepGuidance('idle');
      expect(guidance).toBeTruthy();
      expect(typeof guidance).toBe('string');
    });

    it('should mention measuring left for idle step', () => {
      const guidance = getStepGuidance('idle');
      expect(guidance.toLowerCase()).toMatch(/left/);
    });

    it('should return guidance for measuring_left', () => {
      const guidance = getStepGuidance('measuring_left');
      expect(guidance).toBeTruthy();
      expect(guidance.toLowerCase()).toMatch(/right/);
    });

    it('should return guidance for measuring_right', () => {
      const guidance = getStepGuidance('measuring_right');
      expect(guidance).toBeTruthy();
      expect(guidance.toLowerCase()).toMatch(/sub/);
    });

    it('should return guidance for measuring_sub', () => {
      const guidance = getStepGuidance('measuring_sub');
      expect(guidance).toBeTruthy();
      expect(guidance.toLowerCase()).toMatch(/complete/);
    });

    it('should return guidance for complete', () => {
      const guidance = getStepGuidance('complete');
      expect(guidance).toBeTruthy();
      expect(guidance.toLowerCase()).toMatch(/stop_session/);
    });

    it('should provide different guidance for each step', () => {
      const steps: SequenceStep[] = ['idle', 'measuring_left', 'measuring_right', 'measuring_sub', 'complete'];
      const guidances = steps.map(step => getStepGuidance(step));

      // All guidance should be unique
      const uniqueGuidances = new Set(guidances);
      expect(uniqueGuidances.size).toBe(steps.length);
    });
  });

  describe('channelToStep', () => {
    it('should map left to measuring_left', () => {
      const step = channelToStep('left');
      expect(step).toBe('measuring_left');
    });

    it('should map right to measuring_right', () => {
      const step = channelToStep('right');
      expect(step).toBe('measuring_right');
    });

    it('should map sub to measuring_sub', () => {
      const step = channelToStep('sub');
      expect(step).toBe('measuring_sub');
    });
  });

  describe('Full workflow validation', () => {
    it('should enforce complete L->R->Sub sequence', () => {
      let currentStep: SequenceStep = 'idle';

      // Step 1: Left
      const leftStep = channelToStep('left');
      expect(() => validateTransition(currentStep, leftStep)).not.toThrow();
      currentStep = leftStep;

      // Step 2: Right
      const rightStep = channelToStep('right');
      expect(() => validateTransition(currentStep, rightStep)).not.toThrow();
      currentStep = rightStep;

      // Step 3: Sub
      const subStep = channelToStep('sub');
      expect(() => validateTransition(currentStep, subStep)).not.toThrow();
      currentStep = subStep;

      // Step 4: Complete
      expect(() => validateTransition(currentStep, 'complete')).not.toThrow();
      currentStep = 'complete';

      // No further transitions
      expect(getNextStep(currentStep)).toBeNull();
    });

    it('should provide guidance at each step of workflow', () => {
      const steps: SequenceStep[] = [
        'idle',
        'measuring_left',
        'measuring_right',
        'measuring_sub',
        'complete'
      ];

      steps.forEach(step => {
        const guidance = getStepGuidance(step);
        expect(guidance).toBeTruthy();
        expect(guidance.length).toBeGreaterThan(0);
      });
    });
  });
});
