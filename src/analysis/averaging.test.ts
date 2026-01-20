/**
 * Averaging Analysis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  rmsAverage,
  dbAverage,
  vectorAverage,
  alignSPL,
  averageMeasurements
} from './averaging.js';
import type { FrequencyResponseData } from '../types/index.js';

// Helper to create test frequency response data
function createTestFR(
  frequencies: number[],
  splValues: number[],
  phaseValues?: number[]
): FrequencyResponseData {
  return {
    frequencies_hz: frequencies,
    spl_db: splValues,
    phase_degrees: phaseValues || frequencies.map(() => 0)
  };
}

describe('Averaging Analysis', () => {
  describe('rmsAverage', () => {
    it('should return identical result for single measurement', () => {
      const fr = createTestFR([100, 200, 400], [70, 72, 68]);
      const result = rmsAverage([fr]);
      
      expect(result.frequencies_hz).toEqual(fr.frequencies_hz);
      expect(result.spl_db).toEqual(fr.spl_db);
    });

    it('should average two identical measurements to same values', () => {
      const fr = createTestFR([100, 200, 400], [70, 72, 68]);
      const result = rmsAverage([fr, fr]);
      
      expect(result.frequencies_hz).toEqual(fr.frequencies_hz);
      // RMS of identical values should be the same value
      expect(result.spl_db[0]).toBeCloseTo(70, 1);
      expect(result.spl_db[1]).toBeCloseTo(72, 1);
      expect(result.spl_db[2]).toBeCloseTo(68, 1);
    });

    it('should properly RMS average different levels', () => {
      const fr1 = createTestFR([100], [70]);
      const fr2 = createTestFR([100], [80]);
      const result = rmsAverage([fr1, fr2]);
      
      // RMS average of 70 dB and 80 dB:
      // Power1 = 10^7, Power2 = 10^8
      // Avg power = (10^7 + 10^8) / 2 = 5.5 * 10^7
      // Result = 10 * log10(5.5 * 10^7) ≈ 77.4 dB
      expect(result.spl_db[0]).toBeGreaterThan(75);
      expect(result.spl_db[0]).toBeLessThan(80);
    });

    it('should handle empty array', () => {
      const result = rmsAverage([]);
      expect(result.frequencies_hz).toEqual([]);
      expect(result.spl_db).toEqual([]);
    });

    it('should use common frequency range', () => {
      const fr1 = createTestFR([100, 200, 400, 800], [70, 72, 68, 66]);
      const fr2 = createTestFR([200, 400, 800, 1600], [71, 69, 67, 65]);
      const result = rmsAverage([fr1, fr2]);
      
      // Should only include 200, 400, 800 Hz
      expect(result.frequencies_hz).toEqual([200, 400, 800]);
    });

    it('should apply weights correctly', () => {
      const fr1 = createTestFR([100], [70]);
      const fr2 = createTestFR([100], [80]);
      
      // Weight fr2 more heavily
      const result = rmsAverage([fr1, fr2], [0.2, 0.8]);
      
      // Should be closer to 80 dB
      expect(result.spl_db[0]).toBeGreaterThan(76);
    });
  });

  describe('dbAverage', () => {
    it('should compute simple arithmetic average in dB', () => {
      const fr1 = createTestFR([100], [70]);
      const fr2 = createTestFR([100], [80]);
      const result = dbAverage([fr1, fr2]);
      
      // Simple average: (70 + 80) / 2 = 75
      expect(result.spl_db[0]).toBeCloseTo(75, 1);
    });
  });

  describe('vectorAverage', () => {
    it('should handle in-phase signals', () => {
      const fr1 = createTestFR([100], [70], [0]);
      const fr2 = createTestFR([100], [70], [0]);
      const result = vectorAverage([fr1, fr2]);
      
      // Same phase, same level -> same level
      expect(result.spl_db[0]).toBeCloseTo(70, 1);
      expect(result.phase_degrees[0]).toBeCloseTo(0, 1);
    });

    it('should show cancellation for opposite phase signals', () => {
      const fr1 = createTestFR([100], [70], [0]);
      const fr2 = createTestFR([100], [70], [180]);
      const result = vectorAverage([fr1, fr2]);
      
      // Opposite phase -> cancellation (very low level)
      expect(result.spl_db[0]).toBeLessThan(50); // Significant reduction
    });

    it('should handle 90 degree phase difference', () => {
      const fr1 = createTestFR([100], [70], [0]);
      const fr2 = createTestFR([100], [70], [90]);
      const result = vectorAverage([fr1, fr2]);
      
      // 90° phase: magnitude should be sqrt(2)/2 * original
      // Level should drop by ~3 dB
      expect(result.spl_db[0]).toBeLessThan(70);
      expect(result.spl_db[0]).toBeGreaterThan(65);
    });
  });

  describe('alignSPL', () => {
    it('should align measurements to common level', () => {
      const fr1 = createTestFR([200, 400, 800], [70, 72, 68]); // avg ~70
      const fr2 = createTestFR([200, 400, 800], [80, 82, 78]); // avg ~80
      
      const { aligned, offsets_db } = alignSPL([fr1, fr2], [200, 800]);
      
      // Offsets should be roughly +5 and -5 (to align to ~75 avg)
      expect(offsets_db[0]).toBeCloseTo(5, 1);
      expect(offsets_db[1]).toBeCloseTo(-5, 1);
      
      // Aligned measurements should have similar average levels
      const avg1 = (aligned[0].spl_db[0] + aligned[0].spl_db[1] + aligned[0].spl_db[2]) / 3;
      const avg2 = (aligned[1].spl_db[0] + aligned[1].spl_db[1] + aligned[1].spl_db[2]) / 3;
      expect(avg1).toBeCloseTo(avg2, 1);
    });

    it('should handle empty array', () => {
      const { aligned, offsets_db } = alignSPL([]);
      expect(aligned).toEqual([]);
      expect(offsets_db).toEqual([]);
    });
  });

  describe('averageMeasurements', () => {
    it('should apply SPL alignment when requested', () => {
      const fr1 = createTestFR([100, 200, 400], [70, 72, 68]);
      const fr2 = createTestFR([100, 200, 400], [80, 82, 78]);
      
      const result = averageMeasurements([fr1, fr2], {
        method: 'rms',
        align_spl: true,
        alignment_frequency_range: [100, 400]
      });
      
      expect(result.spl_alignment_applied).toBe(true);
      expect(result.alignment_offsets_db.length).toBe(2);
    });

    it('should not apply alignment when not requested', () => {
      const fr1 = createTestFR([100, 200, 400], [70, 72, 68]);
      const fr2 = createTestFR([100, 200, 400], [80, 82, 78]);
      
      const result = averageMeasurements([fr1, fr2], {
        method: 'rms',
        align_spl: false
      });
      
      expect(result.spl_alignment_applied).toBe(false);
    });

    it('should report warnings for large SPL differences', () => {
      const fr1 = createTestFR([100, 200, 400], [70, 72, 68]);
      const fr2 = createTestFR([100, 200, 400], [86, 88, 84]); // >15 dB difference -> >7.5 dB offset
      
      const result = averageMeasurements([fr1, fr2], {
        method: 'rms',
        align_spl: true
      });
      
      expect(result.warnings.some(w => w.includes('Large SPL differences'))).toBe(true);
    });

    it('should warn when measurements have different frequency ranges', () => {
      const fr1 = createTestFR([20, 40, 80, 160], [70, 72, 68, 66]);
      const fr2 = createTestFR([100, 200, 400, 800], [71, 73, 69, 67]);
      
      const result = averageMeasurements([fr1, fr2], {
        method: 'rms'
      });
      
      expect(result.warnings.some(w => w.includes('different frequency ranges'))).toBe(true);
    });

    it('should use all averaging methods correctly', () => {
      const fr1 = createTestFR([100, 200], [70, 72], [0, 10]);
      const fr2 = createTestFR([100, 200], [72, 74], [20, 30]);
      
      const methods = ['rms', 'db', 'vector', 'rms_phase', 'db_phase'] as const;
      
      for (const method of methods) {
        const result = averageMeasurements([fr1, fr2], { method });
        expect(result.method_used).toBe(method);
        expect(result.averaged_frequency_response.frequencies_hz.length).toBeGreaterThan(0);
      }
    });
  });
});
