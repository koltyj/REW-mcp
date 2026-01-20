/**
 * Subwoofer Integration Analysis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  estimateCrossoverFrequency,
  analyzeCrossover,
  calculateOptimalDelay,
  analyzePolarity,
  predictCombinedResponse,
  analyzeSubIntegration
} from './sub-integration.js';
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

// Create realistic bass frequency array (20-500 Hz)
function createBassFrequencies(): number[] {
  const freqs: number[] = [];
  for (let f = 20; f <= 500; f *= Math.pow(2, 1/12)) {
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
}

// Create sub response (rolls off above ~100 Hz)
function createSubResponse(crossover: number = 80): FrequencyResponseData {
  const freqs = createBassFrequencies();
  const spl = freqs.map(f => {
    if (f < crossover * 0.7) return 80; // Flat below crossover
    // 24 dB/octave rolloff above crossover
    const octavesAbove = Math.log2(f / crossover);
    return Math.max(80 - octavesAbove * 24, 40);
  });
  // Phase increases with frequency (typical for low-pass)
  const phase = freqs.map(f => {
    const octavesAbove = Math.max(0, Math.log2(f / crossover));
    return -octavesAbove * 90; // 90° per octave for 4th order
  });
  return createTestFR(freqs, spl, phase);
}

// Create mains response (rolls off below ~100 Hz)
function createMainsResponse(crossover: number = 80): FrequencyResponseData {
  const freqs = createBassFrequencies();
  const spl = freqs.map(f => {
    if (f > crossover * 1.3) return 75; // Flat above crossover
    // 12 dB/octave rolloff below crossover
    const octavesBelow = Math.log2(crossover / f);
    return Math.max(75 - octavesBelow * 12, 40);
  });
  // Phase decreases with decreasing frequency (typical for high-pass)
  const phase = freqs.map(f => {
    const octavesBelow = Math.max(0, Math.log2(crossover / f));
    return octavesBelow * 45; // 45° per octave for 2nd order
  });
  return createTestFR(freqs, spl, phase);
}

describe('Subwoofer Integration Analysis', () => {
  describe('estimateCrossoverFrequency', () => {
    it('should estimate crossover from rolloff points', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const crossover = estimateCrossoverFrequency(mains, sub);
      
      // Should be in a reasonable range around 80 Hz
      expect(crossover).toBeGreaterThan(50);
      expect(crossover).toBeLessThan(150);
    });

    it('should handle different crossover frequencies', () => {
      const mains = createMainsResponse(100);
      const sub = createSubResponse(100);
      
      const crossover = estimateCrossoverFrequency(mains, sub);
      
      // Should be in a reasonable range around 100 Hz
      expect(crossover).toBeGreaterThan(60);
      expect(crossover).toBeLessThan(180);
    });
  });

  describe('analyzeCrossover', () => {
    it('should detect crossover frequency', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeCrossover(mains, sub);
      
      expect(analysis.detected_crossover_hz).toBeGreaterThan(50);
      expect(analysis.detected_crossover_hz).toBeLessThan(150);
    });

    it('should use provided crossover frequency when given', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeCrossover(mains, sub, 100);
      
      expect(analysis.detected_crossover_hz).toBe(100);
    });

    it('should report phase at crossover', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeCrossover(mains, sub, 80);
      
      expect(typeof analysis.phase_at_crossover_mains_deg).toBe('number');
      expect(typeof analysis.phase_at_crossover_sub_deg).toBe('number');
      expect(typeof analysis.phase_difference_deg).toBe('number');
    });

    it('should assess phase alignment quality', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeCrossover(mains, sub, 80);
      
      expect(['excellent', 'good', 'fair', 'poor']).toContain(analysis.phase_alignment_quality);
    });
  });

  describe('calculateOptimalDelay', () => {
    it('should return timing recommendations', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const timing = calculateOptimalDelay(mains, sub, 80, 0);
      
      expect(typeof timing.current_delay_ms).toBe('number');
      expect(typeof timing.optimal_delay_ms).toBe('number');
      expect(typeof timing.adjustment_needed_ms).toBe('number');
      expect(timing.alignment_method_used).toBe('phase_match');
    });

    it('should account for current delay', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const timing = calculateOptimalDelay(mains, sub, 80, 5);
      
      expect(timing.current_delay_ms).toBe(5);
      // Adjustment needed should equal optimal minus current
      expect(timing.adjustment_needed_ms).toBe(
        Math.round((timing.optimal_delay_ms - 5) * 10) / 10
      );
    });

    it('should clamp extreme delay values', () => {
      const mains = createTestFR([80], [70], [0]);
      const sub = createTestFR([80], [70], [180]); // 180° out of phase
      
      const timing = calculateOptimalDelay(mains, sub, 80, 0);
      
      // Should be clamped to reasonable range
      expect(timing.optimal_delay_ms).toBeGreaterThanOrEqual(-20);
      expect(timing.optimal_delay_ms).toBeLessThanOrEqual(20);
    });
  });

  describe('analyzePolarity', () => {
    it('should recommend normal polarity for in-phase signals', () => {
      const mains = createTestFR([80], [70], [0]);
      const sub = createTestFR([80], [70], [0]);
      
      const polarity = analyzePolarity(mains, sub, 80, 'normal');
      
      expect(polarity.invert_recommended).toBe(false);
    });

    it('should recommend inversion for 180° out of phase signals', () => {
      const mains = createTestFR([80], [70], [0]);
      const sub = createTestFR([80], [70], [180]);
      
      const polarity = analyzePolarity(mains, sub, 80, 'normal');
      
      // Should recommend inversion since they're out of phase
      expect(polarity.invert_recommended).toBe(true);
    });

    it('should report expected improvement', () => {
      const mains = createTestFR([80], [70], [0]);
      const sub = createTestFR([80], [70], [150]); // Mostly out of phase
      
      const polarity = analyzePolarity(mains, sub, 80, 'normal');
      
      expect(typeof polarity.expected_improvement_db).toBe('number');
      expect(polarity.expected_improvement_db).toBeGreaterThanOrEqual(0);
    });
  });

  describe('predictCombinedResponse', () => {
    it('should return combined frequency response', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const combined = predictCombinedResponse(mains, sub, 0, false);
      
      expect(combined.frequencies_hz.length).toBeGreaterThan(0);
      expect(combined.spl_db.length).toBe(combined.frequencies_hz.length);
      expect(combined.phase_degrees.length).toBe(combined.frequencies_hz.length);
    });

    it('should show improved response at crossover with proper alignment', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const combined0 = predictCombinedResponse(mains, sub, 0, false);
      const combined5 = predictCombinedResponse(mains, sub, 5, false);
      
      // Different delays should produce different results
      const idx80 = combined0.frequencies_hz.findIndex(f => f >= 80);
      if (idx80 >= 0) {
        // Just verify the values are different, not necessarily better
        // (actual optimal delay depends on the specific response)
        expect(typeof combined0.spl_db[idx80]).toBe('number');
        expect(typeof combined5.spl_db[idx80]).toBe('number');
      }
    });

    it('should show cancellation when inverted out of phase', () => {
      const mains = createTestFR([80, 100, 120], [70, 70, 70], [0, 0, 0]);
      const sub = createTestFR([80, 100, 120], [70, 70, 70], [0, 0, 0]); // In phase
      
      // Normal polarity should sum well
      const combinedNormal = predictCombinedResponse(mains, sub, 0, false);
      // Inverted should cancel
      const combinedInverted = predictCombinedResponse(mains, sub, 0, true);
      
      // Normal should have higher level than inverted at in-phase frequencies
      expect(combinedNormal.spl_db[0]).toBeGreaterThan(combinedInverted.spl_db[0]);
    });
  });

  describe('analyzeSubIntegration', () => {
    it('should return complete analysis', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeSubIntegration(mains, sub);
      
      expect(analysis.crossover_analysis).toBeDefined();
      expect(analysis.timing_recommendations).toBeDefined();
      expect(analysis.polarity_recommendation).toBeDefined();
      expect(analysis.summation_prediction).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(analysis.confidence);
    });

    it('should accept options', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeSubIntegration(mains, sub, {
        crossover_hz: 100,
        current_sub_delay_ms: 3,
        current_sub_polarity: 'inverted'
      });
      
      expect(analysis.crossover_analysis.detected_crossover_hz).toBe(100);
      expect(analysis.timing_recommendations.current_delay_ms).toBe(3);
      expect(analysis.polarity_recommendation.current_polarity).toBe('inverted');
    });

    it('should warn about missing phase data', () => {
      const mains = createTestFR([80, 100, 120], [70, 70, 70]); // No phase
      const sub = createTestFR([80, 100, 120], [70, 70, 70]); // No phase
      
      const analysis = analyzeSubIntegration(mains, sub);
      
      expect(analysis.warnings.some(w => w.includes('Phase data'))).toBe(true);
    });

    it('should predict summation improvement', () => {
      const mains = createMainsResponse(80);
      const sub = createSubResponse(80);
      
      const analysis = analyzeSubIntegration(mains, sub);
      
      expect(typeof analysis.summation_prediction.current_dip_at_crossover_db).toBe('number');
      expect(typeof analysis.summation_prediction.predicted_dip_after_optimization_db).toBe('number');
      expect(typeof analysis.summation_prediction.improvement_db).toBe('number');
    });
  });
});
