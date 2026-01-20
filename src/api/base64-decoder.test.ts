/**
 * Base64 Decoder Tests
 */

import { describe, it, expect } from 'vitest';
import {
  decodeREWFloatArray,
  encodeREWFloatArray,
  isValidREWBase64
} from './base64-decoder.js';

describe('REW Base64 Decoder', () => {
  describe('decodeREWFloatArray', () => {
    it('should decode REW documentation example correctly', () => {
      // Per REW docs:
      // Base64: PgAAAD6AAAA+wAAAPwAAAA==
      // Result: {0.125f, 0.25f, 0.375f, 0.5f}
      const base64 = 'PgAAAD6AAAA+wAAAPwAAAA==';
      const result = decodeREWFloatArray(base64);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBeCloseTo(0.125, 5);
      expect(result[1]).toBeCloseTo(0.25, 5);
      expect(result[2]).toBeCloseTo(0.375, 5);
      expect(result[3]).toBeCloseTo(0.5, 5);
    });

    it('should handle empty string', () => {
      const result = decodeREWFloatArray('');
      expect(result).toEqual([]);
    });

    it('should handle single float', () => {
      // Encode a known float and decode it
      const original = [1.0];
      const encoded = encodeREWFloatArray(original);
      const decoded = decodeREWFloatArray(encoded);
      
      expect(decoded).toHaveLength(1);
      expect(decoded[0]).toBeCloseTo(1.0, 5);
    });

    it('should handle negative values', () => {
      const original = [-1.0, -0.5, 0.0, 0.5, 1.0];
      const encoded = encodeREWFloatArray(original);
      const decoded = decodeREWFloatArray(encoded);
      
      expect(decoded).toHaveLength(5);
      for (let i = 0; i < original.length; i++) {
        expect(decoded[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('should handle large arrays', () => {
      const original = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 100));
      const encoded = encodeREWFloatArray(original);
      const decoded = decodeREWFloatArray(encoded);
      
      expect(decoded).toHaveLength(1000);
      for (let i = 0; i < original.length; i++) {
        expect(decoded[i]).toBeCloseTo(original[i], 4);
      }
    });

    it('should handle typical SPL values', () => {
      const splValues = [60.0, 70.5, 80.25, 90.125];
      const encoded = encodeREWFloatArray(splValues);
      const decoded = decodeREWFloatArray(encoded);
      
      expect(decoded).toHaveLength(4);
      for (let i = 0; i < splValues.length; i++) {
        expect(decoded[i]).toBeCloseTo(splValues[i], 2);
      }
    });

    it('should handle typical frequency values', () => {
      const frequencies = [20.0, 100.0, 1000.0, 10000.0, 20000.0];
      const encoded = encodeREWFloatArray(frequencies);
      const decoded = decodeREWFloatArray(encoded);
      
      expect(decoded).toHaveLength(5);
      for (let i = 0; i < frequencies.length; i++) {
        expect(decoded[i]).toBeCloseTo(frequencies[i], 1);
      }
    });
  });

  describe('encodeREWFloatArray', () => {
    it('should handle empty array', () => {
      const result = encodeREWFloatArray([]);
      expect(result).toBe('');
    });

    it('should be reversible', () => {
      const original = [1.5, 2.5, 3.5, 4.5];
      const encoded = encodeREWFloatArray(original);
      const decoded = decodeREWFloatArray(encoded);
      
      expect(decoded).toHaveLength(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(decoded[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('should produce valid base64', () => {
      const original = [1.0, 2.0, 3.0];
      const encoded = encodeREWFloatArray(original);
      
      // Base64 should only contain valid characters
      expect(encoded).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });

  describe('isValidREWBase64', () => {
    it('should return true for valid REW base64', () => {
      const valid = encodeREWFloatArray([1.0, 2.0, 3.0, 4.0]);
      expect(isValidREWBase64(valid)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isValidREWBase64('')).toBe(true);
    });

    it('should return false for invalid base64', () => {
      expect(isValidREWBase64('not-valid-base64!!!')).toBe(false);
    });

    it('should return false for base64 not divisible by 4 bytes', () => {
      // Create base64 that decodes to 3 bytes (not divisible by 4)
      const threeBytes = Buffer.from([1, 2, 3]).toString('base64');
      expect(isValidREWBase64(threeBytes)).toBe(false);
    });

    it('should return true for REW documentation example', () => {
      expect(isValidREWBase64('PgAAAD6AAAA+wAAAPwAAAA==')).toBe(true);
    });
  });
});
