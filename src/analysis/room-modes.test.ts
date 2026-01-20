/**
 * Tests for Room Mode Calculation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTheoreticalModes,
  correlatePeakWithModes,
  calculateSchroederFrequency,
  assessModeDistribution
} from './room-modes.js';
import { calculateQuickStats } from './peaks-nulls.js';
import type { RoomDimensions, FrequencyResponseData } from '../types/index.js';

describe('Room Mode Calculation', () => {
  const testRoom: RoomDimensions = {
    length: 5.0, // meters
    width: 4.0,
    height: 2.5
  };

  describe('calculateTheoreticalModes', () => {
    it('should calculate axial modes correctly', () => {
      const modes = calculateTheoreticalModes(testRoom, 200);
      
      // First length mode: 343 / (2 * 5) = 34.3 Hz
      const firstLengthMode = modes.find(
        m => m.mode_type === 'axial' && m.dimension === 'Length' && m.order === 1
      );
      
      expect(firstLengthMode).toBeDefined();
      expect(firstLengthMode!.frequency_hz).toBeCloseTo(34.3, 1);
      
      // First width mode: 343 / (2 * 4) = 42.875 Hz
      const firstWidthMode = modes.find(
        m => m.mode_type === 'axial' && m.dimension === 'Width' && m.order === 1
      );
      
      expect(firstWidthMode).toBeDefined();
      expect(firstWidthMode!.frequency_hz).toBeCloseTo(42.875, 1);
      
      // First height mode: 343 / (2 * 2.5) = 68.6 Hz
      const firstHeightMode = modes.find(
        m => m.mode_type === 'axial' && m.dimension === 'Height' && m.order === 1
      );
      
      expect(firstHeightMode).toBeDefined();
      expect(firstHeightMode!.frequency_hz).toBeCloseTo(68.6, 1);
    });

    it('should include tangential modes', () => {
      const modes = calculateTheoreticalModes(testRoom, 150);
      
      const tangentialModes = modes.filter(m => m.mode_type === 'tangential');
      expect(tangentialModes.length).toBeGreaterThan(0);
    });

    it('should sort modes by frequency', () => {
      const modes = calculateTheoreticalModes(testRoom, 200);
      
      for (let i = 1; i < modes.length; i++) {
        expect(modes[i].frequency_hz).toBeGreaterThanOrEqual(modes[i - 1].frequency_hz);
      }
    });

    it('should limit modes to max frequency', () => {
      const modes = calculateTheoreticalModes(testRoom, 100);
      
      expect(modes.every(m => m.frequency_hz <= 100)).toBe(true);
    });
  });

  describe('correlatePeakWithModes', () => {
    it('should find matching mode within tolerance', () => {
      const modes = calculateTheoreticalModes(testRoom, 200);
      const peakFreq = 34.5; // Close to first length mode (34.3 Hz)
      
      const correlation = correlatePeakWithModes(peakFreq, modes, 5);
      
      expect(correlation).toBeDefined();
      expect(correlation!.mode_type).toBe('axial');
      expect(correlation!.dimension).toBe('Length');
      expect(correlation!.match_error_percent).toBeLessThan(5);
    });

    it('should return undefined for non-matching peak', () => {
      const modes = calculateTheoreticalModes(testRoom, 200);
      const peakFreq = 11.11; // Very low frequency, won't match any mode in typical room
      
      const correlation = correlatePeakWithModes(peakFreq, modes, 2);
      
      expect(correlation).toBeUndefined();
    });

    it('should find best match among multiple candidates', () => {
      const modes = calculateTheoreticalModes(testRoom, 200);
      const peakFreq = 68.0; // Close to height mode (68.6 Hz)
      
      const correlation = correlatePeakWithModes(peakFreq, modes, 5);
      
      expect(correlation).toBeDefined();
      expect(correlation!.theoretical_mode_hz).toBeCloseTo(68.6, 1);
    });
  });

  describe('calculateSchroederFrequency', () => {
    it('should calculate reasonable Schroeder frequency', () => {
      const schroeder = calculateSchroederFrequency(testRoom, 0.3);
      
      // For a typical room, should be in the 100-300 Hz range
      expect(schroeder).toBeGreaterThan(50);
      expect(schroeder).toBeLessThan(500);
    });

    it('should increase with RT60', () => {
      const schroeder1 = calculateSchroederFrequency(testRoom, 0.2);
      const schroeder2 = calculateSchroederFrequency(testRoom, 0.5);
      
      expect(schroeder2).toBeGreaterThan(schroeder1);
    });
  });

  describe('assessModeDistribution', () => {
    it('should detect mode clusters', () => {
      const modes = calculateTheoreticalModes(testRoom, 200);
      const assessment = assessModeDistribution(modes);
      
      expect(assessment.mode_spacing_quality).toBeDefined();
      expect(['good', 'fair', 'poor']).toContain(assessment.mode_spacing_quality);
    });

    it('should identify problematic clusters', () => {
      // Create artificial cluster
      const modes = [
        { frequency_hz: 50, mode_type: 'axial' as const, dimension: 'L', order: 1, detected_in_measurement: false },
        { frequency_hz: 52, mode_type: 'axial' as const, dimension: 'W', order: 1, detected_in_measurement: false },
        { frequency_hz: 53, mode_type: 'tangential' as const, dimension: 'L-W', order: 11, detected_in_measurement: false },
        { frequency_hz: 54, mode_type: 'axial' as const, dimension: 'H', order: 1, detected_in_measurement: false },
        { frequency_hz: 100, mode_type: 'axial' as const, dimension: 'L', order: 2, detected_in_measurement: false }
      ];
      
      const assessment = assessModeDistribution(modes);
      
      expect(assessment.problematic_clusters.length).toBeGreaterThan(0);
      expect(assessment.mode_spacing_quality).toBe('poor');
    });

    it('should detect mode gaps', () => {
      const modes = [
        { frequency_hz: 40, mode_type: 'axial' as const, dimension: 'L', order: 1, detected_in_measurement: false },
        { frequency_hz: 80, mode_type: 'axial' as const, dimension: 'L', order: 2, detected_in_measurement: false }
      ];
      
      const assessment = assessModeDistribution(modes);
      
      expect(assessment.mode_gaps.length).toBeGreaterThan(0);
      expect(assessment.mode_gaps[0].range_hz[0]).toBe(40);
      expect(assessment.mode_gaps[0].range_hz[1]).toBe(80);
    });
  });
});

describe('Quick Stats Calculation', () => {
  it('should calculate band averages correctly', () => {
    const fr: FrequencyResponseData = {
      frequencies_hz: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
      spl_db: [85, 85, 84, 82, 80, 78, 76, 75, 74, 73],
      phase_degrees: Array(10).fill(0)
    };
    
    const stats = calculateQuickStats(fr);
    
    // Bass should be loudest
    expect(stats.bass_avg_db).toBeGreaterThan(stats.midrange_avg_db);
    expect(stats.midrange_avg_db).toBeGreaterThan(stats.treble_avg_db);
  });

  it('should calculate variance correctly', () => {
    const fr: FrequencyResponseData = {
      frequencies_hz: [20, 50, 100, 150],
      spl_db: [80, 95, 75, 90], // 20 dB variance (95 - 75)
      phase_degrees: Array(4).fill(0)
    };
    
    const stats = calculateQuickStats(fr);
    
    expect(stats.variance_20_200hz_db).toBe(20);
  });
});
