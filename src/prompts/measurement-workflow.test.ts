/**
 * Unit tests for measurement workflow prompt
 *
 * Tests MEASUREMENT_WORKFLOW_PROMPT definition and getMeasurementWorkflowMessages
 * function for session awareness, embedded resources, and goal-oriented content.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MEASUREMENT_WORKFLOW_PROMPT,
  getMeasurementWorkflowMessages,
} from './measurement-workflow.js';
import { createSession, updateSession, clearAllSessions } from '../session/index.js';

describe('measurement-workflow prompt', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('MEASUREMENT_WORKFLOW_PROMPT', () => {
    it('has correct name', () => {
      expect(MEASUREMENT_WORKFLOW_PROMPT.name).toBe('rew_measurement_workflow');
    });

    it('has title and description', () => {
      expect(MEASUREMENT_WORKFLOW_PROMPT.title).toBe('Measurement Sequence');
      expect(MEASUREMENT_WORKFLOW_PROMPT.description).toBeDefined();
    });

    it('requires session_id argument', () => {
      const sessionArg = MEASUREMENT_WORKFLOW_PROMPT.arguments?.find(
        (a) => a.name === 'session_id'
      );
      expect(sessionArg).toBeDefined();
      expect(sessionArg?.required).toBe(true);
    });
  });

  describe('getMeasurementWorkflowMessages', () => {
    it('throws when session_id is missing', () => {
      expect(() => getMeasurementWorkflowMessages({})).toThrow();
      expect(() => getMeasurementWorkflowMessages()).toThrow();
    });

    it('throws for invalid session_id', () => {
      expect(() =>
        getMeasurementWorkflowMessages({ session_id: 'invalid-session' })
      ).toThrow();
    });

    it('returns messages for valid session', () => {
      const session = createSession();
      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      expect(messages.length).toBeGreaterThanOrEqual(1);
    });

    it('includes embedded session resource', () => {
      const session = createSession();
      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      // Find the resource message
      const resourceMsg = messages.find(
        (m) => m.content?.type === 'resource'
      );
      expect(resourceMsg).toBeDefined();
      expect(resourceMsg?.role).toBe('assistant');
      expect(resourceMsg?.content.resource.uri).toMatch(/^session:\/\//);
      expect(resourceMsg?.content.resource.mimeType).toBe('application/json');
    });

    it('includes session state in embedded resource', () => {
      const session = createSession();
      updateSession(session.session_id, {
        sequence_step: 'measuring_left',
        measurements: [
          { name: 'Left', channel: 'left', timestamp: Date.now() },
        ],
      });

      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      const resourceMsg = messages.find(
        (m) => m.content?.type === 'resource'
      );
      const resourceData = JSON.parse(resourceMsg?.content.resource.text);

      expect(resourceData.sequence_step).toBe('measuring_left');
      expect(resourceData.measurements_completed).toBe(1);
    });

    it('includes user message with workflow guidance', () => {
      const session = createSession();
      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg?.content.type).toBe('text');
      expect(userMsg?.content.text).toContain('Measurement');
    });

    it('shows remaining measurements', () => {
      const session = createSession();
      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      // Should mention remaining measurements (Left, Right, Sub for new session)
      expect(userMsg?.content.text).toMatch(
        /Remaining|Left|Right|Sub/i
      );
    });

    it('shows all complete when measurements done', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'L', channel: 'left', timestamp: Date.now() },
          { name: 'R', channel: 'right', timestamp: Date.now() },
          { name: 'Sub', channel: 'sub', timestamp: Date.now() },
        ],
      });

      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg?.content.text).toContain('complete');
    });

    it('includes checkpoint guidance', () => {
      const session = createSession();
      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg?.content.text).toContain('PAUSE');
      expect(userMsg?.content.text).toContain('Autonomous');
    });

    it('includes measurement sequence order', () => {
      const session = createSession();
      const messages = getMeasurementWorkflowMessages({
        session_id: session.session_id,
      });

      const userMsg = messages.find((m) => m.role === 'user');
      // Should mention L/R/Sub order
      expect(userMsg?.content.text).toMatch(/Left.*Right.*Sub/i);
    });
  });
});
