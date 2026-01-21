/**
 * REW API Client Integration Tests
 *
 * Tests API client methods using MSW for HTTP-level mocking.
 * Validates FNDN-03, FNDN-04, FNDN-07, FNDN-09 requirements.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { REWApiClient } from './rew-client.js';
import { REWApiError } from './rew-api-error.js';
import { encodeREWFloatArray } from './base64-decoder.js';

// MSW server with default handlers (can be overridden per test)
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('REWApiClient', () => {
  describe('connect()', () => {
    it('should connect successfully when REW is running', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({
            info: { version: '5.30.9' },
            openapi: '3.0.0',
            paths: {}
          });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([
            { uuid: 'test-1', name: 'Left', type: 'SPL' }
          ]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return HttpResponse.json({ version: '5.30.9', proFeatures: true });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(true);
      expect(status.rew_version).toBe('5.30.9');
      expect(status.measurements_available).toBe(1);
      expect(status.api_capabilities.pro_features).toBe(true);
    });

    it('should return error status when REW not running (connection refused)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.error();  // Network error
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(false);
      expect(status.error_message).toContain('Cannot connect to REW');
    });

    it('should return error status when API endpoint not found (404)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(false);
      expect(status.error_message).toContain('HTTP 404');
      expect(status.error_message).toContain('too old');
    });

    it('should handle partial API availability (measurements endpoint missing)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(false);
      expect(status.error_message).toContain('/measurements endpoint not found');
    });
  });

  describe('listMeasurements()', () => {
    it('should return measurement list when successful', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([
            { uuid: 'uuid-1', name: 'Left Main', type: 'SPL', index: 0 },
            { uuid: 'uuid-2', name: 'Right Main', type: 'SPL', index: 1 }
          ]);
        })
      );

      const client = new REWApiClient();
      const measurements = await client.listMeasurements();

      expect(measurements).toHaveLength(2);
      expect(measurements[0].uuid).toBe('uuid-1');
      expect(measurements[0].name).toBe('Left Main');
    });

    it('should return empty array when no measurements exist', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        })
      );

      const client = new REWApiClient();
      const measurements = await client.listMeasurements();

      expect(measurements).toHaveLength(0);
      expect(Array.isArray(measurements)).toBe(true);
    });

    it('should return empty array on network error (graceful degradation)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.error();
        })
      );

      const client = new REWApiClient();
      const measurements = await client.listMeasurements();

      expect(measurements).toHaveLength(0);
    });
  });

  describe('getMeasurement()', () => {
    it('should return measurement data when found', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid', ({ params }) => {
          return HttpResponse.json({
            uuid: params.uuid,
            name: 'Left Main',
            sampleRate: 48000,
            startTime: '2026-01-21T10:00:00Z',
            notes: 'Test measurement'
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getMeasurement('test-uuid-1');

      expect(data.uuid).toBe('test-uuid-1');
      expect(data.name).toBe('Left Main');
      expect(data.metadata.sample_rate_hz).toBe(48000);
    });

    it('should throw NOT_FOUND when measurement does not exist', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();

      await expect(client.getMeasurement('nonexistent')).rejects.toThrow(REWApiError);

      try {
        await client.getMeasurement('nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(REWApiError);
        expect((error as REWApiError).code).toBe('NOT_FOUND');
        expect((error as REWApiError).httpStatus).toBe(404);
      }
    });

    it('should throw CONNECTION_REFUSED on network error', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
          return HttpResponse.error();
        })
      );

      const client = new REWApiClient();

      await expect(client.getMeasurement('any')).rejects.toMatchObject({
        code: 'CONNECTION_REFUSED',
        httpStatus: 0
      });
    });
  });

  describe('getImpulseResponse() (FNDN-07)', () => {
    it('should return impulse response data when found (FNDN-07)', async () => {
      // Create Base64-encoded float32 array for impulse samples (REW API format - big-endian)
      const samples = [0, 0.1, 0.8, 0.3, 0.05];
      const samplesBase64 = encodeREWFloatArray(samples);

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/impulse-response', () => {
          return HttpResponse.json({
            samples: samplesBase64,
            sampleRate: 48000,
            startTime: 0
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getImpulseResponse('test-uuid');

      expect(data).toBeDefined();
      expect(data.samples).toHaveLength(5);
      expect(data.sample_rate_hz).toBe(48000);

      // Verify values decoded correctly
      expect(data.samples[0]).toBeCloseTo(0, 4);
      expect(data.samples[2]).toBeCloseTo(0.8, 2);

      // Verify peak detection
      expect(data.peak_index).toBe(2); // Index of 0.8
    });

    it('should throw NOT_FOUND when measurement does not exist', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/impulse-response', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();

      await expect(client.getImpulseResponse('nonexistent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        httpStatus: 404
      });
    });

    it('should throw CONNECTION_REFUSED on network error', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/impulse-response', () => {
          return HttpResponse.error();
        })
      );

      const client = new REWApiClient();

      await expect(client.getImpulseResponse('any')).rejects.toMatchObject({
        code: 'CONNECTION_REFUSED',
        httpStatus: 0
      });
    });
  });

  describe('getFrequencyResponse()', () => {
    it('should decode base64 float arrays from REW API', async () => {
      // Create Base64-encoded float32 arrays (REW API format - big-endian)
      const frequencies = [20, 50, 100, 200, 500];
      const magnitude = [75, 78, 80, 79, 77];
      const phase = [0, -10, -20, -30, -45];

      const freqBase64 = encodeREWFloatArray(frequencies);
      const magBase64 = encodeREWFloatArray(magnitude);
      const phaseBase64 = encodeREWFloatArray(phase);

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.json({
            frequencies: freqBase64,
            magnitude: magBase64,
            phase: phaseBase64
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getFrequencyResponse('test-uuid');

      expect(data.frequencies_hz).toHaveLength(5);
      expect(data.spl_db).toHaveLength(5);
      expect(data.phase_degrees).toHaveLength(5);

      // Verify values decoded correctly
      expect(data.frequencies_hz[0]).toBeCloseTo(20, 1);
      expect(data.frequencies_hz[4]).toBeCloseTo(500, 1);
      expect(data.spl_db[2]).toBeCloseTo(80, 1);
      expect(data.phase_degrees[4]).toBeCloseTo(-45, 1);
    });

    it('should handle large frequency response arrays', async () => {
      // Typical REW measurement has 4096+ points
      const length = 4096;
      const frequencies: number[] = [];
      const magnitude: number[] = [];
      const phase: number[] = [];

      for (let i = 0; i < length; i++) {
        frequencies[i] = 20 * Math.pow(10, (i / length) * 3);  // Log scale 20Hz-20kHz
        magnitude[i] = 75 + Math.sin(i / 100) * 10;
        phase[i] = -i * 0.1;
      }

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.json({
            frequencies: encodeREWFloatArray(frequencies),
            magnitude: encodeREWFloatArray(magnitude),
            phase: encodeREWFloatArray(phase)
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getFrequencyResponse('test-uuid');

      expect(data.frequencies_hz).toHaveLength(4096);
      expect(data.spl_db).toHaveLength(4096);
      expect(data.phase_degrees).toHaveLength(4096);

      // Verify first and last values
      expect(data.frequencies_hz[0]).toBeCloseTo(20, 0);
      expect(data.frequencies_hz[4095]).toBeCloseTo(20000, -2);  // Approx 20kHz
    });

    it('should throw NOT_FOUND when measurement does not exist', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();

      await expect(client.getFrequencyResponse('nonexistent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        httpStatus: 404
      });
    });

    it('should throw CONNECTION_REFUSED on network error', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.error();
        })
      );

      const client = new REWApiClient();

      await expect(client.getFrequencyResponse('any')).rejects.toMatchObject({
        code: 'CONNECTION_REFUSED',
        httpStatus: 0
      });
    });

    it('should handle smoothing option in request', async () => {
      let capturedUrl: string | undefined;

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', ({ request }) => {
          capturedUrl = request.url;
          const freq = encodeREWFloatArray([100]);
          return HttpResponse.json({
            frequencies: freq,
            magnitude: freq,
            phase: freq
          });
        })
      );

      const client = new REWApiClient();
      await client.getFrequencyResponse('test', { smoothing: '1/3' });

      // URL encoding converts '/' to '%2F'
      expect(capturedUrl).toContain('smoothing=1%2F3');
    });

    it('should handle 1/6 octave smoothing option', async () => {
      let capturedUrl: string | undefined;

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', ({ request }) => {
          capturedUrl = request.url;
          const freq = encodeREWFloatArray([100]);
          return HttpResponse.json({
            frequencies: freq,
            magnitude: freq,
            phase: freq
          });
        })
      );

      const client = new REWApiClient();
      await client.getFrequencyResponse('test', { smoothing: '1/6' });

      // URL encoding converts '/' to '%2F'
      expect(capturedUrl).toContain('smoothing=1%2F6');
    });

    it('should work without smoothing option (raw data)', async () => {
      let capturedUrl: string | undefined;

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', ({ request }) => {
          capturedUrl = request.url;
          const freq = encodeREWFloatArray([100]);
          return HttpResponse.json({
            frequencies: freq,
            magnitude: freq,
            phase: freq
          });
        })
      );

      const client = new REWApiClient();
      await client.getFrequencyResponse('test');

      // Should not have smoothing parameter
      expect(capturedUrl).not.toContain('smoothing=');
    });

    it('should handle empty frequency response gracefully', async () => {
      // Edge case: measurement exists but has no data points
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          const empty = encodeREWFloatArray([]);
          return HttpResponse.json({
            frequencies: empty,
            magnitude: empty,
            phase: empty
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getFrequencyResponse('test');

      expect(data.frequencies_hz).toHaveLength(0);
      expect(data.spl_db).toHaveLength(0);
      expect(data.phase_degrees).toHaveLength(0);
    });
  });
});
