/**
 * Unit tests for measurement resource handler
 *
 * Tests readMeasurementResource and listMeasurementResources functions
 * for correct data return and -32002 error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readMeasurementResource, listMeasurementResources } from './measurement-resource.js';
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

describe('measurement-resource', () => {
  beforeEach(() => {
    measurementStore.clear();
  });

  describe('readMeasurementResource', () => {
    it('returns measurement data for valid ID', () => {
      const mockMeasurement = createMockMeasurement();
      measurementStore.store(mockMeasurement);

      const result = readMeasurementResource('test_measurement');

      expect(result.id).toBe('test_measurement');
      expect(result.metadata.speaker_id).toBe('L');
      expect(result.metadata.condition).toBe('baseline');
    });

    it('returns full frequency response arrays', () => {
      const mockMeasurement = createMockMeasurement();
      measurementStore.store(mockMeasurement);

      const result = readMeasurementResource('test_measurement');

      expect(result.frequency_response.frequencies_hz).toHaveLength(6);
      expect(result.frequency_response.spl_db).toHaveLength(6);
      expect(result.frequency_response.phase_degrees).toHaveLength(6);
      expect(result.frequency_response.frequencies_hz[0]).toBe(20);
      expect(result.frequency_response.spl_db[0]).toBe(70);
    });

    it('includes timestamp', () => {
      const mockMeasurement = createMockMeasurement();
      measurementStore.store(mockMeasurement);

      const result = readMeasurementResource('test_measurement');

      expect(result.timestamp).toBe(mockMeasurement.timestamp);
    });

    it('includes optional metadata fields when present', () => {
      const mockMeasurement = createMockMeasurement({
        metadata: {
          speaker_id: 'R',
          condition: 'post_treatment',
          mic_position_id: 'pos_1',
          notes: 'After adding bass trap',
        },
      });
      measurementStore.store(mockMeasurement);

      const result = readMeasurementResource('test_measurement');

      expect(result.metadata.mic_position_id).toBe('pos_1');
      expect(result.metadata.notes).toBe('After adding bass trap');
    });

    it('throws -32002 error for invalid ID', () => {
      try {
        readMeasurementResource('nonexistent');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
        expect((error as Error).message).toContain('not found');
        expect((error as Error).message).toContain('nonexistent');
      }
    });

    it('throws -32002 error for empty ID', () => {
      try {
        readMeasurementResource('');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: number }).code).toBe(-32002);
      }
    });
  });

  describe('listMeasurementResources', () => {
    it('returns empty array when no measurements', () => {
      const resources = listMeasurementResources();

      expect(resources).toEqual([]);
    });

    it('returns resource objects for stored measurements', () => {
      const measurement1 = createMockMeasurement({ id: 'measurement_1' });
      const measurement2 = createMockMeasurement({ id: 'measurement_2' });
      measurementStore.store(measurement1);
      measurementStore.store(measurement2);

      const resources = listMeasurementResources();

      expect(resources).toHaveLength(2);
      expect(resources[0].uri).toMatch(/^measurement:\/\//);
      expect(resources[0].mimeType).toBe('application/json');
    });

    it('includes measurement metadata in resource descriptors', () => {
      const measurement = createMockMeasurement({
        id: 'left_baseline',
        metadata: {
          speaker_id: 'L',
          condition: 'baseline',
        },
      });
      measurementStore.store(measurement);

      const resources = listMeasurementResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('measurement://left_baseline');
      expect(resources[0].name).toBe('Measurement left_baseline');
      expect(resources[0].description).toContain('L');
      expect(resources[0].description).toContain('baseline');
    });

    it('returns resources in consistent format', () => {
      measurementStore.store(createMockMeasurement());

      const resources = listMeasurementResources();

      expect(resources[0]).toHaveProperty('uri');
      expect(resources[0]).toHaveProperty('name');
      expect(resources[0]).toHaveProperty('description');
      expect(resources[0]).toHaveProperty('mimeType');
    });
  });
});
