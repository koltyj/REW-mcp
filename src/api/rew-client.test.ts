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

  describe('Audio device methods', () => {
    it('should get audio driver', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/driver', () => {
          return HttpResponse.json('CoreAudio');
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
          return HttpResponse.json(48000);
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
          return HttpResponse.json([44100, 48000, 96000]);
        })
      );
      const client = new REWApiClient();
      const rates = await client.getAvailableSampleRates();
      expect(rates).toEqual([44100, 48000, 96000]);
    });
  });

  describe('Measurement data retrieval', () => {
    it('should get waterfall data', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/test-uuid/waterfall', () => {
          const freqBase64 = encodeREWFloatArray([20, 50, 100]);
          const magSlice1 = encodeREWFloatArray([80, 75, 70]);
          const magSlice2 = encodeREWFloatArray([78, 73, 68]);
          const magSlice3 = encodeREWFloatArray([76, 71, 66]);
          return HttpResponse.json({
            frequencies: freqBase64,
            timeSlices: [0, 100, 200],
            magnitude: [magSlice1, magSlice2, magSlice3]
          });
        })
      );
      const client = new REWApiClient();
      const waterfall = await client.getWaterfallData('test-uuid');
      expect(waterfall.frequencies_hz).toEqual([20, 50, 100]);
      expect(waterfall.time_slices_ms).toEqual([0, 100, 200]);
      expect(waterfall.magnitude_db).toHaveLength(3);
      expect(waterfall.magnitude_db[0]).toHaveLength(3);
    });

    it('should get RT60 data', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/test-uuid/rt60', () => {
          return HttpResponse.json({
            frequencies: encodeREWFloatArray([125, 250, 500]),
            t20: encodeREWFloatArray([0.3, 0.25, 0.2]),
            t30: encodeREWFloatArray([0.35, 0.28, 0.22]),
            edt: encodeREWFloatArray([0.32, 0.26, 0.21])
          });
        })
      );
      const client = new REWApiClient();
      const rt60 = await client.getRT60('test-uuid');
      expect(rt60.frequencies_hz).toHaveLength(3);
      // Use toBeCloseTo for floating-point values
      expect(rt60.t30_seconds[0]).toBeCloseTo(0.35, 2);
      expect(rt60.t30_seconds[1]).toBeCloseTo(0.28, 2);
      expect(rt60.t30_seconds[2]).toBeCloseTo(0.22, 2);
      expect(rt60.t20_seconds[0]).toBeCloseTo(0.3, 2);
      expect(rt60.edt_seconds[0]).toBeCloseTo(0.32, 2);
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
        http.get('http://127.0.0.1:4735/generator/status', () => {
          return HttpResponse.json({
            enabled: true,
            playing: false,
            signal: 'pinknoise',
            level: -18
          });
        })
      );
      const client = new REWApiClient();
      const status = await client.getGeneratorStatus();
      expect(status.enabled).toBe(true);
      expect(status.signal).toBe('pinknoise');
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

    it('should set generator signal', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/generator/signal', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setGeneratorSignal('pinknoise');
      expect(result).toBe(true);
    });

    it('should get generator level', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/level', () => {
          return HttpResponse.json({ level: -18, unit: 'dBFS' });
        })
      );
      const client = new REWApiClient();
      const level = await client.getGeneratorLevel();
      expect(level.level).toBe(-18);
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
    it('should get SPL meter levels', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/spl-meter/1/levels', () => {
          return HttpResponse.json({
            spl: 75.5,
            leq: 74.2,
            sel: 73.8,
            weighting: 'A',
            filter: 'None'
          });
        })
      );
      const client = new REWApiClient();
      const levels = await client.getSPLMeterLevels(1);
      expect(levels.spl).toBe(75.5);
      expect(levels.weighting).toBe('A');
    });

    it('should set SPL meter config', async () => {
      server.use(
        http.post('http://127.0.0.1:4735/spl-meter/1/configuration', () => {
          return HttpResponse.json({ status: 200 });
        })
      );
      const client = new REWApiClient();
      const result = await client.setSPLMeterConfig(1, { weighting: 'C' });
      expect(result).toBe(true);
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
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({
            info: { version: '5.30.9' },
            openapi: '3.0.0'
          });
        })
      );
      const client = new REWApiClient();
      const health = await client.healthCheck();
      expect(health.server_responding).toBe(true);
      expect(health.openapi_available).toBe(true);
      expect(health.api_version).toBe('5.30.9');
    });

    it('should return error when server not responding', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
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
        http.get('http://127.0.0.1:4735/audio', () => {
          return HttpResponse.json({
            enabled: true,
            ready: true,
            driver: 'CoreAudio'
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
          return HttpResponse.json('Built-in Microphone');
        })
      );
      const client = new REWApiClient();
      const device = await client.getJavaInputDevice();
      expect(device).toBe('Built-in Microphone');
    });

    it('should get current Java output device', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/audio/java/output-device', () => {
          return HttpResponse.json('Built-in Output');
        })
      );
      const client = new REWApiClient();
      const device = await client.getJavaOutputDevice();
      expect(device).toBe('Built-in Output');
    });
  });

  describe('Additional generator methods', () => {
    it('should get generator signal', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/signal', () => {
          return HttpResponse.json('pinknoise');
        })
      );
      const client = new REWApiClient();
      const signal = await client.getGeneratorSignal();
      expect(signal).toBe('pinknoise');
    });

    it('should get generator frequency', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/generator/frequency', () => {
          return HttpResponse.json(1000);
        })
      );
      const client = new REWApiClient();
      const freq = await client.getGeneratorFrequency();
      expect(freq).toBe(1000);
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
  });

  describe('Connection state methods', () => {
    it('should track isConnected state', () => {
      const client = new REWApiClient();
      expect(client.isConnected()).toBe(false);
    });

    it('should disconnect and clear state', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return new HttpResponse(null, { status: 404 });
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
          return HttpResponse.json(['start', 'stop']);
        })
      );
      const client = new REWApiClient();
      const commands = await client.getInputLevelCommands();
      expect(commands).toEqual(['start', 'stop']);
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
          const body = await request.json() as { command: string };
          expect(body.command).toBe('start');
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
          const body = await request.json() as { command: string };
          expect(body.command).toBe('stop');
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

    it('should pass unit parameter in query string', async () => {
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
      await client.getInputLevels('dBFS');
      expect(capturedUrl).toContain('unit=dBFS');
    });
  });
});
