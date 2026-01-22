/**
 * Unit tests for history resource handler
 *
 * Tests readHistoryResource function for correct data return
 * and -32002 error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readHistoryResource } from './history-resource.js';
import {
  createSession,
  updateSession,
  clearAllSessions,
} from '../session/index.js';
import { measurementStore } from '../store/measurement.js';
import type { StoredMeasurement } from '../types/index.js';

/**
 * Create a mock stored measurement for testing
 */
function createMockMeasurement(overrides: Partial<StoredMeasurement> = {}): StoredMeasurement {
  return {
    id: 'test_measurement',
    metadata: {
      speaker_id: 'L',
      condition: 'baseline',
    },
    timestamp: new Date().toISOString(),
    frequency_response: {
      frequencies_hz: [20, 50, 100, 200, 500, 1000],
      spl_db: [70, 75, 80, 78, 76, 74],
      phase_degrees: [0, -10, -20, -30, -40, -50],
    },
    quick_stats: {
      bass_avg_db: 75,
      midrange_avg_db: 76,
      treble_avg_db: 74,
      variance_20_200hz_db: 5,
      variance_200_2000hz_db: 3,
      variance_2000_20000hz_db: 2,
    },
    data_quality: {
      confidence: 'high',
      warnings: [],
    },
    parsed_file_metadata: {
      measurement_name: 'Test Measurement',
    },
    ...overrides,
  };
}

describe('history-resource', () => {
  beforeEach(() => {
    clearAllSessions();
    measurementStore.clear();
  });

  describe('readHistoryResource', () => {
    it('returns measurement history for session with no measurements', () => {
      const session = createSession();
      const result = readHistoryResource(session.session_id);

      expect(result.session_id).toBe(session.session_id);
      expect(result.measurements).toEqual([]);
    });

    it('returns measurement history for session with measurements', () => {
      const session = createSession();
      const timestamp = Date.now();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Left Speaker', channel: 'left', timestamp },
          { name: 'Right Speaker', channel: 'right', timestamp: timestamp + 1000 },
        ],
      });

      const result = readHistoryResource(session.session_id);

      expect(result.session_id).toBe(session.session_id);
      expect(result.measurements).toHaveLength(2);
      expect(result.measurements[0].channel).toBe('left');
      expect(result.measurements[0].timestamp).toBe(timestamp);
      expect(result.measurements[1].channel).toBe('right');
    });

    it('includes measurement summary when correlated by name (with uuid present)', () => {
      // Store a measurement in the measurement store with matching name
      const storedMeasurement = createMockMeasurement({
        id: 'some_other_id',
        parsed_file_metadata: { measurement_name: 'Left Speaker' },
      });
      measurementStore.store(storedMeasurement);

      // Create session with measurement that has a uuid but also matching name
      // The correlation checks both id === uuid OR name match
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { uuid: 'different-uuid', name: 'Left Speaker', channel: 'left', timestamp: Date.now() },
        ],
      });

      const result = readHistoryResource(session.session_id);

      expect(result.measurements).toHaveLength(1);
      expect(result.measurements[0].summary).toBeDefined();
      // Should find match via name
      expect(result.measurements[0].summary.variance_40_200hz).toBe(5);
    });

    it('includes measurement summary when correlated by UUID', () => {
      // Store a measurement in the measurement store with specific ID
      const storedMeasurement = createMockMeasurement({
        id: 'uuid-from-rew',
        frequency_response: {
          frequencies_hz: [20, 100, 500],
          spl_db: [70, 82, 75],
          phase_degrees: [0, -20, -40],
        },
      });
      measurementStore.store(storedMeasurement);

      // Create session with measurement that has matching UUID
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { uuid: 'uuid-from-rew', name: 'Test', channel: 'left', timestamp: Date.now() },
        ],
      });

      const result = readHistoryResource(session.session_id);

      expect(result.measurements).toHaveLength(1);
      expect(result.measurements[0].measurement_id).toBe('uuid-from-rew');
      expect(result.measurements[0].summary.peak_spl_db).toBe(82);
      expect(result.measurements[0].summary.frequency_range).toEqual([20, 500]);
    });

    it('returns empty summary when no store correlation found', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Uncorrelated', channel: 'sub', timestamp: Date.now() },
        ],
      });

      const result = readHistoryResource(session.session_id);

      expect(result.measurements).toHaveLength(1);
      expect(result.measurements[0].summary).toEqual({});
    });

    it('throws -32002 error for invalid session ID', () => {
      const invalidId = '00000000-0000-0000-0000-000000000000';
      try {
        readHistoryResource(invalidId);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
        expect((error as Error).message).toContain('not found');
        expect((error as Error).message).toContain(invalidId);
      }
    });

    it('throws -32002 error for empty session ID', () => {
      try {
        readHistoryResource('');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
      }
    });

    it('handles sub channel measurements', () => {
      const session = createSession();
      updateSession(session.session_id, {
        measurements: [
          { name: 'Subwoofer', channel: 'sub', timestamp: Date.now() },
        ],
      });

      const result = readHistoryResource(session.session_id);

      expect(result.measurements[0].channel).toBe('sub');
    });
  });
});
