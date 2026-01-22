/**
 * Unit tests for api-measurement-session tool handler
 *
 * Tests all action branches (start_session, measure, get_status, stop_session) and error paths.
 * Uses vi.mock for getActiveApiClient.
 * Target: 80%+ line coverage of api-measurement-session.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApiMeasurementSession } from './api-measurement-session.js';
import { REWApiError } from '../api/rew-api-error.js';
import { clearAllSessions } from '../session/index.js';

// Mock getActiveApiClient
vi.mock('./api-connect.js', () => ({
  getActiveApiClient: vi.fn()
}));

import { getActiveApiClient } from './api-connect.js';
const mockGetActiveApiClient = vi.mocked(getActiveApiClient);

describe('executeApiMeasurementSession', () => {
  // Mock REW client
  const mockClient = {
    setMeasureNotes: vi.fn(),
    setBlockingMode: vi.fn(),
    listMeasurements: vi.fn(),
    executeMeasureCommand: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSessions();
  });

  describe('Connection handling', () => {
    it('should return connection_error when not connected (measure action)', async () => {
      mockGetActiveApiClient.mockReturnValue(null);

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.status === 'success' ? session.data?.session_id : '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_error');
      expect(result.message).toContain('Not connected to REW API');
      expect(result.suggestion).toContain('rew.api_connect');
    });
  });

  describe('start_session action', () => {
    it('should create session and return session_id', async () => {
      const result = await executeApiMeasurementSession({ action: 'start_session' });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('start_session');
      expect(result.data?.session_id).toBeTruthy();
      expect(result.data?.sequence_step).toBe('idle');
    });

    it('should return guidance for next step', async () => {
      const result = await executeApiMeasurementSession({ action: 'start_session' });

      expect(result.status).toBe('success');
      expect(result.data?.guidance).toBeTruthy();
      expect(result.data?.guidance).toContain('Left');
    });

    it('should initialize with empty measurements', async () => {
      const result = await executeApiMeasurementSession({ action: 'start_session' });

      expect(result.status).toBe('success');
      expect(result.data?.measurements).toEqual([]);
    });

    it('should store notes when provided', async () => {
      const result = await executeApiMeasurementSession({
        action: 'start_session',
        notes: 'Test session notes'
      });

      expect(result.status).toBe('success');
      expect(result.data?.session_id).toBeTruthy();
    });

    it('should reject if session_id is provided', async () => {
      const result = await executeApiMeasurementSession({
        action: 'start_session',
        session_id: '00000000-0000-0000-0000-000000000000'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Cannot provide session_id');
      expect(result.suggestion).toContain('Omit session_id');
    });
  });

  describe('measure action', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
    });

    it('should require session_id', async () => {
      const result = await executeApiMeasurementSession({
        action: 'measure',
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('session_id required');
      expect(result.suggestion).toContain('start_session');
    });

    it('should require channel', async () => {
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('channel required');
      expect(result.suggestion).toContain('left, right, or sub');
    });

    it('should return session_error when session not found', async () => {
      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: '00000000-0000-0000-0000-000000000001',
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('session_error');
      expect(result.message).toContain('Session not found');
      expect(result.suggestion).toContain('get_status');
    });

    it('should validate sequence transitions', async () => {
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      // Try to measure right before left (invalid)
      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'right'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('sequence_error');
      expect(result.message).toContain('Invalid measurement sequence');
      expect(result.suggestion).toContain('measuring_left');
    });

    it('should set measurement name before measuring', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(mockClient.setMeasureNotes).toHaveBeenCalled();
      const measurementName = mockClient.setMeasureNotes.mock.calls[0][0];
      expect(measurementName).toContain('left');
    });

    it('should enable blocking mode', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(mockClient.setBlockingMode).toHaveBeenCalledWith(true);
    });

    it('should execute Measure command', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(mockClient.executeMeasureCommand).toHaveBeenCalledWith('Measure');
    });

    it('should update session state on success', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'existing-uuid' }
      ]).mockResolvedValueOnce([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('success');
      expect(result.data?.sequence_step).toBe('measuring_left');
      expect(result.data?.measurements).toHaveLength(1);
    });

    it('should return measurement details and guidance', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'new-uuid' }
      ]).mockResolvedValueOnce([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('Measurement complete');
      expect(result.data?.guidance).toBeTruthy();
      expect(result.data?.next_step).toBe('measuring_right');
    });

    it('should return license_error on 403 status', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 403
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('license_error');
      expect(result.message).toContain('REW Pro license required');
      expect(result.suggestion).toContain('roomeqwizard.com');
    });

    it('should set sequence_step to complete after subwoofer measurement', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'uuid-1' }
      ]).mockResolvedValueOnce([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      // Start session
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      // Measure left
      await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      // Measure right
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'uuid-2' }
      ]).mockResolvedValueOnce([{ uuid: 'uuid-1' }]);

      await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'right'
      });

      // Measure sub
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'uuid-3' }
      ]).mockResolvedValueOnce([{ uuid: 'uuid-1' }, { uuid: 'uuid-2' }]);

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'sub'
      });

      expect(result.status).toBe('success');
      expect(result.data?.sequence_step).toBe('complete');
      expect(result.data?.next_step).toBeNull();
    });

    it('should return api_error when setMeasureNotes fails', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(false);

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to set measurement notes');
    });

    it('should return api_error when setBlockingMode fails', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(false);

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Failed to set blocking mode');
    });

    it('should return api_error when measurement fails', async () => {
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: false,
        status: 500,
        message: 'Internal error'
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('api_error');
      expect(result.message).toContain('Internal error');
    });
  });

  describe('get_status action', () => {
    it('should return session details when session_id provided', async () => {
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'get_status',
        session_id: sessionId
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('get_status');
      expect(result.data?.session_id).toBe(sessionId);
      expect(result.data?.sequence_step).toBe('idle');
      expect(result.data?.guidance).toBeTruthy();
      expect(result.data?.session).toBeTruthy();
    });

    it('should list all active sessions when no session_id provided', async () => {
      // Create multiple sessions
      await executeApiMeasurementSession({ action: 'start_session' });
      await executeApiMeasurementSession({ action: 'start_session' });

      const result = await executeApiMeasurementSession({
        action: 'get_status'
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('get_status');
      expect(result.data?.active_sessions).toHaveLength(2);
    });

    it('should return session_error when session not found', async () => {
      const result = await executeApiMeasurementSession({
        action: 'get_status',
        session_id: '00000000-0000-0000-0000-000000000002'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('session_error');
      expect(result.message).toContain('Session not found');
      expect(result.suggestion).toContain('get_status without session_id');
    });

    it('should include next_step in status', async () => {
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'get_status',
        session_id: sessionId
      });

      expect(result.status).toBe('success');
      expect(result.data?.next_step).toBe('measuring_left');
    });
  });

  describe('stop_session action', () => {
    it('should require session_id', async () => {
      const result = await executeApiMeasurementSession({
        action: 'stop_session'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('session_id required');
      expect(result.suggestion).toContain('Provide session_id');
    });

    it('should end session and return summary', async () => {
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'stop_session',
        session_id: sessionId
      });

      expect(result.status).toBe('success');
      expect(result.data?.action).toBe('stop_session');
      expect(result.data?.message).toContain('Session stopped');
      expect(result.data?.measurements).toEqual([]);
    });

    it('should return session_error when session not found', async () => {
      const result = await executeApiMeasurementSession({
        action: 'stop_session',
        session_id: '00000000-0000-0000-0000-000000000003'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('session_error');
      expect(result.message).toContain('Session not found');
      expect(result.suggestion).toContain('get_status');
    });

    it('should include measurement count in summary', async () => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.listMeasurements.mockResolvedValue([
        { uuid: 'uuid-1' }
      ]).mockResolvedValueOnce([]);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      // Take one measurement
      await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      const result = await executeApiMeasurementSession({
        action: 'stop_session',
        session_id: sessionId
      });

      expect(result.status).toBe('success');
      expect(result.data?.message).toContain('1');
      expect(result.data?.measurements).toHaveLength(1);
    });

    it('should remove session from active sessions', async () => {
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      await executeApiMeasurementSession({
        action: 'stop_session',
        session_id: sessionId
      });

      // Verify session no longer exists
      const statusResult = await executeApiMeasurementSession({
        action: 'get_status',
        session_id: sessionId
      });

      expect(statusResult.status).toBe('error');
      expect(statusResult.error_type).toBe('session_error');
    });
  });

  describe('Error handling', () => {
    it('should handle validation_error for invalid action', async () => {
      const result = await executeApiMeasurementSession({
        action: 'invalid_action' as any
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('validation_error');
      expect(result.message).toContain('Invalid input');
    });

    it('should handle REWApiError', async () => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.setMeasureNotes.mockRejectedValue(
        new REWApiError('Connection refused', 'CONNECTION_REFUSED', 0)
      );

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('connection_refused');
      expect(result.suggestion).toContain('REW is running with API enabled');
    });

    it('should handle unknown errors', async () => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.setMeasureNotes.mockRejectedValue(
        new Error('Unexpected error')
      );

      const session = await executeApiMeasurementSession({ action: 'start_session' });
      const sessionId = session.data?.session_id || '';

      const result = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });

      expect(result.status).toBe('error');
      expect(result.error_type).toBe('internal_error');
      expect(result.message).toBe('Unexpected error');
    });
  });

  describe('Full workflow', () => {
    beforeEach(() => {
      mockGetActiveApiClient.mockReturnValue(mockClient as any);
      mockClient.setMeasureNotes.mockResolvedValue(true);
      mockClient.setBlockingMode.mockResolvedValue(true);
      mockClient.executeMeasureCommand.mockResolvedValue({
        success: true,
        status: 200
      });
    });

    it('should execute complete L/R/Sub workflow', async () => {
      // Start session
      const session = await executeApiMeasurementSession({ action: 'start_session' });
      expect(session.status).toBe('success');
      const sessionId = session.data?.session_id || '';

      // Measure left
      mockClient.listMeasurements
        .mockResolvedValueOnce([])  // before measurement
        .mockResolvedValueOnce([{ uuid: 'left-uuid' }]);  // after measurement

      const leftResult = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'left'
      });
      expect(leftResult.status).toBe('success');
      expect(leftResult.data?.sequence_step).toBe('measuring_left');
      expect(leftResult.data?.next_step).toBe('measuring_right');
      expect(leftResult.data?.measurements).toHaveLength(1);

      // Measure right
      mockClient.listMeasurements
        .mockResolvedValueOnce([{ uuid: 'left-uuid' }])  // before measurement
        .mockResolvedValueOnce([{ uuid: 'left-uuid' }, { uuid: 'right-uuid' }]);  // after measurement

      const rightResult = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'right'
      });
      expect(rightResult.status).toBe('success');
      expect(rightResult.data?.sequence_step).toBe('measuring_right');
      expect(rightResult.data?.next_step).toBe('measuring_sub');
      expect(rightResult.data?.measurements).toHaveLength(2);

      // Measure sub
      mockClient.listMeasurements
        .mockResolvedValueOnce([{ uuid: 'left-uuid' }, { uuid: 'right-uuid' }])  // before measurement
        .mockResolvedValueOnce([
          { uuid: 'left-uuid' },
          { uuid: 'right-uuid' },
          { uuid: 'sub-uuid' }
        ]);  // after measurement

      const subResult = await executeApiMeasurementSession({
        action: 'measure',
        session_id: sessionId,
        channel: 'sub'
      });
      expect(subResult.status).toBe('success');
      expect(subResult.data?.sequence_step).toBe('complete');
      expect(subResult.data?.next_step).toBeNull();
      expect(subResult.data?.measurements).toHaveLength(3);

      // Stop session
      const stopResult = await executeApiMeasurementSession({
        action: 'stop_session',
        session_id: sessionId
      });
      expect(stopResult.status).toBe('success');
      expect(stopResult.data?.measurements).toHaveLength(3);
    });
  });
});
