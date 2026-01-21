/**
 * Tests for REW Text Parser
 */

import { describe, it, expect } from 'vitest';
import { parseREWExport, detectFormat, parseFrequencyResponse } from './rew-text.js';

describe('REW Text Parser', () => {
  describe('detectFormat', () => {
    it('should detect frequency response format', () => {
      const content = `* Measurement: Test
* Freq(Hz) SPL(dB) Phase(degrees)
20.0 80.5 0
25.0 82.1 -5.2`;
      
      expect(detectFormat(content)).toBe('frequency_response');
    });

    it('should detect impulse response format', () => {
      const content = `* Impulse Response
* Time(s) Value
0.000 0.0
0.001 0.5`;
      
      expect(detectFormat(content)).toBe('impulse_response');
    });
  });

  describe('parseFrequencyResponse', () => {
    it('should parse valid frequency response data', () => {
      const content = `* REW V5.20
* Measurement: Left Speaker
* Freq(Hz) SPL(dB) Phase(degrees)
20.0 80.5 0.0
25.0 82.1 -5.2
31.5 81.8 -10.5
40.0 80.2 -15.1`;
      
      const result = parseFrequencyResponse(content);
      
      expect(result.frequency_response.frequencies_hz).toHaveLength(4);
      expect(result.frequency_response.frequencies_hz[0]).toBe(20.0);
      expect(result.frequency_response.spl_db[1]).toBe(82.1);
      expect(result.frequency_response.phase_degrees[2]).toBe(-10.5);
      // Only 4 data points = low confidence (< 10 points)
      expect(result.data_quality.confidence).toBe('low');
    });

    it('should handle European decimal format (comma)', () => {
      // European format uses tab or multiple spaces between columns
      const content = `* Freq(Hz) SPL(dB)
20,0\t80,5
25,0\t82,1`;

      const result = parseFrequencyResponse(content);

      expect(result.frequency_response.frequencies_hz[0]).toBe(20.0);
      expect(result.frequency_response.spl_db[0]).toBe(80.5);
    });

    describe('European decimal format (FNDN-12)', () => {
      // Note: parseNumber is internal, test via parseFrequencyResponse

      it('should handle European format with thousands separator (1.234,56)', () => {
        const content = `* Freq(Hz) SPL(dB)
1.234,56\t80,5
12.345,67\t82,1`;

        const result = parseFrequencyResponse(content);

        expect(result.frequency_response.frequencies_hz[0]).toBeCloseTo(1234.56, 2);
        expect(result.frequency_response.frequencies_hz[1]).toBeCloseTo(12345.67, 2);
        expect(result.frequency_response.spl_db[0]).toBeCloseTo(80.5, 1);
      });

      it('should handle negative European decimals', () => {
        const content = `* Freq(Hz) SPL(dB)
20,0\t-3,5
40,0\t-12,45`;

        const result = parseFrequencyResponse(content);

        expect(result.frequency_response.spl_db[0]).toBeCloseTo(-3.5, 1);
        expect(result.frequency_response.spl_db[1]).toBeCloseTo(-12.45, 2);
      });

      it('should handle European phase values', () => {
        const content = `* Freq(Hz) SPL(dB) Phase(degrees)
20,0\t80,5\t-45,5
40,0\t82,1\t-90,0`;

        const result = parseFrequencyResponse(content);

        expect(result.frequency_response.phase_degrees[0]).toBeCloseTo(-45.5, 1);
        expect(result.frequency_response.phase_degrees[1]).toBeCloseTo(-90.0, 1);
      });

      it('should handle whitespace around European numbers', () => {
        const content = `* Freq(Hz) SPL(dB)
  20,0  \t  80,5
  40,0  \t  82,1  `;

        const result = parseFrequencyResponse(content);

        expect(result.frequency_response.frequencies_hz[0]).toBe(20.0);
        expect(result.frequency_response.frequencies_hz[1]).toBe(40.0);
      });

      it('should handle zero in European format', () => {
        const content = `* Freq(Hz) SPL(dB)
20,0\t0,0
40,0\t0,00`;

        const result = parseFrequencyResponse(content);

        expect(result.frequency_response.spl_db[0]).toBe(0);
        expect(result.frequency_response.spl_db[1]).toBe(0);
      });

      it('should handle mixed US and European format in same file', () => {
        // This tests robustness - real files should be consistent but we handle edge cases
        const content = `* Freq(Hz) SPL(dB)
20.0\t80.5
40,0\t82,1`;

        const result = parseFrequencyResponse(content);

        expect(result.frequency_response.frequencies_hz[0]).toBe(20.0);
        expect(result.frequency_response.frequencies_hz[1]).toBe(40.0);
        expect(result.frequency_response.spl_db[0]).toBe(80.5);
        expect(result.frequency_response.spl_db[1]).toBe(82.1);
      });
    });

    it('should warn on insufficient data', () => {
      const content = `* Freq(Hz) SPL(dB)
20.0 80.5
25.0 82.1`;
      
      const result = parseFrequencyResponse(content);
      
      expect(result.data_quality.confidence).toBe('low');
      expect(result.data_quality.warnings).toContainEqual(
        expect.objectContaining({ type: 'insufficient_data' })
      );
    });

    it('should detect non-monotonic frequencies', () => {
      const content = `* Freq(Hz) SPL(dB)
20.0 80.5
25.0 82.1
20.0 81.0`;
      
      const result = parseFrequencyResponse(content);
      
      expect(result.data_quality.warnings).toContainEqual(
        expect.objectContaining({ type: 'non_monotonic' })
      );
    });

    it('should extract metadata from comments', () => {
      const content = `* REW V5.20
* Measurement: Left Speaker Pre-GLM
* Date: 2024-01-15
* Freq(Hz) SPL(dB)
20.0 80.5`;
      
      const result = parseFrequencyResponse(content);
      
      expect(result.parsed_metadata.rew_version).toBe('5.20');
      expect(result.parsed_metadata.measurement_name).toBe('Left Speaker Pre-GLM');
      expect(result.parsed_metadata.export_date).toContain('2024-01-15');
    });
  });

  describe('parseREWExport', () => {
    it('should auto-detect and parse frequency response', () => {
      const content = `* Freq(Hz) SPL(dB)
20.0 80.5
25.0 82.1
31.5 81.8`;
      
      const result = parseREWExport(content);
      
      expect(result.frequency_response.frequencies_hz).toHaveLength(3);
      expect(result.impulse_response).toBeUndefined();
    });

    it('should handle unknown format gracefully', () => {
      const content = `Some random text
Not a valid REW export`;
      
      const result = parseREWExport(content);
      
      expect(result.data_quality.confidence).toBe('low');
      expect(result.data_quality.warnings).toContainEqual(
        expect.objectContaining({ type: 'unknown_format' })
      );
    });
  });
});
