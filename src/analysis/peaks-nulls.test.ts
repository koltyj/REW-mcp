/**
 * Tests for Peak and Null Detection
 */

import { describe, it, expect } from 'vitest';
import { detectPeaks, detectNulls, calculateQuickStats } from './peaks-nulls.js';
import type { FrequencyResponseData } from '../types/index.js';

describe('Peak and Null Detection', () => {
  describe('detectPeaks', () => {
    it('should detect a clear peak', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [20, 25, 30, 35, 40, 45, 50, 55, 60],
        spl_db: [80, 80, 80, 95, 80, 80, 80, 80, 80], // Clear 15dB peak at 35 Hz
        phase_degrees: Array(9).fill(0)
      };
      
      const peaks = detectPeaks(fr, { threshold_db: 5 });
      
      expect(peaks.length).toBeGreaterThan(0);
      const mainPeak = peaks.find(p => p.frequency_hz === 35);
      expect(mainPeak).toBeDefined();
      expect(mainPeak!.deviation_db).toBeGreaterThan(5);
      expect(mainPeak!.severity).toBe('significant');
    });

    it('should not detect small variations as peaks', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [20, 25, 30, 35, 40, 45, 50],
        spl_db: [80, 81, 82, 81, 80, 81, 80], // No significant peaks
        phase_degrees: Array(7).fill(0)
      };
      
      const peaks = detectPeaks(fr, { threshold_db: 5 });
      
      expect(peaks.length).toBe(0);
    });

    it('should respect frequency range limits', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [20, 50, 100, 200, 500],
        spl_db: [90, 92, 85, 93, 86], // Peaks at 50 and 200
        phase_degrees: Array(5).fill(0)
      };
      
      const peaks = detectPeaks(fr, {
        threshold_db: 3,
        min_frequency_hz: 100,
        max_frequency_hz: 300
      });
      
      // Should only detect peak at 200 Hz
      expect(peaks.every(p => p.frequency_hz >= 100 && p.frequency_hz <= 300)).toBe(true);
    });
  });

  describe('detectNulls', () => {
    it('should detect a clear null', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [20, 25, 30, 35, 40, 45, 50, 55, 60],
        spl_db: [80, 80, 80, 65, 80, 80, 80, 80, 80], // Clear 15dB null at 35 Hz
        phase_degrees: Array(9).fill(0)
      };
      
      const nulls = detectNulls(fr, { threshold_db: -6 });
      
      expect(nulls.length).toBeGreaterThan(0);
      const mainNull = nulls.find(n => n.frequency_hz === 35);
      expect(mainNull).toBeDefined();
      expect(mainNull!.depth_db).toBeGreaterThan(6);
      expect(mainNull!.severity).toBe('significant');
      expect(mainNull!.glm_addressable).toBe(false); // GLM cannot boost nulls
    });

    it('should suggest resolution for nulls', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [50, 80, 100, 120, 150, 200],
        spl_db: [80, 80, 65, 80, 80, 80], // Clear null at 100 Hz
        phase_degrees: Array(6).fill(0)
      };
      
      const nulls = detectNulls(fr, { threshold_db: -6 });
      
      expect(nulls.length).toBeGreaterThan(0);
      expect(nulls[0].suggested_resolution).toBeDefined();
      expect(nulls[0].suggested_resolution).toContain('repositioning');
    });
  });

  describe('calculateQuickStats', () => {
    it('should calculate band averages', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
        spl_db: [85, 85, 84, 80, 78, 77, 76, 75, 74],
        phase_degrees: Array(9).fill(0)
      };
      
      const stats = calculateQuickStats(fr);
      
      expect(stats.bass_avg_db).toBeGreaterThan(80);
      expect(stats.midrange_avg_db).toBeGreaterThan(75);
      expect(stats.treble_avg_db).toBeGreaterThan(70);
    });

    it('should calculate variance within bands', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [20, 50, 100, 150, 200],
        spl_db: [80, 90, 75, 88, 82], // 15 dB variance in bass
        phase_degrees: Array(5).fill(0)
      };
      
      const stats = calculateQuickStats(fr);
      
      expect(stats.variance_20_200hz_db).toBeGreaterThan(10);
    });

    it('should handle missing frequency ranges', () => {
      const fr: FrequencyResponseData = {
        frequencies_hz: [500, 1000],
        spl_db: [80, 82],
        phase_degrees: [0, 0]
      };
      
      const stats = calculateQuickStats(fr);
      
      // Should not crash with missing bass data
      expect(stats.bass_avg_db).toBe(0);
      expect(stats.midrange_avg_db).toBeGreaterThan(0);
    });
  });
});
