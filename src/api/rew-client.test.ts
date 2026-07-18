/**
 * REW API Client Integration Tests
 *
 * Tests API client methods using MSW for HTTP-level mocking.
 * Validates FNDN-03, FNDN-04, FNDN-07, FNDN-09 requirements.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { REWApiClient, checkApiCompatibility, SUPPORTED_API_VERSION } from './rew-client.js';
import { REWApiError } from './rew-api-error.js';
import { encodeREWFloatArray } from './base64-decoder.js';

// MSW server with default handlers (can be overridden per test)
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('checkApiCompatibility', () => {
  it('accepts the exact supported version', () => {
    const r = checkApiCompatibility(SUPPORTED_API_VERSION);
    expect(r.supported).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it('accepts a patch-level difference with a note', () => {
    const r = checkApiCompatibility('0.9.9');
    expect(r.supported).toBe(true);
    expect(r.warning).toContain('patch level');
  });

  it('rejects a major.minor difference', () => {
    const r = checkApiCompatibility('1.0.0');
    expect(r.supported).toBe(false);
    expect(r.warning).toContain('not supported');
  });

  it('rejects a missing version', () => {
    const r = checkApiCompatibility(undefined);
    expect(r.supported).toBe(false);
    expect(r.warning).toContain('Could not determine');
  });
});

describe('REWApiClient', () => {
  describe('connect()', () => {
    it('should connect successfully when REW is running', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.json({ message: '5.30.9 API 0.9.5' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([
            { uuid: 'test-1', name: 'Left', type: 'SPL' }
          ]);
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(true);
      expect(status.rew_version).toBe('5.30.9');
      expect(status.api_version).toBe('0.9.5');
      expect(status.api_version_supported).toBe(true);
      expect(status.compatibility_warning).toBeUndefined();
      expect(status.measurements_available).toBe(1);
      // Pro features are not detectable via the REST API (no endpoint); always false.
      expect(status.api_capabilities.pro_features).toBe(false);
      // Blocking capability is derived from GET /application/blocking (200).
      expect(status.api_capabilities.blocking_mode).toBe(true);
    });

    it('should flag an unsupported API version but still connect', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.json({ message: '6.0 API 1.2.0' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json({ '1': { uuid: 'u1', title: 'M1' } });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => new HttpResponse(null, { status: 404 }))
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(true);
      expect(status.api_version).toBe('1.2.0');
      expect(status.api_version_supported).toBe(false);
      expect(status.compatibility_warning).toContain('1.2.0');
    });

    it('should hard-fail on an unexpected /measurements response shape', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.json({ message: '5.40 API 0.9.5' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json('not-an-object');
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(false);
      expect(status.error_message).toContain('Unexpected /measurements response shape');
    });

    it('should return error status when REW not running (connection refused)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
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
        http.get('http://127.0.0.1:4735/version', () => {
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
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.json({ message: '5.30.9 API 0.9.5' });
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

    it('should parse REW index-keyed object response with title field', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements', () => {
          // Real REW returns an object keyed by 1-based index, using `title`.
          return HttpResponse.json({
            '1': { uuid: 'uuid-1', title: 'Measurement One' },
            '2': { uuid: 'uuid-2', title: 'Measurement Two' }
          });
        })
      );

      const client = new REWApiClient();
      const measurements = await client.listMeasurements();

      expect(measurements).toHaveLength(2);
      expect(measurements[0].uuid).toBe('uuid-1');
      expect(measurements[0].name).toBe('Measurement One');
      expect(measurements[0].index).toBe(1);
      expect(measurements[1].name).toBe('Measurement Two');
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
    it('should return impulse response data using REW API "data" field', async () => {
      // Create Base64-encoded float32 array for impulse samples (REW API format - big-endian)
      const samples = [0, 0.1, 0.8, 0.3, 0.05];
      const samplesBase64 = encodeREWFloatArray(samples);

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/impulse-response', () => {
          // REW API spec: field is 'data' not 'samples'
          return HttpResponse.json({
            data: samplesBase64,
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

    it('should also accept legacy "samples" field for backward compatibility', async () => {
      // Test backward compatibility with 'samples' field
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

  describe('Audio device methods', () => {
    it('should get audio driver', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/driver', () => {
          return HttpResponse.json({ driver: 'CoreAudio' });
        })
      );
      const client = new REWApiClient();
      const driver = await client.getAudioDriver();
      expect(driver).toBe('CoreAudio');
    });

    it('should get Java input devices', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/java/input-devices', () => {
          return HttpResponse.json(['Device 1', 'Device 2']);
        })
      );
      const client = new REWApiClient();
      const devices = await client.getJavaInputDevices();
      expect(devices).toEqual(['Device 1', 'Device 2']);
    });

    it('should get Java output devices', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/java/output-devices', () => {
          return HttpResponse.json(['Output 1', 'Output 2']);
        })
      );
      const client = new REWApiClient();
      const devices = await client.getJavaOutputDevices();
      expect(devices).toEqual(['Output 1', 'Output 2']);
    });

    it('should set Java input device', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/audio/java/input-device', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setJavaInputDevice('Device 1');
      expect(result).toBe(true);
    });

    it('should set Java output device', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/audio/java/output-device', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setJavaOutputDevice('Output 1');
      expect(result).toBe(true);
    });
  });

  describe('Sample rate methods', () => {
    it('should get sample rate', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/samplerate', () => {
          return HttpResponse.json({ value: 48000, unit: 'Hz' });
        })
      );
      const client = new REWApiClient();
      const rate = await client.getSampleRate();
      expect(rate).toBe(48000);
    });

    it('should set sample rate', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/audio/samplerate', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setSampleRate(96000);
      expect(result).toBe(true);
    });

    it('should list available sample rates', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/samplerates', () => {
          return HttpResponse.json([
            { value: 44100, unit: 'Hz' },
            { value: 48000, unit: 'Hz' },
            { value: 96000, unit: 'Hz' },
          ]);
        })
      );
      const client = new REWApiClient();
      const rates = await client.getAvailableSampleRates();
      expect(rates).toEqual([44100, 48000, 96000]);
    });
  });

  describe('Measurement data retrieval', () => {
    it('should get waterfall data from the Generate waterfall ProcessResult', async () => {
      const processResult = {
        processName: 'Generate waterfall ID 1',
        message: 'Completed',
        results: {
          '0': {
            '0': encodeREWFloatArray([80, 75, 70]),
            '1': encodeREWFloatArray([78, NaN, 68]),
            Frequencies: encodeREWFloatArray([20, 50, 100]),
            Times: encodeREWFloatArray([0, 0.1])
          }
        }
      };
      let commandBody: unknown;
      let blockingEnabled = false;
      server.use(
        http.get('http://127.0.0.1:4735/application/blocking', () =>
          HttpResponse.json(blockingEnabled)
        ),
        http.post('http://127.0.0.1:4735/application/blocking', async ({ request }) => {
          blockingEnabled = (await request.json()) === true;
          return HttpResponse.json({ message: 'Blocking updated' });
        }),
        http.post('http://127.0.0.1:4735/measurements/test-uuid/command', async ({ request }) => {
          commandBody = await request.json();
          return HttpResponse.json({ message: JSON.stringify(processResult) });
        })
      );

      const client = new REWApiClient();
      const waterfall = await client.getWaterfallData('test-uuid');

      expect((commandBody as { command: string }).command).toBe('Generate waterfall');
      expect(waterfall.frequencies_hz).toEqual([20, 50, 100]);
      expect(waterfall.time_slices_ms[0]).toBeCloseTo(0, 3);
      expect(waterfall.time_slices_ms[1]).toBeCloseTo(100, 3);
      expect(waterfall.magnitude_db).toHaveLength(2);
      expect(waterfall.magnitude_db[0]).toEqual([80, 75, 70]);
      // NaN bins are floored to -200 dB to keep the matrix finite.
      expect(waterfall.magnitude_db[1][1]).toBe(-200);
      // Blocking mode is restored to its previous (disabled) state.
      expect(blockingEnabled).toBe(false);
    });

    it('should get RT60 data from the frequency-keyed result map', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/test-uuid/rt60', () => {
          return HttpResponse.json({
            '0.0': { fc: 0.0, octaveFrac: 1, EDT: 0.5, T20: 0.4, T30: 0.45, Topt: 0.6 },
            '125.0': { fc: 125.0, octaveFrac: 1, EDT: 0.32, T20: 0.3, T30: 0.35, Topt: 0.36 },
            '250.0': { fc: 250.0, octaveFrac: 1, EDT: 0.26, T20: 0.25, T30: 0.28, Topt: 0.29 },
            '500.0': { fc: 500.0, octaveFrac: 1, EDT: 0.21, T20: 0.2, T30: 0.22, Topt: 0.23 }
          });
        })
      );
      const client = new REWApiClient();
      const rt60 = await client.getRT60('test-uuid');
      // Bands are sorted by centre frequency; the broadband "0.0" band sorts first.
      expect(rt60.frequencies_hz).toEqual([0, 125, 250, 500]);
      expect(rt60.t30_seconds[1]).toBeCloseTo(0.35, 2);
      expect(rt60.t30_seconds[2]).toBeCloseTo(0.28, 2);
      expect(rt60.t20_seconds[1]).toBeCloseTo(0.3, 2);
      expect(rt60.edt_seconds[1]).toBeCloseTo(0.32, 2);
      expect(rt60.topt_seconds?.[1]).toBeCloseTo(0.36, 2);
    });

    it('should pass octaveFrac parameter to RT60 endpoint', async () => {
      let capturedUrl: string | undefined;
      server.use(
        http.get('http://127.0.0.1:4735/measurements/test-uuid/rt60', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            '125.0': { fc: 125.0, octaveFrac: 3, EDT: 0.32, T20: 0.3, T30: 0.35 }
          });
        })
      );
      const client = new REWApiClient();
      await client.getRT60('test-uuid', { octaveFrac: 3 });
      expect(capturedUrl).toContain('octaveFrac=3');
    });

    it('should handle third octave format for octaveFrac', async () => {
      let capturedUrl: string | undefined;
      server.use(
        http.get('http://127.0.0.1:4735/measurements/test-uuid/rt60', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            '125.0': { fc: 125.0, octaveFrac: 3, EDT: 0.32, T20: 0.3, T30: 0.35 }
          });
        })
      );
      const client = new REWApiClient();
      await client.getRT60('test-uuid', { octaveFrac: '1/3' });
      // URL encoding converts '/' to '%2F'
      expect(capturedUrl).toContain('octaveFrac=1%2F3');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle timeout', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', async () => {
          await new Promise(resolve => setTimeout(resolve, 15000));
          return HttpResponse.json({});
        })
      );
      const client = new REWApiClient();
      const status = await client.connect();
      expect(status.connected).toBe(false);
      expect(status.error_message).toBeDefined();
    }, 12000); // Set test timeout to 12 seconds

    it('should handle malformed JSON response gracefully', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements', () => {
          return new HttpResponse('not json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      const client = new REWApiClient();
      // Client handles JSON parse errors by returning empty array (graceful degradation)
      const measurements = await client.listMeasurements();
      expect(measurements).toEqual([]);
    });

    it('should handle empty measurement list gracefully', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        })
      );
      const client = new REWApiClient();
      const measurements = await client.listMeasurements();
      expect(measurements).toEqual([]);
    });
  });

  describe('getFrequencyResponse()', () => {
    it('should compute frequencies from startFrequency and ppo (REW API spec)', async () => {
      // Per REW API: frequencies computed from startFrequency + pointsPerOctave
      const magnitude = [75, 78, 80, 79, 77];
      const phase = [0, -10, -20, -30, -45];

      const magBase64 = encodeREWFloatArray(magnitude);
      const phaseBase64 = encodeREWFloatArray(phase);

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.json({
            startFrequency: 20,
            pointsPerOctave: 12,  // 12 PPO = standard
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

      // Verify frequency computation: freq[i] = startFreq * 2^(i/ppo)
      // At 12 PPO, each step is 2^(1/12) = 1.0595 (semitone)
      expect(data.frequencies_hz[0]).toBeCloseTo(20, 1);
      expect(data.frequencies_hz[1]).toBeCloseTo(20 * Math.exp(1 * Math.log(2) / 12), 2);
    });

    it('should compute frequencies from startFrequency and freqStep (linear)', async () => {
      // Per REW API: linear-spaced uses freqStep
      const magnitude = [75, 78, 80, 79, 77];
      const magBase64 = encodeREWFloatArray(magnitude);

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.json({
            startFrequency: 20,
            freqStep: 10,  // 10 Hz steps
            magnitude: magBase64
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getFrequencyResponse('test-uuid');

      expect(data.frequencies_hz).toHaveLength(5);
      expect(data.frequencies_hz[0]).toBeCloseTo(20, 1);
      expect(data.frequencies_hz[1]).toBeCloseTo(30, 1);
      expect(data.frequencies_hz[2]).toBeCloseTo(40, 1);
      expect(data.frequencies_hz[3]).toBeCloseTo(50, 1);
      expect(data.frequencies_hz[4]).toBeCloseTo(60, 1);
    });

    it('should fallback to frequencies array if provided (backward compatibility)', async () => {
      // Fallback: if frequencies array is directly provided
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

  describe('Measurement control methods', () => {
    it('should get measure commands', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/commands', () => {
          return HttpResponse.json(['Measure', 'SPL', 'Cancel']);
        })
      );
      const client = new REWApiClient();
      const commands = await client.getMeasureCommands();
      expect(commands).toEqual(['Measure', 'SPL', 'Cancel']);
    });

    it('should execute measure command', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/command', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.executeMeasureCommand('Measure');
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });

    it('should get measure level', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/level', () => {
          return HttpResponse.json({ level: -12, unit: 'dBFS' });
        })
      );
      const client = new REWApiClient();
      const level = await client.getMeasureLevel();
      expect(level.level).toBe(-12);
      expect(level.unit).toBe('dBFS');
    });

    it('should set measure level', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/level', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setMeasureLevel(-18, 'dBFS');
      expect(result).toBe(true);
    });

    it('should get sweep config', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/sweep/configuration', () => {
          return HttpResponse.json({
            startFreq: 20,
            endFreq: 20000,
            length: 256,
            fillSilenceWithDither: false
          });
        })
      );
      const client = new REWApiClient();
      const config = await client.getSweepConfig();
      expect(config.startFreq).toBe(20);
      expect(config.endFreq).toBe(20000);
    });

    it('should set sweep config', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/sweep/configuration', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setSweepConfig({ startFreq: 10, endFreq: 24000 });
      expect(result).toBe(true);
    });
  });

  describe('Generator methods', () => {
    it('should get generator status', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/signal', () => {
          return HttpResponse.json({ signal: 'pinknoise' });
        }),
        http.get('http://127.0.0.1:4735/generator/level', () => {
          return HttpResponse.json({ value: -18, unit: 'dBFS' });
        }),
        http.get('http://127.0.0.1:4735/generator/commands', () => {
          return HttpResponse.json(['Play', 'Stop']);
        })
      );
      const client = new REWApiClient();
      const status = await client.getGeneratorStatus();
      expect(status.signal).toBe('pinknoise');
      expect(status.level).toBe(-18);
      expect(status.level_unit).toBe('dBFS');
      expect(status.available_commands).toEqual(['Play', 'Stop']);
    });

    it('should get available generator signals', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/signals', () => {
          return HttpResponse.json(['pinknoise', 'whitenoise', 'sine']);
        })
      );
      const client = new REWApiClient();
      const signals = await client.getGeneratorSignals();
      expect(signals).toEqual(['pinknoise', 'whitenoise', 'sine']);
    });

    it('should set generator signal via POST with a Signal body', async () => {
      let body: unknown;
      server.use(
        http.post('http://127.0.0.1:4735/generator/signal', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ message: 'pinknoise selected' });
        })
      );
      const client = new REWApiClient();
      const result = await client.setGeneratorSignal('pinknoise');
      expect(result).toBe(true);
      expect(body).toEqual({ signal: 'pinknoise' });
    });

    it('should get generator level as a Value { value, unit }', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/level', () => {
          return HttpResponse.json({ value: -18, unit: 'dBFS' });
        })
      );
      const client = new REWApiClient();
      const level = await client.getGeneratorLevel();
      expect(level.value).toBe(-18);
      expect(level.unit).toBe('dBFS');
    });

    it('should set generator frequency', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/generator/frequency', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setGeneratorFrequency(1000);
      expect(result).toBe(true);
    });

    it('should execute generator command', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/generator/command', () => {
          return new HttpResponse(null, { status: 202 });
        })
      );
      const client = new REWApiClient();
      const result = await client.executeGeneratorCommand('Play');
      expect(result).toBe(true);
    });
  });

  describe('SPL meter methods', () => {
    it('should get SPL meter levels as SPLValues', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/spl-meter/1/levels', () => {
          return HttpResponse.json({
            meterNumber: 1,
            spl: 75.5,
            leq: 74.2,
            sel: 73.8,
            splWeighting: 'A',
            leqWeighting: 'A',
            selWeighting: 'A',
            filter: 'Fast'
          });
        })
      );
      const client = new REWApiClient();
      const levels = await client.getSPLMeterLevels(1);
      expect(levels.spl).toBe(75.5);
      expect(levels.splWeighting).toBe('A');
      expect(levels.filter).toBe('Fast');
    });

    it('should expand the weighting alias into the three weighting fields', async () => {
      let body: Record<string, unknown> | undefined;
      server.use(
        http.post('http://127.0.0.1:4735/spl-meter/1/configuration', async ({ request }) => {
          body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ message: 'ok' });
        })
      );
      const client = new REWApiClient();
      const result = await client.setSPLMeterConfig(1, { weighting: 'C', filter: 'Slow' });
      expect(result).toBe(true);
      expect(body).toEqual({ splWeighting: 'C', leqWeighting: 'C', selWeighting: 'C', filter: 'Slow' });
      // The friendly `weighting` alias must not leak into the posted body.
      expect(body).not.toHaveProperty('weighting');
    });

    it('should expand the mode alias into the show flags', async () => {
      let body: Record<string, unknown> | undefined;
      server.use(
        http.post('http://127.0.0.1:4735/spl-meter/1/configuration', async ({ request }) => {
          body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ message: 'ok' });
        })
      );
      const client = new REWApiClient();
      await client.setSPLMeterConfig(1, { mode: 'Leq' });
      expect(body).toEqual({ showSPL: false, showLeq: true, showSEL: false });
    });

    it('should execute SPL meter command', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/spl-meter/1/command', () => {
          return new HttpResponse(null, { status: 202 });
        })
      );
      const client = new REWApiClient();
      const result = await client.executeSPLMeterCommand(1, 'Start');
      expect(result).toBe(true);
    });
  });

  describe('Blocking mode methods', () => {
    it('should get blocking mode status', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return HttpResponse.json(true);
        })
      );
      const client = new REWApiClient();
      const enabled = await client.getBlockingMode();
      expect(enabled).toBe(true);
    });

    it('should set blocking mode', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/application/blocking', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setBlockingMode(true);
      expect(result).toBe(true);
    });
  });

  describe('Health check method', () => {
    it('should return healthy status when API available', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.json({ message: '5.30.9 API 0.9.5' });
        }),
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({
            info: { version: '0.9.5' },
            openapi: '3.0.0'
          });
        })
      );
      const client = new REWApiClient();
      const health = await client.healthCheck();
      expect(health.server_responding).toBe(true);
      expect(health.openapi_available).toBe(true);
      expect(health.rew_version).toBe('5.30.9');
      expect(health.api_version).toBe('0.9.5');
    });

    it('should return error when server not responding', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.error();
        })
      );
      const client = new REWApiClient();
      const health = await client.healthCheck();
      expect(health.server_responding).toBe(false);
      expect(health.openapi_available).toBe(false);
      expect(health.suggestion).toBeDefined();
    });
  });

  describe('Input calibration methods', () => {
    it('should get input calibration', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/input-cal', () => {
          return HttpResponse.json({
            enabled: true,
            filename: 'cal.txt',
            offset: 94.0
          });
        })
      );
      const client = new REWApiClient();
      const cal = await client.getInputCalibration();
      expect(cal).not.toBeNull();
      expect(cal?.enabled).toBe(true);
    });

    it('should return null when calibration not available', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/input-cal', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );
      const client = new REWApiClient();
      const cal = await client.getInputCalibration();
      expect(cal).toBeNull();
    });
  });

  describe('Additional audio methods', () => {
    it('should get audio status', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/status', () => {
          return HttpResponse.json({
            enabled: true,
            ready: true
          });
        })
      );
      const client = new REWApiClient();
      const status = await client.getAudioStatus();
      expect(status.enabled).toBe(true);
      expect(status.ready).toBe(true);
    });

    it('should get audio driver types', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/driver-types', () => {
          return HttpResponse.json(['CoreAudio', 'ASIO', 'Java']);
        })
      );
      const client = new REWApiClient();
      const types = await client.getAudioDriverTypes();
      expect(types).toEqual(['CoreAudio', 'ASIO', 'Java']);
    });

    it('should get current Java input device', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/java/input-device', () => {
          return HttpResponse.json({ device: 'Built-in Microphone' });
        })
      );
      const client = new REWApiClient();
      const device = await client.getJavaInputDevice();
      expect(device).toBe('Built-in Microphone');
    });

    it('should get current Java output device', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/java/output-device', () => {
          return HttpResponse.json({ device: 'Built-in Output' });
        })
      );
      const client = new REWApiClient();
      const device = await client.getJavaOutputDevice();
      expect(device).toBe('Built-in Output');
    });
  });

  describe('Additional generator methods', () => {
    it('should get generator signal from a Signal object', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/signal', () => {
          return HttpResponse.json({ signal: 'pinknoise' });
        })
      );
      const client = new REWApiClient();
      const signal = await client.getGeneratorSignal();
      expect(signal).toBe('pinknoise');
    });

    it('should get generator frequency from a Value object', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/frequency', () => {
          return HttpResponse.json({ value: 1000, unit: 'Hz' });
        })
      );
      const client = new REWApiClient();
      const freq = await client.getGeneratorFrequency();
      expect(freq).toBe(1000);
    });

    it('should return 0 generator frequency when value is omitted (noise)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/frequency', () => {
          return HttpResponse.json({ unit: 'Hz' });
        })
      );
      const client = new REWApiClient();
      const freq = await client.getGeneratorFrequency();
      expect(freq).toBe(0);
    });

    it('should set generator level', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/generator/level', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setGeneratorLevel(-12, 'dBFS');
      expect(result).toBe(true);
    });

    it('should get generator commands', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/commands', () => {
          return HttpResponse.json(['Play', 'Stop']);
        })
      );
      const client = new REWApiClient();
      const commands = await client.getGeneratorCommands();
      expect(commands).toEqual(['Play', 'Stop']);
    });
  });

  describe('Additional measurement methods', () => {
    it('should get measure level units', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/level/units', () => {
          return HttpResponse.json(['dBFS', 'dBV', 'dBu']);
        })
      );
      const client = new REWApiClient();
      const units = await client.getMeasureLevelUnits();
      expect(units).toEqual(['dBFS', 'dBV', 'dBu']);
    });

    it('should get measure naming', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/naming', () => {
          return HttpResponse.json({
            prefix: 'Measurement',
            includeDate: true,
            includeTime: false
          });
        })
      );
      const client = new REWApiClient();
      const naming = await client.getMeasureNaming();
      expect(naming).toBeDefined();
    });

    it('should set measure naming', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/naming', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setMeasureNaming({ prefix: 'Test' });
      expect(result).toBe(true);
    });

    it('should get measure notes', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/notes', () => {
          return HttpResponse.json('Test notes');
        })
      );
      const client = new REWApiClient();
      const notes = await client.getMeasureNotes();
      expect(notes).toBe('Test notes');
    });

    it('should set measure notes', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/notes', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setMeasureNotes('New notes');
      expect(result).toBe(true);
    });

    it('should get timing reference', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/timing/reference', () => {
          return HttpResponse.json({ mode: 'acoustic' });
        })
      );
      const client = new REWApiClient();
      const ref = await client.getTimingReference();
      expect(ref).toBeDefined();
    });
  });

  describe('Additional SPL meter methods', () => {
    it('should get SPL meter commands', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/spl-meter/commands', () => {
          return HttpResponse.json(['Start', 'Stop', 'Reset']);
        })
      );
      const client = new REWApiClient();
      const commands = await client.getSPLMeterCommands();
      expect(commands).toEqual(['Start', 'Stop', 'Reset']);
    });

    it('should get SPL meter config', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/spl-meter/1/configuration', () => {
          return HttpResponse.json({
            mode: 'slow',
            weighting: 'A',
            filter: 'None'
          });
        })
      );
      const client = new REWApiClient();
      const config = await client.getSPLMeterConfig(1);
      expect(config).toBeDefined();
    });

    it('should discover meters by probing configuration ids', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/spl-meter/1/configuration', () => HttpResponse.json({ showSPL: true })),
        http.get('http://127.0.0.1:4735/spl-meter/2/configuration', () => HttpResponse.json({ showSPL: true })),
        http.get('http://127.0.0.1:4735/spl-meter/3/configuration', () => new HttpResponse(null, { status: 404 }))
      );
      const client = new REWApiClient();
      const meters = await client.getSPLMeters();
      expect(meters).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should get global weightings and filters', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/spl-meter/weightings', () => HttpResponse.json(['A', 'C', 'Z'])),
        http.get('http://127.0.0.1:4735/spl-meter/filters', () => HttpResponse.json(['Fast', 'Slow']))
      );
      const client = new REWApiClient();
      expect(await client.getSPLMeterWeightings()).toEqual(['A', 'C', 'Z']);
      expect(await client.getSPLMeterFilters()).toEqual(['Fast', 'Slow']);
    });
  });

  describe('Connection state methods', () => {
    it('should track isConnected state', () => {
      const client = new REWApiClient();
      expect(client.isConnected()).toBe(false);
    });

    it('should disconnect and clear state', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/version', () => {
          return HttpResponse.json({ message: '5.30.9 API 0.9.5' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );
      const client = new REWApiClient();
      await client.connect();
      expect(client.isConnected()).toBe(true);
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Input level monitoring methods', () => {
    it('should get input level commands', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/commands', () => {
          return HttpResponse.json(['Start', 'Stop']);
        })
      );
      const client = new REWApiClient();
      const commands = await client.getInputLevelCommands();
      expect(commands).toEqual(['Start', 'Stop']);
    });

    it('should return empty array when input level commands fail', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/commands', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );
      const client = new REWApiClient();
      const commands = await client.getInputLevelCommands();
      expect(commands).toEqual([]);
    });

    it('should start input level monitoring', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/input-levels/command', async ({ request }) => {
          const body = await request.json() as { command: string; parameters: unknown[] };
          expect(body.command).toBe('Start');
          expect(body.parameters).toEqual([]);
          return HttpResponse.json({ success: true });
        })
      );
      const client = new REWApiClient();
      const result = await client.startInputLevelMonitoring();
      expect(result).toBe(true);
    });

    it('should start input level monitoring with 202 status', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/input-levels/command', () => {
          return new HttpResponse(null, { status: 202 });
        })
      );
      const client = new REWApiClient();
      const result = await client.startInputLevelMonitoring();
      expect(result).toBe(true);
    });

    it('should stop input level monitoring', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/input-levels/command', async ({ request }) => {
          const body = await request.json() as { command: string; parameters: unknown[] };
          expect(body.command).toBe('Stop');
          expect(body.parameters).toEqual([]);
          return HttpResponse.json({ success: true });
        })
      );
      const client = new REWApiClient();
      const result = await client.stopInputLevelMonitoring();
      expect(result).toBe(true);
    });

    it('should get input level units', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/units', () => {
          return HttpResponse.json(['dBFS', 'dBV', 'dBu']);
        })
      );
      const client = new REWApiClient();
      const units = await client.getInputLevelUnits();
      expect(units).toEqual(['dBFS', 'dBV', 'dBu']);
    });

    it('should return empty array when input level units fail', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/units', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );
      const client = new REWApiClient();
      const units = await client.getInputLevelUnits();
      expect(units).toEqual([]);
    });

    it('should get input levels and transform field names', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/last-levels', () => {
          return HttpResponse.json({
            unit: 'dBFS',
            rms: [-15.2, -14.8],
            peak: [-8.5, -9.1],
            timeSpanSeconds: 0.5
          });
        })
      );
      const client = new REWApiClient();
      const levels = await client.getInputLevels();
      expect(levels).not.toBeNull();
      expect(levels?.unit).toBe('dBFS');
      expect(levels?.rms_levels).toEqual([-15.2, -14.8]);
      expect(levels?.peak_levels).toEqual([-8.5, -9.1]);
      expect(levels?.time_span_seconds).toBe(0.5);
    });

    it('should return null when monitoring not started (404)', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/last-levels', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );
      const client = new REWApiClient();
      const levels = await client.getInputLevels();
      expect(levels).toBeNull();
    });

    it('should return null when response validation fails', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/last-levels', () => {
          // Invalid response - missing required fields
          return HttpResponse.json({ invalid: 'data' });
        })
      );
      const client = new REWApiClient();
      const levels = await client.getInputLevels();
      expect(levels).toBeNull();
    });

    it('should request last-levels without a query string (API 0.9.5 takes no params)', async () => {
      let capturedUrl: string | undefined;
      server.use(
        http.get('http://127.0.0.1:4735/input-levels/last-levels', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            unit: 'dBFS',
            rms: [-12.0],
            peak: [-6.0],
            timeSpanSeconds: 0.5
          });
        })
      );
      const client = new REWApiClient();
      await client.getInputLevels();
      expect(capturedUrl).not.toContain('?');
    });
  });

  describe('EQ default settings (four split endpoints)', () => {
    const equaliser = { manufacturer: 'Generic', model: 'Generic' };
    const targetSettings = { shape: 'Full range', lowPassCutoffHz: 1000, highPassCutoffHz: 100 };
    const roomCurveSettings = { addRoomCurve: false, lowFreqRiseStartHz: 200 };

    it('should aggregate the four default-* endpoints in getEQDefaults', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/eq/default-equaliser', () => HttpResponse.json(equaliser)),
        http.get('http://127.0.0.1:4735/eq/default-target-settings', () => HttpResponse.json(targetSettings)),
        http.get('http://127.0.0.1:4735/eq/default-target-level', () => HttpResponse.json(100.5)),
        http.get('http://127.0.0.1:4735/eq/default-room-curve-settings', () => HttpResponse.json(roomCurveSettings))
      );
      const client = new REWApiClient();
      const defaults = await client.getEQDefaults();
      expect(defaults.equaliser).toEqual(equaliser);
      expect(defaults.targetSettings).toEqual(targetSettings);
      expect(defaults.targetLevel).toBe(100.5);
      expect(defaults.roomCurveSettings).toEqual(roomCurveSettings);
    });

    it('should omit keys whose endpoint fails', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/eq/default-equaliser', () => HttpResponse.json(equaliser)),
        http.get('http://127.0.0.1:4735/eq/default-target-settings', () => new HttpResponse(null, { status: 404 })),
        http.get('http://127.0.0.1:4735/eq/default-target-level', () => new HttpResponse(null, { status: 404 })),
        http.get('http://127.0.0.1:4735/eq/default-room-curve-settings', () => new HttpResponse(null, { status: 404 }))
      );
      const client = new REWApiClient();
      const defaults = await client.getEQDefaults();
      expect(defaults.equaliser).toEqual(equaliser);
      expect(defaults.targetSettings).toBeUndefined();
      expect(defaults.targetLevel).toBeUndefined();
      expect(defaults.roomCurveSettings).toBeUndefined();
    });

    it('should dispatch only provided keys in setEQDefaults', async () => {
      const hits: string[] = [];
      server.use(
        http.post('http://127.0.0.1:4735/eq/default-equaliser', () => { hits.push('equaliser'); return HttpResponse.json({ message: 'ok' }); }),
        http.post('http://127.0.0.1:4735/eq/default-target-level', () => { hits.push('level'); return HttpResponse.json({ message: 'ok' }); }),
        http.post('http://127.0.0.1:4735/eq/default-target-settings', () => { hits.push('target'); return HttpResponse.json({ message: 'ok' }); }),
        http.post('http://127.0.0.1:4735/eq/default-room-curve-settings', () => { hits.push('room'); return HttpResponse.json({ message: 'ok' }); })
      );
      const client = new REWApiClient();
      const ok = await client.setEQDefaults({ equaliser, targetLevel: 99 });
      expect(ok).toBe(true);
      expect(hits.sort()).toEqual(['equaliser', 'level']);
    });

    it('should return false for an empty setEQDefaults payload', async () => {
      const client = new REWApiClient();
      const ok = await client.setEQDefaults({});
      expect(ok).toBe(false);
    });

    it('should return false when any dispatched update fails', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/eq/default-equaliser', () => HttpResponse.json({ message: 'ok' })),
        http.post('http://127.0.0.1:4735/eq/default-target-settings', () => new HttpResponse(null, { status: 500 }))
      );
      const client = new REWApiClient();
      const ok = await client.setEQDefaults({ equaliser, targetSettings });
      expect(ok).toBe(false);
    });
  });

  describe('RTA captured data (base64 FrequencyResponse decode)', () => {
    it('should decode linear-spaced captured data and compute frequencies from freqStep', async () => {
      const magnitude = [-30, -28, -26, -24];
      server.use(
        http.get('http://127.0.0.1:4735/rta/captured-data', () => HttpResponse.json({
          unit: 'SPL',
          smoothing: 'None',
          nanotime: 123,
          totalSamplesProcessed: 1048576,
          startFreq: 10,
          freqStep: 5,
          magnitude: encodeREWFloatArray(magnitude)
        }))
      );
      const client = new REWApiClient();
      const data = await client.getRTACapturedData();
      expect(data.unit).toBe('SPL');
      expect(data.total_samples_processed).toBe(1048576);
      expect(data.magnitude_db.map(v => Math.round(v))).toEqual(magnitude);
      expect(data.frequencies_hz).toEqual([10, 15, 20, 25]);
      expect(data.phase_degrees).toBeUndefined();
    });

    it('should decode log-spaced captured data via ppo and include phase', async () => {
      const magnitude = [-40, -38];
      const phase = [10, -10];
      server.use(
        http.get('http://127.0.0.1:4735/rta/captured-data', () => HttpResponse.json({
          unit: 'dBFS',
          startFreq: 100,
          ppo: 48,
          magnitude: encodeREWFloatArray(magnitude),
          phase: encodeREWFloatArray(phase)
        }))
      );
      const client = new REWApiClient();
      const data = await client.getRTACapturedData();
      expect(data.frequencies_hz[0]).toBeCloseTo(100, 5);
      expect(data.frequencies_hz[1]).toBeCloseTo(100 * Math.pow(2, 1 / 48), 5);
      expect(data.phase_degrees?.map(v => Math.round(v))).toEqual(phase);
    });

    it('should surface the empty-snapshot message with empty arrays', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/rta/captured-data', () => HttpResponse.json({ message: 'There is no data' }))
      );
      const client = new REWApiClient();
      const data = await client.getRTACapturedData();
      expect(data.message).toBe('There is no data');
      expect(data.magnitude_db).toEqual([]);
      expect(data.frequencies_hz).toEqual([]);
    });

    it('should pass unit/index query params for captured-peak-data', async () => {
      let capturedUrl: string | undefined;
      server.use(
        http.get('http://127.0.0.1:4735/rta/captured-peak-data', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ startFreq: 10, freqStep: 5, magnitude: encodeREWFloatArray([-20, -18]) });
        })
      );
      const client = new REWApiClient();
      const data = await client.getRTACapturedPeakData({ unit: 'SPL', index: '2' });
      expect(capturedUrl).toContain('unit=SPL');
      expect(capturedUrl).toContain('index=2');
      expect(data.magnitude_db.map(v => Math.round(v))).toEqual([-20, -18]);
    });
  });

  describe('Group methods', () => {
    it('should read the assigned uuid from the create-group response', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/groups', () =>
          // Live REW returns the created GroupInfo (spec says APIResponse).
          HttpResponse.json({ name: 'claude-test', notes: '', uuid: 'e709103d-7f5c-1000-b78c-7da631167d4a' }))
      );
      const client = new REWApiClient();
      const result = await client.createGroup('claude-test');
      expect(result.id).toBe('e709103d-7f5c-1000-b78c-7da631167d4a');
    });

    it('should add a measurement to a group via its uuid', async () => {
      let body: unknown;
      server.use(
        http.post('http://127.0.0.1:4735/groups/g1/measurements', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ message: 'added' });
        })
      );
      const client = new REWApiClient();
      const ok = await client.addMeasurementToGroup('g1', 'meas-uuid');
      expect(ok).toBe(true);
      expect(body).toEqual({ uuid: 'meas-uuid' });
    });

    it('should emulate remove-from-group via a throwaway group', async () => {
      const calls: string[] = [];
      server.use(
        // Measurement is a member of the requested group.
        http.get('http://127.0.0.1:4735/groups/g1/measurements', () =>
          HttpResponse.json([{ uuid: 'meas-uuid' }])),
        // createGroup returns the assigned uuid.
        http.post('http://127.0.0.1:4735/groups', () => {
          calls.push('create');
          return HttpResponse.json({ name: 'tmp', uuid: 'tmp-uuid' });
        }),
        // move into the throwaway group.
        http.post('http://127.0.0.1:4735/groups/tmp-uuid/measurements', () => {
          calls.push('move');
          return HttpResponse.json({ message: 'added' });
        }),
        // delete the throwaway group -> ungroups the measurement.
        http.delete('http://127.0.0.1:4735/groups/tmp-uuid', () => {
          calls.push('delete');
          return HttpResponse.json({ message: 'Group deleted' });
        })
      );
      const client = new REWApiClient();
      const ok = await client.removeMeasurementFromGroup('g1', 'meas-uuid');
      expect(ok).toBe(true);
      expect(calls).toEqual(['create', 'move', 'delete']);
    });

    it('should be a no-op when the measurement is not in the group', async () => {
      let createCalled = false;
      server.use(
        http.get('http://127.0.0.1:4735/groups/g1/measurements', () =>
          HttpResponse.json([{ uuid: 'other-uuid' }])),
        http.post('http://127.0.0.1:4735/groups', () => {
          createCalled = true;
          return HttpResponse.json({ name: 'tmp', uuid: 'tmp-uuid' });
        })
      );
      const client = new REWApiClient();
      const ok = await client.removeMeasurementFromGroup('g1', 'meas-uuid');
      expect(ok).toBe(false);
      expect(createCalled).toBe(false);
    });
  });

  describe('Measure configuration methods (API 0.9.5 shapes)', () => {
    it('should read measurement level as Value { value, unit }', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/level', () => HttpResponse.json({ value: -12, unit: 'dBFS' }))
      );
      const client = new REWApiClient();
      const level = await client.getMeasureLevel();
      expect(level.value).toBe(-12);
      expect(level.unit).toBe('dBFS');
    });

    it('should read sweep configuration with string length', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measure/sweep/configuration', () => HttpResponse.json({
          startFrequency: 20, endFrequency: 20000, length: '128k', fillSilenceWithDither: false
        }))
      );
      const client = new REWApiClient();
      const cfg = await client.getSweepConfig();
      expect(cfg.startFrequency).toBe(20);
      expect(cfg.endFrequency).toBe(20000);
      expect(cfg.length).toBe('128k');
    });

    it('should get sweep lengths from the configuration/sweep-lengths path', async () => {
      let requestedUrl: string | undefined;
      server.use(
        http.get('http://127.0.0.1:4735/measure/sweep/configuration/sweep-lengths', ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json(['64k', '128k', '1M']);
        })
      );
      const client = new REWApiClient();
      const lengths = await client.getSweepLengths();
      expect(lengths).toEqual(['64k', '128k', '1M']);
      expect(requestedUrl).toContain('/measure/sweep/configuration/sweep-lengths');
    });

    it('should flag proLicenseRequired on a 401 measure command', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/command', () =>
          new HttpResponse('A Pro upgrade license is required for this action', { status: 401 }))
      );
      const client = new REWApiClient();
      const result = await client.executeMeasureCommand('Measure');
      expect(result.success).toBe(false);
      expect(result.proLicenseRequired).toBe(true);
      expect(result.message).toContain('Pro upgrade license');
    });

    it('should not flag proLicenseRequired on a successful async measure', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/measure/command', () => new HttpResponse(null, { status: 202 }))
      );
      const client = new REWApiClient();
      const result = await client.executeMeasureCommand('Measure');
      expect(result.success).toBe(true);
      expect(result.proLicenseRequired).toBe(false);
    });
  });
});
