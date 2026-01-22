/**
 * Unit tests for recommendations resource handler
 *
 * Tests readRecommendationsResource function for correct data return
 * and -32002 error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readRecommendationsResource } from './recommendations-resource.js';
import { createSession, clearAllSessions } from '../session/index.js';

describe('recommendations-resource', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('readRecommendationsResource', () => {
    it('returns recommendations structure for valid session', () => {
      const session = createSession('Test session');
      const result = readRecommendationsResource(session.session_id);

      expect(result.session_id).toBe(session.session_id);
      expect(result.current_recommendation).toBeNull();
      expect(result.tried_recommendations).toEqual([]);
      expect(result.validation_status).toBeNull();
    });

    it('returns placeholder structure (full tracking out of scope)', () => {
      const session = createSession();
      const result = readRecommendationsResource(session.session_id);

      // Verify placeholder structure matches expected format
      expect(result).toHaveProperty('session_id');
      expect(result).toHaveProperty('current_recommendation');
      expect(result).toHaveProperty('tried_recommendations');
      expect(result).toHaveProperty('validation_status');

      // All tracking fields should be null/empty (placeholder)
      expect(result.current_recommendation).toBeNull();
      expect(result.tried_recommendations).toEqual([]);
    });

    it('throws -32002 error for invalid session ID', () => {
      const invalidId = '00000000-0000-0000-0000-000000000000';
      try {
        readRecommendationsResource(invalidId);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
        expect((error as Error).message).toContain('not found');
        expect((error as Error).message).toContain(invalidId);
      }
    });

    it('throws -32002 error for empty session ID', () => {
      try {
        readRecommendationsResource('');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
      }
    });

    it('throws -32002 error for malformed session ID', () => {
      try {
        readRecommendationsResource('not-a-valid-uuid');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
      }
    });
  });
});
