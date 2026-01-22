/**
 * Unit tests for session resource handler
 *
 * Tests readSessionResource and listSessionResources functions
 * for correct data return and -32002 error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readSessionResource, listSessionResources } from './session-resource.js';
import {
  createSession,
  updateSession,
  clearAllSessions,
} from '../session/index.js';

describe('session-resource', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('readSessionResource', () => {
    it('returns session state for valid session ID', () => {
      const session = createSession('Test session');
      const result = readSessionResource(session.session_id);

      expect(result.session_id).toBe(session.session_id);
      expect(result.sequence_step).toBe('idle');
      expect(result.created_at).toBe(session.created_at);
    });

    it('returns measurements array in simplified format', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          {
            uuid: 'test-uuid-1',
            name: 'Left Speaker',
            channel: 'left',
            timestamp: Date.now(),
          },
          {
            name: 'Right Speaker',
            channel: 'right',
            timestamp: Date.now(),
          },
        ],
      });

      const result = readSessionResource(session.session_id);

      expect(result.measurements).toHaveLength(2);
      expect(result.measurements[0].uuid).toBe('test-uuid-1');
      expect(result.measurements[0].name).toBe('Left Speaker');
      expect(result.measurements[0].channel).toBe('left');
      expect(result.measurements[1].uuid).toBeUndefined();
      expect(result.measurements[1].channel).toBe('right');
    });

    it('includes optional fields when present', () => {
      const session = createSession('Session notes');
      updateSession(session.session_id, { target_spl: 85 });

      const result = readSessionResource(session.session_id);

      expect(result.notes).toBe('Session notes');
      expect(result.target_spl).toBe(85);
    });

    it('throws -32002 error for invalid session ID', () => {
      const invalidId = '00000000-0000-0000-0000-000000000000';
      try {
        readSessionResource(invalidId);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
        expect((error as Error).message).toContain('not found');
        expect((error as Error).message).toContain(invalidId);
      }
    });

    it('throws -32002 error for empty session ID', () => {
      try {
        readSessionResource('');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
      }
    });
  });

  describe('listSessionResources', () => {
    it('returns empty array when no sessions', () => {
      const resources = listSessionResources();

      expect(resources).toEqual([]);
    });

    it('returns resource objects for active sessions', () => {
      createSession('Session 1');
      createSession('Session 2');

      const resources = listSessionResources();

      expect(resources).toHaveLength(2);
      expect(resources[0].uri).toMatch(/^session:\/\//);
      expect(resources[0].mimeType).toBe('application/json');
    });

    it('includes session metadata in resource descriptors', () => {
      const session = createSession('Test notes');
      updateSession(session.session_id, { sequence_step: 'measuring_left' });

      const resources = listSessionResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe(`session://${session.session_id}`);
      expect(resources[0].name).toBe(`Session ${session.session_id.substring(0, 8)}`);
      expect(resources[0].description).toContain('measuring_left');
    });

    it('returns resources in consistent format', () => {
      createSession('Session 1');

      const resources = listSessionResources();

      expect(resources[0]).toHaveProperty('uri');
      expect(resources[0]).toHaveProperty('name');
      expect(resources[0]).toHaveProperty('description');
      expect(resources[0]).toHaveProperty('mimeType');
    });
  });
});
