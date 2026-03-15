/**
 * Target Curve Analysis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  FLAT_CURVE,
  REW_ROOM_CURVE,
  HARMAN_CURVE,
  getBuiltInCurve,
  parseHouseCurve,
  interpolateTargetLevel,
  calculateAlignmentOffset,
  calculateTargetDeviation,
  createCustomCurve
} from './target-curves.js';
import type { FrequencyResponseData } from '../types/index.js';

// Helper to create test frequency response
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

// Create a realistic frequency response
function createRealisticFR(): FrequencyResponseData {
  const frequencies: number[] = [];
  const spl: number[] = [];
  
  for (let f = 20; f <= 20000; f *= Math.pow(2, 1/12)) {
    frequencies.push(Math.round(f));
    // Simulate a slightly tilted response with some variation
    const tilt = (Math.log10(f) - Math.log10(1000)) * -2; // -2 dB/decade tilt
    const variation = Math.sin(Math.log10(f) * 10) * 2;
    spl.push(70 + tilt + variation);
  }
  
  return createTestFR(frequencies, spl);
}

describe('Target Curve Analysis', () => {
  describe('Built-in curves', () => {
    it('FLAT_CURVE should be 0 dB everywhere', () => {
      expect(FLAT_CURVE.name).toBe('Flat');
      expect(FLAT_CURVE.points[0].level_db).toBe(0);
      expect(FLAT_CURVE.points[FLAT_CURVE.points.length - 1].level_db).toBe(0);
    });

    it('REW_ROOM_CURVE should have LF rise and HF fall', () => {
      expect(REW_ROOM_CURVE.name).toContain('Room');
      
      // LF rise (should be positive at low frequencies)
      const lfPoint = REW_ROOM_CURVE.points.find(p => p.frequency_hz <= 50);
      expect(lfPoint?.level_db).toBeGreaterThan(0);
      
      // HF fall (should be negative at high frequencies)
      const hfPoint = REW_ROOM_CURVE.points.find(p => p.frequency_hz >= 10000);
      expect(hfPoint?.level_db).toBeLessThan(0);
    });

    it('HARMAN_CURVE should have bass shelf', () => {
      expect(HARMAN_CURVE.name).toContain('Harman');
      
      // Bass shelf (positive in low frequencies)
      const bassPoint = HARMAN_CURVE.points.find(p => p.frequency_hz <= 60);
      expect(bassPoint?.level_db).toBeGreaterThan(0);
      
      // Flat around 1 kHz
      const midPoint = HARMAN_CURVE.points.find(p => p.frequency_hz === 1000);
      expect(midPoint?.level_db).toBe(0);
    });
  });

  describe('getBuiltInCurve', () => {
    it('should return flat curve', () => {
      const curve = getBuiltInCurve('flat');
      expect(curve.name).toBe('Flat');
    });

    it('should return REW room curve', () => {
      const curve = getBuiltInCurve('rew_room_curve');
      expect(curve.name).toContain('Room');
    });

    it('should return Harman curve', () => {
      const curve = getBuiltInCurve('harman');
      expect(curve.name).toContain('Harman');
    });
  });

  describe('parseHouseCurve', () => {
    it('should parse simple frequency/level pairs', () => {
      const content = `
        100 0
        1000 0
        10000 -3
      `;
      
      const curve = parseHouseCurve(content);
      
      expect(curve.points.length).toBe(3);
      expect(curve.points[0].frequency_hz).toBe(100);
      expect(curve.points[2].level_db).toBe(-3);
    });

    it('should skip comment lines', () => {
      const content = `
        * This is a comment
        # This is also a comment
        100 0
        1000 0
      `;
      
      const curve = parseHouseCurve(content);
      expect(curve.points.length).toBe(2);
    });

    it('should handle comma-separated values', () => {
      const content = `
        100,0
        1000,2
      `;
      
      const curve = parseHouseCurve(content);
      expect(curve.points.length).toBe(2);
      expect(curve.points[1].level_db).toBe(2);
    });

    it('should sort points by frequency', () => {
      const content = `
        1000 0
        100 2
        10000 -2
      `;
      
      const curve = parseHouseCurve(content);
      
      expect(curve.points[0].frequency_hz).toBe(100);
      expect(curve.points[1].frequency_hz).toBe(1000);
      expect(curve.points[2].frequency_hz).toBe(10000);
    });
  });

  describe('interpolateTargetLevel', () => {
    it('should return exact level for exact frequency match', () => {
      const curve = createCustomCurve('Test', [
        { frequency_hz: 100, level_db: 5 },
        { frequency_hz: 1000, level_db: 0 },
        { frequency_hz: 10000, level_db: -5 }
      ]);
      
      expect(interpolateTargetLevel(curve, 1000)).toBe(0);
    });

    it('should interpolate between points', () => {
      const curve = createCustomCurve('Test', [
        { frequency_hz: 100, level_db: 10 },
        { frequency_hz: 1000, level_db: 0 }
      ], 'linear');
      
      const midLevel = interpolateTargetLevel(curve, 550);
      expect(midLevel).toBeLessThan(10);
      expect(midLevel).toBeGreaterThan(0);
    });

    it('should clamp to first point below range', () => {
      const curve = createCustomCurve('Test', [
        { frequency_hz: 100, level_db: 5 },
        { frequency_hz: 1000, level_db: 0 }
      ]);
      
      expect(interpolateTargetLevel(curve, 50)).toBe(5);
    });

    it('should clamp to last point above range', () => {
      const curve = createCustomCurve('Test', [
        { frequency_hz: 100, level_db: 5 },
        { frequency_hz: 1000, level_db: 0 }
      ]);
      
      expect(interpolateTargetLevel(curve, 2000)).toBe(0);
    });
  });

  describe('calculateAlignmentOffset', () => {
    it('should calculate offset to align at 1 kHz', () => {
      const measurement = createTestFR(
        [100, 500, 1000, 5000, 10000],
        [70, 72, 75, 73, 70]
      );
      
      const offset = calculateAlignmentOffset(measurement, FLAT_CURVE, 1000);
      
      // Flat curve is 0 at 1 kHz, measurement is 75, so offset should be -75
      expect(offset).toBeCloseTo(-75, 1);
    });

    it('should handle different alignment frequencies', () => {
      const measurement = createTestFR(
        [100, 1000, 10000],
        [80, 70, 60]
      );
      
      const offset100 = calculateAlignmentOffset(measurement, FLAT_CURVE, 100);
      const offset10k = calculateAlignmentOffset(measurement, FLAT_CURVE, 10000);
      
      // Offsets should be different for different alignment frequencies
      expect(offset100).not.toBe(offset10k);
    });
  });

  describe('calculateTargetDeviation', () => {
    it('should return zero deviation for perfect match', () => {
      // Create FR that matches flat target
      const measurement = createTestFR(
        [100, 1000, 10000],
        [70, 70, 70] // Flat response
      );
      
      const result = calculateTargetDeviation(measurement, FLAT_CURVE, {
        alignment_frequency_hz: 1000
      });
      
      expect(result.deviation_statistics.rms_deviation_db).toBeCloseTo(0, 1);
    });

    it('should detect deviations from target', () => {
      // Create FR with significant tilt
      const measurement = createTestFR(
        [100, 1000, 10000],
        [80, 70, 60] // -10 dB per decade tilt
      );
      
      const result = calculateTargetDeviation(measurement, FLAT_CURVE, {
        alignment_frequency_hz: 1000
      });
      
      expect(result.deviation_statistics.max_positive_deviation_db).toBeGreaterThan(5);
      expect(result.deviation_statistics.max_negative_deviation_db).toBeLessThan(-5);
    });

    it('should include band-by-band analysis', () => {
      const measurement = createRealisticFR();
      
      const result = calculateTargetDeviation(measurement, FLAT_CURVE);
      
      expect(result.by_band.length).toBeGreaterThan(0);
      for (const band of result.by_band) {
        expect(band.band_name).toBeDefined();
        expect(band.range_hz).toBeDefined();
        expect(['excellent', 'good', 'acceptable', 'needs_work', 'poor'])
          .toContain(band.assessment);
      }
    });

    it('should identify worst deviations', () => {
      const measurement = createRealisticFR();
      
      const result = calculateTargetDeviation(measurement, FLAT_CURVE);
      
      expect(result.worst_deviations.length).toBeGreaterThan(0);
      expect(result.worst_deviations.length).toBeLessThanOrEqual(5);
      
      for (const deviation of result.worst_deviations) {
        expect(deviation.frequency_hz).toBeGreaterThan(0);
        expect(['peak', 'null']).toContain(deviation.type);
      }
    });

    it('should assign overall grade', () => {
      const measurement = createRealisticFR();
      
      const result = calculateTargetDeviation(measurement, FLAT_CURVE);
      
      expect(['excellent', 'good', 'acceptable', 'needs_work', 'poor'])
        .toContain(result.overall_grade);
    });

    it('should respect evaluation range', () => {
      const measurement = createRealisticFR();
      
      const result = calculateTargetDeviation(measurement, FLAT_CURVE, {
        evaluation_range_hz: [100, 10000]
      });
      
      // Worst deviations should be within range
      for (const deviation of result.worst_deviations) {
        expect(deviation.frequency_hz).toBeGreaterThanOrEqual(100);
        expect(deviation.frequency_hz).toBeLessThanOrEqual(10000);
      }
    });
  });

  describe('createCustomCurve', () => {
    it('should create a valid curve', () => {
      const curve = createCustomCurve('My Curve', [
        { frequency_hz: 100, level_db: 3 },
        { frequency_hz: 1000, level_db: 0 }
      ]);
      
      expect(curve.name).toBe('My Curve');
      expect(curve.points.length).toBe(2);
    });

    it('should sort points by frequency', () => {
      const curve = createCustomCurve('Test', [
        { frequency_hz: 1000, level_db: 0 },
        { frequency_hz: 100, level_db: 3 }
      ]);
      
      expect(curve.points[0].frequency_hz).toBe(100);
      expect(curve.points[1].frequency_hz).toBe(1000);
    });

    it('should use specified interpolation', () => {
      const linearCurve = createCustomCurve('Linear', [], 'linear');
      const logCurve = createCustomCurve('Log', [], 'log');
      
      expect(linearCurve.interpolation).toBe('linear');
      expect(logCurve.interpolation).toBe('log');
    });
  });
});
