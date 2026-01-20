/**
 * Reflection Analysis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  findDirectSound,
  detectReflections,
  analyzeCombFiltering,
  calculateITDGap,
  calculateC50,
  calculateC80,
  calculateD50,
  calculateCombFrequencies,
  estimateSurfaceFromDelay,
  performEnhancedReflectionAnalysis
} from './reflections.js';
import type { ImpulseResponseData, EarlyReflection } from '../types/index.js';

// Helper to create test impulse response with reflections
function createTestIRWithReflections(
  reflectionDelaysMs: number[] = [10, 25],
  reflectionLevels: number[] = [0.5, 0.3],
  sampleRate: number = 48000
): ImpulseResponseData {
  const duration = 0.5; // 500ms
  const numSamples = Math.floor(duration * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);
  
  // Direct sound at start
  samples[0] = 1.0;
  
  // Add reflections
  for (let i = 0; i < reflectionDelaysMs.length; i++) {
    const delayIndex = Math.floor((reflectionDelaysMs[i] / 1000) * sampleRate);
    if (delayIndex < numSamples) {
      samples[delayIndex] = reflectionLevels[i];
    }
  }
  
  // Add decay tail
  const decayRate = 0.01;
  for (let i = 0; i < numSamples; i++) {
    samples[i] += (Math.random() - 0.5) * 0.01 * Math.exp(-decayRate * i);
  }
  
  return {
    samples,
    sample_rate_hz: sampleRate,
    peak_index: 0,
    start_time_s: 0,
    duration_s: duration
  };
}

describe('Reflection Analysis', () => {
  describe('findDirectSound', () => {
    it('should find direct sound peak', () => {
      const ir = createTestIRWithReflections();
      const direct = findDirectSound(ir);
      
      expect(direct.arrival_time_ms).toBeCloseTo(0, 1);
      expect(direct.level_db).toBeDefined();
      expect(direct.peak_sample_index).toBe(0);
    });
  });

  describe('detectReflections', () => {
    it('should detect reflections after direct sound', () => {
      const ir = createTestIRWithReflections([10, 25], [0.5, 0.3]);
      const reflections = detectReflections(ir, { threshold_db: -20 });
      
      expect(reflections.length).toBeGreaterThan(0);
    });

    it('should filter by threshold', () => {
      const ir = createTestIRWithReflections([10, 25], [0.5, 0.1]);
      
      // High threshold should detect fewer
      const highThreshold = detectReflections(ir, { threshold_db: -6 });
      // Low threshold should detect more
      const lowThreshold = detectReflections(ir, { threshold_db: -20 });
      
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });

    it('should respect max reflection time', () => {
      const ir = createTestIRWithReflections([10, 50], [0.5, 0.5]);
      const reflections = detectReflections(ir, { max_reflection_time_ms: 30 });
      
      for (const r of reflections) {
        expect(r.delay_ms).toBeLessThanOrEqual(30);
      }
    });
  });

  describe('analyzeCombFiltering', () => {
    it('should calculate comb filter frequencies', () => {
      const result = analyzeCombFiltering(10); // 10ms delay
      
      expect(result.first_null_hz).toBeGreaterThan(0);
      expect(result.affected_frequencies_hz.length).toBeGreaterThan(0);
      expect(result.pattern).toContain('Hz');
    });

    it('should have first null at expected frequency', () => {
      // 5ms delay -> path difference = 1.715m
      // First null = 343 / (2 * 1.715) = ~100 Hz
      const result = analyzeCombFiltering(5);
      
      expect(result.first_null_hz).toBeGreaterThan(80);
      expect(result.first_null_hz).toBeLessThan(120);
    });
  });

  describe('calculateITDGap', () => {
    it('should return infinity for no reflections', () => {
      const result = calculateITDGap(0, []);
      expect(result.itd_ms).toBe(Infinity);
      expect(result.assessment).toBe('excellent');
    });

    it('should assess based on first reflection', () => {
      const reflections: EarlyReflection[] = [
        {
          delay_ms: 25,
          level_relative_db: -6,
          level_absolute_db: -10,
          estimated_path_length_m: 8.5,
          severity: 'moderate'
        }
      ];
      
      const result = calculateITDGap(0, reflections);
      expect(result.itd_ms).toBe(25);
      expect(result.assessment).toBe('good');
    });

    it('should rate short ITD as poor', () => {
      const reflections: EarlyReflection[] = [
        {
          delay_ms: 3,
          level_relative_db: -6,
          level_absolute_db: -10,
          estimated_path_length_m: 1,
          severity: 'severe'
        }
      ];
      
      const result = calculateITDGap(0, reflections);
      expect(result.assessment).toBe('poor');
    });
  });

  describe('calculateC50', () => {
    it('should calculate speech clarity metric', () => {
      const ir = createTestIRWithReflections();
      const c50 = calculateC50(ir);
      
      expect(typeof c50).toBe('number');
      expect(isFinite(c50)).toBe(true);
    });

    it('should be higher when most energy is early', () => {
      // IR with strong direct sound and weak tail
      const earlyIR = createTestIRWithReflections([], []);
      earlyIR.samples[0] = 1.0;
      for (let i = 1; i < earlyIR.samples.length; i++) {
        earlyIR.samples[i] = 0.001 * Math.exp(-0.1 * i);
      }
      
      const c50 = calculateC50(earlyIR);
      expect(c50).toBeGreaterThan(0);
    });
  });

  describe('calculateC80', () => {
    it('should calculate music clarity metric', () => {
      const ir = createTestIRWithReflections();
      const c80 = calculateC80(ir);
      
      expect(typeof c80).toBe('number');
      expect(isFinite(c80)).toBe(true);
    });

    it('should be greater than or equal to C50', () => {
      const ir = createTestIRWithReflections();
      const c50 = calculateC50(ir);
      const c80 = calculateC80(ir);
      
      // C80 includes more early energy, so should be >= C50
      expect(c80).toBeGreaterThanOrEqual(c50 - 0.1); // Allow small tolerance
    });
  });

  describe('calculateD50', () => {
    it('should return value between 0 and 1', () => {
      const ir = createTestIRWithReflections();
      const d50 = calculateD50(ir);
      
      expect(d50).toBeGreaterThanOrEqual(0);
      expect(d50).toBeLessThanOrEqual(1);
    });

    it('should be close to 1 for impulsive signal', () => {
      // IR with only direct sound
      const impulsiveIR: ImpulseResponseData = {
        samples: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        sample_rate_hz: 1000,
        peak_index: 0,
        start_time_s: 0,
        duration_s: 0.01
      };
      
      const d50 = calculateD50(impulsiveIR);
      expect(d50).toBeCloseTo(1, 1);
    });
  });

  describe('calculateCombFrequencies', () => {
    it('should return nulls and peaks', () => {
      const result = calculateCombFrequencies(1.0); // 1 meter path
      
      expect(result.nulls_hz.length).toBeGreaterThan(0);
      expect(result.peaks_hz.length).toBeGreaterThan(0);
    });

    it('should calculate correct first null', () => {
      // 1 meter path: first null = 343 / 2 = 171.5 Hz
      const result = calculateCombFrequencies(1.0);
      
      expect(result.nulls_hz[0]).toBeCloseTo(172, 5);
    });

    it('should respect max frequency', () => {
      const result = calculateCombFrequencies(1.0, 1000);
      
      for (const freq of result.nulls_hz) {
        expect(freq).toBeLessThanOrEqual(1000);
      }
      for (const freq of result.peaks_hz) {
        expect(freq).toBeLessThanOrEqual(1000);
      }
    });

    it('should return empty for zero path', () => {
      const result = calculateCombFrequencies(0);
      
      expect(result.nulls_hz).toEqual([]);
      expect(result.peaks_hz).toEqual([]);
    });
  });

  describe('estimateSurfaceFromDelay', () => {
    it('should estimate nearby surface for short delays', () => {
      const surface = estimateSurfaceFromDelay(1);
      expect(surface.toLowerCase()).toContain('desk');
    });

    it('should estimate wall for medium delays', () => {
      const surface = estimateSurfaceFromDelay(10);
      expect(surface.toLowerCase()).toContain('wall');
    });

    it('should use room dimensions when provided', () => {
      // 2m wide room, reflection at ~6ms (1m each way)
      const surface = estimateSurfaceFromDelay(6, {
        length: 4,
        width: 2,
        height: 2.5
      });
      
      expect(surface).toBeDefined();
      expect(typeof surface).toBe('string');
    });
  });

  describe('performEnhancedReflectionAnalysis', () => {
    it('should return complete analysis', () => {
      const ir = createTestIRWithReflections([10, 25], [0.5, 0.3]);
      const analysis = performEnhancedReflectionAnalysis(ir);
      
      expect(analysis.direct_sound).toBeDefined();
      expect(analysis.reflections).toBeDefined();
      expect(analysis.clarity_metrics).toBeDefined();
      expect(analysis.comb_filtering_analysis).toBeDefined();
      expect(analysis.overall_assessment).toBeDefined();
    });

    it('should include clarity metrics', () => {
      const ir = createTestIRWithReflections();
      const analysis = performEnhancedReflectionAnalysis(ir);
      
      expect(typeof analysis.clarity_metrics.c50_db).toBe('number');
      expect(typeof analysis.clarity_metrics.c80_db).toBe('number');
      expect(typeof analysis.clarity_metrics.d50).toBe('number');
      expect(typeof analysis.clarity_metrics.itd_gap_ms).toBe('number');
      expect(['excellent', 'good', 'acceptable', 'problematic'])
        .toContain(analysis.clarity_metrics.clarity_assessment);
    });

    it('should analyze comb filtering', () => {
      const ir = createTestIRWithReflections([10], [0.6]); // Strong early reflection
      const analysis = performEnhancedReflectionAnalysis(ir);
      
      expect(['severe', 'moderate', 'mild', 'negligible'])
        .toContain(analysis.comb_filtering_analysis.risk_level);
    });

    it('should include reflection details', () => {
      const ir = createTestIRWithReflections([10, 20], [0.5, 0.3]);
      const analysis = performEnhancedReflectionAnalysis(ir, { threshold_db: -10 });
      
      if (analysis.reflections.length > 0) {
        const firstReflection = analysis.reflections[0];
        expect(typeof firstReflection.delay_ms).toBe('number');
        expect(typeof firstReflection.level_relative_db).toBe('number');
        expect(typeof firstReflection.likely_surface).toBe('string');
        expect(Array.isArray(firstReflection.comb_filter_affected_hz)).toBe(true);
      }
    });
  });
});
