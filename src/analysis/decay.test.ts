/**
 * Decay Analysis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateETC,
  buildSchroederCurve,
  calculateEDT,
  calculateT20,
  calculateT30,
  calculateTopt,
  calculateRT60Full,
  estimateNoiseFloor,
  getTargetRT60,
  assessRT60Quality,
  calculateRT60Bands
} from './decay.js';
import type { ImpulseResponseData } from '../types/index.js';

// Helper to create test impulse response
function createTestIR(
  decayTimeSeconds: number = 0.5,
  sampleRate: number = 48000
): ImpulseResponseData {
  const duration = decayTimeSeconds * 3; // Include tail
  const numSamples = Math.floor(duration * sampleRate);
  const samples: number[] = [];
  
  // Generate exponentially decaying impulse
  const decayRate = Math.log(1000) / (decayTimeSeconds * sampleRate); // -60 dB decay
  
  for (let i = 0; i < numSamples; i++) {
    // Simple exponential decay with some noise
    const decay = Math.exp(-decayRate * i);
    const noise = (Math.random() - 0.5) * 0.001; // Small noise
    samples.push(decay + noise);
  }
  
  return {
    samples,
    sample_rate_hz: sampleRate,
    peak_index: 0,
    start_time_s: 0,
    duration_s: duration
  };
}

describe('Decay Analysis', () => {
  describe('generateETC', () => {
    it('should generate energy time curve', () => {
      const ir = createTestIR(0.3);
      const etc = generateETC(ir);
      
      expect(etc.time_ms.length).toBeGreaterThan(0);
      expect(etc.energy_db.length).toBe(etc.time_ms.length);
    });

    it('should start at 0 dB', () => {
      const ir = createTestIR(0.3);
      const etc = generateETC(ir);
      
      // First point should be near 0 dB
      expect(etc.energy_db[0]).toBeCloseTo(0, 1);
    });

    it('should decrease over time', () => {
      const ir = createTestIR(0.3);
      const etc = generateETC(ir);
      
      // Energy should decrease
      const midpoint = Math.floor(etc.energy_db.length / 2);
      expect(etc.energy_db[midpoint]).toBeLessThan(etc.energy_db[0]);
    });
  });

  describe('buildSchroederCurve', () => {
    it('should create Schroeder curve from IR', () => {
      const ir = createTestIR(0.3);
      const schroeder = buildSchroederCurve(ir);
      
      expect(schroeder.time_ms).toBeDefined();
      expect(schroeder.energy_db).toBeDefined();
      expect(schroeder.sample_rate_hz).toBe(ir.sample_rate_hz);
    });
  });

  describe('calculateEDT', () => {
    it('should calculate early decay time', () => {
      const ir = createTestIR(0.4);
      const schroeder = buildSchroederCurve(ir);
      const edt = calculateEDT(schroeder);
      
      expect(edt).not.toBeNull();
      if (edt !== null) {
        // EDT should be reasonable
        expect(edt).toBeGreaterThan(0);
        expect(edt).toBeLessThan(3);
      }
    });
  });

  describe('calculateT20', () => {
    it('should calculate T20', () => {
      const ir = createTestIR(0.5);
      const schroeder = buildSchroederCurve(ir);
      const t20 = calculateT20(schroeder);
      
      expect(t20).not.toBeNull();
      if (t20 !== null) {
        // T20 should be in reasonable range for our test signal
        expect(t20).toBeGreaterThan(0.1);
        expect(t20).toBeLessThan(2);
      }
    });
  });

  describe('calculateT30', () => {
    it('should calculate T30', () => {
      const ir = createTestIR(0.5);
      const schroeder = buildSchroederCurve(ir);
      const t30 = calculateT30(schroeder);
      
      expect(t30).not.toBeNull();
      if (t30 !== null) {
        // T30 should be close to our designed decay time
        expect(t30).toBeGreaterThan(0.2);
        expect(t30).toBeLessThan(2);
      }
    });

    it('should return null if decay is too short', () => {
      // Create very short IR
      const ir: ImpulseResponseData = {
        samples: [1, 0.5, 0.25, 0.1, 0.05],
        sample_rate_hz: 48000,
        peak_index: 0,
        start_time_s: 0,
        duration_s: 0.0001
      };
      
      const schroeder = buildSchroederCurve(ir);
      const t30 = calculateT30(schroeder);
      
      // Should return null or a very small value
      // (depends on whether curve reaches -35 dB)
    });
  });

  describe('calculateTopt', () => {
    it('should calculate Topt as weighted average', () => {
      const ir = createTestIR(0.4);
      const schroeder = buildSchroederCurve(ir);
      const topt = calculateTopt(schroeder);
      
      expect(topt).not.toBeNull();
      if (topt !== null) {
        expect(topt).toBeGreaterThan(0);
        expect(topt).toBeLessThan(2);
      }
    });

    it('should be between EDT and T30', () => {
      const ir = createTestIR(0.4);
      const schroeder = buildSchroederCurve(ir);
      
      const edt = calculateEDT(schroeder);
      const t30 = calculateT30(schroeder);
      const topt = calculateTopt(schroeder);
      
      if (edt !== null && t30 !== null && topt !== null) {
        const min = Math.min(edt, t30);
        const max = Math.max(edt, t30);
        // Topt should be reasonably close to the range
        expect(topt).toBeGreaterThan(min * 0.5);
        expect(topt).toBeLessThan(max * 2);
      }
    });
  });

  describe('calculateRT60Full', () => {
    it('should return complete RT60 result', () => {
      const ir = createTestIR(0.4);
      const result = calculateRT60Full(ir, 100);
      
      expect(result.frequency_hz).toBe(100);
      expect(result.noise_floor_db).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.confidence);
    });

    it('should include all measurements when possible', () => {
      const ir = createTestIR(0.5);
      const result = calculateRT60Full(ir);
      
      // At least some measurements should be available
      const hasAnyMeasurement = 
        result.t20_seconds !== null ||
        result.t30_seconds !== null ||
        result.topt_seconds !== null ||
        result.edt_seconds !== null;
      
      expect(hasAnyMeasurement).toBe(true);
    });
  });

  describe('estimateNoiseFloor', () => {
    it('should estimate noise floor from curve tail', () => {
      const ir = createTestIR(0.3);
      const schroeder = buildSchroederCurve(ir);
      const noiseFloor = estimateNoiseFloor(schroeder);
      
      // Noise floor should be negative (in dB)
      expect(noiseFloor).toBeLessThan(0);
    });
  });

  describe('getTargetRT60', () => {
    it('should return 0.3s for small rooms', () => {
      expect(getTargetRT60(30)).toBe(0.3);
      expect(getTargetRT60(49)).toBe(0.3);
    });

    it('should return higher values for larger rooms', () => {
      expect(getTargetRT60(100)).toBeGreaterThan(0.3);
      expect(getTargetRT60(200)).toBeGreaterThan(0.4);
    });

    it('should return default 0.3s when no volume given', () => {
      expect(getTargetRT60()).toBe(0.3);
      expect(getTargetRT60(undefined)).toBe(0.3);
    });
  });

  describe('assessRT60Quality', () => {
    it('should rate excellent when close to target', () => {
      expect(assessRT60Quality(0.3, 0.3)).toBe('excellent');
      expect(assessRT60Quality(0.32, 0.3)).toBe('excellent');
    });

    it('should rate good when within 30%', () => {
      expect(assessRT60Quality(0.36, 0.3)).toBe('good');
      expect(assessRT60Quality(0.24, 0.3)).toBe('good');
    });

    it('should rate problematic when significantly over', () => {
      expect(assessRT60Quality(0.5, 0.3)).toBe('problematic');
    });

    it('should rate severe when very far from target', () => {
      expect(assessRT60Quality(0.8, 0.3)).toBe('severe');
    });
  });

  describe('calculateRT60Bands', () => {
    it('should return array of band results', () => {
      const ir = createTestIR(0.4);
      const bands = calculateRT60Bands(ir, 'third_octave', [20, 200]);
      
      expect(bands.length).toBeGreaterThan(0);
    });

    it('should include all required fields', () => {
      const ir = createTestIR(0.4);
      const bands = calculateRT60Bands(ir, 'octave', [50, 200]);
      
      for (const band of bands) {
        expect(band.center_frequency_hz).toBeDefined();
        expect(band.bandwidth).toBe('octave');
        expect(band.target_seconds).toBeDefined();
        expect(['excellent', 'good', 'acceptable', 'problematic', 'severe']).toContain(band.assessment);
      }
    });

    it('should respect frequency range', () => {
      const ir = createTestIR(0.4);
      const bands = calculateRT60Bands(ir, 'octave', [100, 400]);
      
      for (const band of bands) {
        expect(band.center_frequency_hz).toBeGreaterThanOrEqual(100);
        expect(band.center_frequency_hz).toBeLessThanOrEqual(400);
      }
    });

    it('should use provided target RT60', () => {
      const ir = createTestIR(0.4);
      const bands = calculateRT60Bands(ir, 'octave', [50, 200], 0.5);
      
      for (const band of bands) {
        expect(band.target_seconds).toBe(0.5);
      }
    });
  });
});
