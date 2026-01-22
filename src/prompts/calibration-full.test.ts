/**
 * Unit tests for full calibration prompt
 *
 * Tests CALIBRATION_FULL_PROMPT definition and getCalibrationFullMessages function
 * for correct structure, arguments, and goal-oriented content.
 */

import { describe, it, expect } from 'vitest';
import { CALIBRATION_FULL_PROMPT, getCalibrationFullMessages } from './calibration-full.js';

describe('calibration-full prompt', () => {
  describe('CALIBRATION_FULL_PROMPT', () => {
    it('has correct name', () => {
      expect(CALIBRATION_FULL_PROMPT.name).toBe('rew_calibration_full');
    });

    it('has title and description', () => {
      expect(CALIBRATION_FULL_PROMPT.title).toBe('Full Calibration Workflow');
      expect(CALIBRATION_FULL_PROMPT.description).toBeDefined();
      expect(CALIBRATION_FULL_PROMPT.description.length).toBeGreaterThan(20);
    });

    it('has target_spl_db argument (optional)', () => {
      const splArg = CALIBRATION_FULL_PROMPT.arguments?.find(
        (a) => a.name === 'target_spl_db'
      );
      expect(splArg).toBeDefined();
      expect(splArg?.required).toBe(false);
    });

    it('has room_dimensions argument (optional)', () => {
      const dimArg = CALIBRATION_FULL_PROMPT.arguments?.find(
        (a) => a.name === 'room_dimensions'
      );
      expect(dimArg).toBeDefined();
      expect(dimArg?.required).toBe(false);
    });

    it('is standalone (no required session_id)', () => {
      const sessionArg = CALIBRATION_FULL_PROMPT.arguments?.find(
        (a) => a.name === 'session_id' && a.required === true
      );
      expect(sessionArg).toBeUndefined();
    });
  });

  describe('getCalibrationFullMessages', () => {
    it('returns messages with default SPL (85 dB)', () => {
      const result = getCalibrationFullMessages({});

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content.text).toContain('85');
    });

    it('uses provided target_spl_db', () => {
      const result = getCalibrationFullMessages({ target_spl_db: '79' });

      expect(result[0].content.text).toContain('79');
      expect(result[0].content.text).toContain('79 dB');
    });

    it('includes room dimensions when provided', () => {
      const result = getCalibrationFullMessages({ room_dimensions: '12x10x8' });

      expect(result[0].content.text).toContain('12x10x8');
      expect(result[0].content.text).toContain('Room dimensions provided');
    });

    it('prompts for room dimensions when not provided', () => {
      const result = getCalibrationFullMessages({});

      expect(result[0].content.text).toContain('Room dimensions not provided');
    });

    it('returns user role message', () => {
      const result = getCalibrationFullMessages({});

      expect(result[0].role).toBe('user');
      expect(result[0].content.type).toBe('text');
    });

    it('includes goal-oriented content (not prescriptive)', () => {
      const result = getCalibrationFullMessages({});
      const text = result[0].content.text;

      // Should describe goals/objectives
      expect(text.toLowerCase()).toMatch(/objective|goal|calibrat/i);

      // Should NOT prescribe exact tool sequences
      expect(text).not.toMatch(/step 1.*call.*step 2.*call/i);
    });

    it('includes checkpoint guidance', () => {
      const result = getCalibrationFullMessages({});
      const text = result[0].content.text;

      // Should mention when to pause
      expect(text).toContain('PAUSE');
      expect(text).toContain('Autonomous');
    });

    it('mentions session management', () => {
      const result = getCalibrationFullMessages({});
      const text = result[0].content.text;

      expect(text).toContain('session');
    });

    it('mentions scientific method', () => {
      const result = getCalibrationFullMessages({});
      const text = result[0].content.text;

      expect(text).toMatch(/one.*time|ONE.*recommendation/i);
    });
  });
});
