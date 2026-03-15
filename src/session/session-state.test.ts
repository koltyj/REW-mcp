/**
 * Unit tests for session state management
 *
 * Tests session CRUD operations, concurrent sessions, and error handling.
 * Target: 80%+ line coverage of session-state.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  updateSession,
  listActiveSessions,
  endSession,
  clearAllSessions,
  type SessionState,
} from './session-state.js';

describe('session-state', () => {
  beforeEach(() => {
    // Clear all sessions between tests
    clearAllSessions();
  });

  describe('createSession', () => {
    it('should create session with unique UUID', () => {
      const session1 = createSession();
      const session2 = createSession();

      expect(session1.session_id).toBeTruthy();
      expect(session2.session_id).toBeTruthy();
      expect(session1.session_id).not.toBe(session2.session_id);
    });

    it('should set sequence_step to idle', () => {
      const session = createSession();

      expect(session.sequence_step).toBe('idle');
    });

    it('should set created_at to current timestamp', () => {
      const beforeTime = Date.now();
      const session = createSession();
      const afterTime = Date.now();

      expect(session.created_at).toBeGreaterThanOrEqual(beforeTime);
      expect(session.created_at).toBeLessThanOrEqual(afterTime);
    });

    it('should store notes when provided', () => {
      const session = createSession('Test notes');

      expect(session.notes).toBe('Test notes');
    });

    it('should omit notes when not provided', () => {
      const session = createSession();

      expect(session.notes).toBeUndefined();
    });

    it('should initialize measurements as empty array', () => {
      const session = createSession();

      expect(session.measurements).toEqual([]);
    });

    it('should store session in activeSessions', () => {
      const session = createSession();

      // Verify we can retrieve it
      const retrieved = getSession(session.session_id);
      expect(retrieved).toEqual(session);
    });
  });

  describe('getSession', () => {
    it('should return session when exists', () => {
      const created = createSession('Find me');
      const retrieved = getSession(created.session_id);

      expect(retrieved).toEqual(created);
      expect(retrieved.notes).toBe('Find me');
    });

    it('should throw error when session not found', () => {
      expect(() => getSession('non-existent-id')).toThrow();
    });

    it('should throw error with session ID in message', () => {
      expect(() => getSession('abc-123')).toThrow(/abc-123/);
    });

    it('should throw error with suggestion to use get_status tool', () => {
      expect(() => getSession('missing-id')).toThrow(/get_status/);
    });
  });

  describe('updateSession', () => {
    it('should update existing session fields', () => {
      const session = createSession();
      const updated = updateSession(session.session_id, {
        sequence_step: 'measuring_left',
        notes: 'Updated notes'
      });

      expect(updated.sequence_step).toBe('measuring_left');
      expect(updated.notes).toBe('Updated notes');
    });

    it('should not mutate original session object', () => {
      const session = createSession();
      const originalStep = session.sequence_step;

      updateSession(session.session_id, {
        sequence_step: 'measuring_left'
      });

      // Original reference should not change
      expect(session.sequence_step).toBe(originalStep);
    });

    it('should throw when session not found', () => {
      expect(() => updateSession('missing-id', { notes: 'Test' })).toThrow();
    });

    it('should preserve existing fields with partial updates', () => {
      const session = createSession('Initial notes');
      const updated = updateSession(session.session_id, {
        sequence_step: 'measuring_left'
      });

      expect(updated.notes).toBe('Initial notes');
      expect(updated.sequence_step).toBe('measuring_left');
    });

    it('should preserve session_id', () => {
      const session = createSession();
      const updated = updateSession(session.session_id, {
        session_id: 'should-be-ignored' as any
      });

      expect(updated.session_id).toBe(session.session_id);
    });

    it('should preserve created_at', () => {
      const session = createSession();
      const updated = updateSession(session.session_id, {
        created_at: 999999 as any
      });

      expect(updated.created_at).toBe(session.created_at);
    });

    it('should deep clone measurements array', () => {
      const session = createSession();
      const measurement1 = {
        name: 'Left',
        channel: 'left' as const,
        timestamp: Date.now()
      };

      const updated = updateSession(session.session_id, {
        measurements: [measurement1]
      });

      // Verify measurements were cloned
      expect(updated.measurements).toEqual([measurement1]);
      expect(updated.measurements).not.toBe(session.measurements);
    });

    it('should update measurements when provided', () => {
      const session = createSession();
      const measurement = {
        name: 'Test',
        channel: 'left' as const,
        timestamp: Date.now()
      };

      const updated = updateSession(session.session_id, {
        measurements: [measurement]
      });

      expect(updated.measurements).toHaveLength(1);
      expect(updated.measurements[0]).toEqual(measurement);
    });
  });

  describe('listActiveSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = listActiveSessions();

      expect(sessions).toEqual([]);
    });

    it('should return all active sessions', () => {
      const session1 = createSession('First');
      const session2 = createSession('Second');

      const sessions = listActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions).toContainEqual(session1);
      expect(sessions).toContainEqual(session2);
    });

    it('should sort by created_at descending (most recent first)', async () => {
      // Create sessions with controlled timestamps
      const oldSession = createSession('Old');

      // Wait 2ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));

      const newSession = createSession('New');
      const sessions = listActiveSessions();

      expect(sessions[0].session_id).toBe(newSession.session_id);
      expect(sessions[1].session_id).toBe(oldSession.session_id);
    });
  });

  describe('endSession', () => {
    it('should remove session from activeSessions', () => {
      const session = createSession();

      endSession(session.session_id);

      expect(() => getSession(session.session_id)).toThrow();
    });

    it('should not throw when session does not exist', () => {
      expect(() => endSession('non-existent')).not.toThrow();
    });

    it('should remove only specified session', () => {
      const session1 = createSession('Keep');
      const session2 = createSession('Remove');

      endSession(session2.session_id);

      expect(() => getSession(session1.session_id)).not.toThrow();
      expect(() => getSession(session2.session_id)).toThrow();
    });
  });

  describe('Concurrent sessions', () => {
    it('should create multiple sessions with unique IDs', () => {
      const sessions = Array.from({ length: 5 }, () => createSession());
      const ids = sessions.map(s => s.session_id);

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('should isolate updates between sessions', () => {
      const session1 = createSession('Session 1');
      const session2 = createSession('Session 2');

      updateSession(session1.session_id, {
        sequence_step: 'measuring_left'
      });

      const retrieved1 = getSession(session1.session_id);
      const retrieved2 = getSession(session2.session_id);

      expect(retrieved1.sequence_step).toBe('measuring_left');
      expect(retrieved2.sequence_step).toBe('idle');
    });

    it('should list all concurrent sessions', () => {
      createSession('Session 1');
      createSession('Session 2');
      createSession('Session 3');

      const sessions = listActiveSessions();

      expect(sessions).toHaveLength(3);
    });

    it('should maintain separate measurement arrays', () => {
      const session1 = createSession();
      const session2 = createSession();

      const measurement1 = {
        name: 'Left 1',
        channel: 'left' as const,
        timestamp: Date.now()
      };

      const measurement2 = {
        name: 'Left 2',
        channel: 'left' as const,
        timestamp: Date.now()
      };

      updateSession(session1.session_id, {
        measurements: [measurement1]
      });

      updateSession(session2.session_id, {
        measurements: [measurement2]
      });

      const retrieved1 = getSession(session1.session_id);
      const retrieved2 = getSession(session2.session_id);

      expect(retrieved1.measurements).toHaveLength(1);
      expect(retrieved1.measurements[0].name).toBe('Left 1');
      expect(retrieved2.measurements).toHaveLength(1);
      expect(retrieved2.measurements[0].name).toBe('Left 2');
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions', () => {
      createSession('Session 1');
      createSession('Session 2');

      clearAllSessions();

      const sessions = listActiveSessions();
      expect(sessions).toEqual([]);
    });
  });
});
