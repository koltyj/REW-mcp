/**
 * Unit tests for gain staging prompt
 *
 * Tests GAIN_STAGING_PROMPT definition and getGainStagingMessages function
 * for correct structure, arguments, and goal-oriented content.
 */

import { describe, it, expect } from 'vitest';
import { GAIN_STAGING_PROMPT, getGainStagingMessages } from './gain-staging.js';

describe('gain-staging prompt', () => {
  describe('GAIN_STAGING_PROMPT', () => {
    it('has correct name', () => {
      expect(GAIN_STAGING_PROMPT.name).toBe('rew_gain_staging');
    });

    it('has title and description', () => {
      expect(GAIN_STAGING_PROMPT.title).toBe('Gain Staging Only');
      expect(GAIN_STAGING_PROMPT.description).toBeDefined();
      expect(GAIN_STAGING_PROMPT.description).toContain('SPL');
    });

    it('has target_spl_db argument (optional)', () => {
      const splArg = GAIN_STAGING_PROMPT.arguments?.find(
        (a) => a.name === 'target_spl_db'
      );
      expect(splArg).toBeDefined();
      expect(splArg?.required).toBe(false);
    });

    it('is standalone (no session_id required)', () => {
      const hasSessionArg = GAIN_STAGING_PROMPT.arguments?.some(
        (a) => a.name === 'session_id' && a.required
      );
      expect(hasSessionArg).toBeFalsy();
    });
  });

  describe('getGainStagingMessages', () => {
    it('returns messages with default SPL (85 dB)', () => {
      const result = getGainStagingMessages({});

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content.text).toContain('85');
    });

    it('uses provided target_spl_db', () => {
      const result = getGainStagingMessages({ target_spl_db: '79' });

      expect(result[0].content.text).toContain('79');
    });

    it('returns goal-oriented messages', () => {
      const result = getGainStagingMessages({});
      const text = result[0].content.text;

      // Should contain SPL/level/volume terminology
      expect(text.toLowerCase()).toMatch(/spl|level|volume|calibrat/i);
    });

    it('returns user role message', () => {
      const result = getGainStagingMessages({});

      expect(result[0].role).toBe('user');
      expect(result[0].content.type).toBe('text');
    });

    it('mentions this is standalone workflow', () => {
      const result = getGainStagingMessages({});
      const text = result[0].content.text;

      expect(text).toContain('standalone');
    });

    it('mentions pink noise', () => {
      const result = getGainStagingMessages({});
      const text = result[0].content.text;

      expect(text.toLowerCase()).toContain('pink noise');
    });

    it('mentions start/check/stop pattern', () => {
      const result = getGainStagingMessages({});
      const text = result[0].content.text;

      expect(text).toContain('start');
      expect(text).toContain('check');
      expect(text).toContain('stop');
    });

    it('includes checkpoint guidance', () => {
      const result = getGainStagingMessages({});
      const text = result[0].content.text;

      expect(text).toContain('PAUSE');
      expect(text).toContain('Autonomous');
    });
  });
});
