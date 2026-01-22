/**
 * Unit tests for optimization workflow prompt
 *
 * Tests OPTIMIZATION_WORKFLOW_PROMPT definition and getOptimizationWorkflowMessages
 * function for session awareness, embedded resources, and goal-oriented content.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OPTIMIZATION_WORKFLOW_PROMPT,
  getOptimizationWorkflowMessages,
} from './optimization-workflow.js';
import { createSession, updateSession, clearAllSessions } from '../session/index.js';

describe('optimization-workflow prompt', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('OPTIMIZATION_WORKFLOW_PROMPT', () => {
    it('has correct name', () => {
      expect(OPTIMIZATION_WORKFLOW_PROMPT.name).toBe('rew_optimization_workflow');
    });

    it('has title and description', () => {
      expect(OPTIMIZATION_WORKFLOW_PROMPT.title).toBe('Room Optimization');
      expect(OPTIMIZATION_WORKFLOW_PROMPT.description).toBeDefined();
      expect(OPTIMIZATION_WORKFLOW_PROMPT.description).toContain('optimization');
    });

    it('requires session_id argument', () => {
      const sessionArg = OPTIMIZATION_WORKFLOW_PROMPT.arguments?.find(
        (a) => a.name === 'session_id'
      );
      expect(sessionArg).toBeDefined();
      expect(sessionArg?.required).toBe(true);
    });
  });

  describe('getOptimizationWorkflowMessages', () => {
    it('throws when session_id is missing', () => {
      expect(() => getOptimizationWorkflowMessages({})).toThrow();
      expect(() => getOptimizationWorkflowMessages()).toThrow();
    });

    it('throws for invalid session_id', () => {
      expect(() =>
        getOptimizationWorkflowMessages({ session_id: 'invalid-session' })
      ).toThrow();
    });

    it('throws when session has no measurements', () => {
      const session = createSession();
      expect(() =>
        getOptimizationWorkflowMessages({ session_id: session.session_id })
      ).toThrow(/no measurements/i);
    });

    it('returns messages for session with measurements', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Left', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      expect(messages).toHaveLength(2); // assistant resource + user message
    });

    it('includes embedded session resource', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Test', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const resourceMsg = messages.find(
        (m) => m.content?.type === 'resource'
      );
      expect(resourceMsg).toBeDefined();
      expect(resourceMsg?.role).toBe('assistant');
      expect(resourceMsg?.content.resource.uri).toBe(
        `session://${session.session_id}`
      );
    });

    it('includes measurement list in resource', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { uuid: 'uuid-1', name: 'Left', channel: 'left', timestamp: Date.now() },
          { uuid: 'uuid-2', name: 'Right', channel: 'right', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const resourceMsg = messages.find(
        (m) => m.content?.type === 'resource'
      );
      const resourceData = JSON.parse(resourceMsg?.content.resource.text);

      expect(resourceData.measurements).toHaveLength(2);
      expect(resourceData.measurements[0].uuid).toBe('uuid-1');
      expect(resourceData.measurements[0].channel).toBe('left');
    });

    it('returns optimization-focused messages', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Test', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg?.content.text.toLowerCase()).toMatch(
        /optimize|placement|recommendation/i
      );
    });

    it('mentions scientific method (one at a time)', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Test', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg?.content.text).toMatch(/one.*time|ONE.*recommendation/i);
    });

    it('includes checkpoint guidance', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Test', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg?.content.text).toContain('PAUSE');
      expect(userMsg?.content.text).toContain('Autonomous');
    });

    it('lists available measurements', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Left Speaker', channel: 'left', timestamp: Date.now() },
          { name: 'Right Speaker', channel: 'right', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg?.content.text).toContain('Left Speaker');
      expect(userMsg?.content.text).toContain('Right Speaker');
    });

    it('mentions recommendation types', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Test', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getOptimizationWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      // Should mention placement, settings, treatment
      expect(userMsg?.content.text.toLowerCase()).toMatch(/placement|settings|treatment/i);
    });
  });
});
