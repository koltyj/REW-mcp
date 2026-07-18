/**
 * REW API Client
 *
 * Connects to REW's REST API at localhost:4735
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
 */

import { decodeREWFloatArray } from './base64-decoder.js';
import type { FrequencyResponseData, ImpulseResponseData, GroupDelayData, DistortionData, WaterfallData } from '../types/index.js';
import { REWApiError } from './rew-api-error.js';
import {
  MeasurementInfoSchema,
  InputCalibrationSchema,
  ImpulseResponseSchema,
  WaterfallSchema,
  RT60Schema,
  FrequencyResponseSchema,
  GroupDelaySchema,
  DistortionSchema,
  InputLevelsSchema,
  validateApiResponse,
  type InputCalibration,
  type InputLevels,
  type EqualiserEntry,
  type EqTargetSettings,
  type EqRoomCurveSettings,
  type EQDefaults,
  type RTACapturedData,
  type SPLValues,
  type SPLMeterConfiguration,
  type SPLMeterConfigInput,
  type MeasSweepConfiguration,
  type MeasureValue,
  type MeasurementNaming,
  type MeasureCommandResult,
  type RT60Data,
  type CommandExecutionResult
} from './schemas.js';
import type {
  Signal,
  Value,
  AudioStatus,
  Driver,
  Device,
  Enable,
  InputChannel,
  FrequencyResponse,
  Distortion,
  RT60Result,
  FilterSetting,
} from './generated/rew-api.js';

/**
 * REW REST API contract version this client was written and verified against.
 * REW reports it via GET /version ("... API <x>") and GET /doc.json (info.version).
 * A connection whose reported API version differs in major.minor is flagged as
 * potentially incompatible rather than silently trusted.
 */
export const SUPPORTED_API_VERSION = '0.9.5';

export interface ApiCompatibility {
  supported: boolean;
  reported?: string;
  expected: string;
  warning?: string;
}

/**
 * Compare a reported REW API version against SUPPORTED_API_VERSION on the
 * major.minor level. Patch differences are treated as compatible (with a note);
 * a differing or missing major.minor is flagged as unsupported.
 */
export function checkApiCompatibility(reported?: string): ApiCompatibility {
  const expected = SUPPORTED_API_VERSION;
  if (!reported) {
    return {
      supported: false,
      expected,
      warning: `Could not determine the REW API version; this client targets API ${expected}. Behaviour is unverified.`
    };
  }
  const mm = (v: string): string => v.split('.').slice(0, 2).join('.');
  if (mm(reported) === mm(expected)) {
    return reported === expected
      ? { supported: true, reported, expected }
      : { supported: true, reported, expected, warning: `REW API ${reported} differs from the verified ${expected} at the patch level; likely compatible.` };
  }
  return {
    supported: false,
    reported,
    expected,
    warning: `REW API ${reported} is not supported by this client (verified against ${expected}). Endpoints may have changed; results should be treated as unreliable.`
  };
}

export interface REWApiConfig {
  host: string;      // Default: '127.0.0.1'
  port: number;      // Default: 4735
  timeout: number;   // Default: 10000ms
}

export interface ConnectionStatus {
  connected: boolean;
  rew_version?: string;
  api_version?: string;
  api_version_supported?: boolean;
  compatibility_warning?: string;
  measurements_available: number;
  api_capabilities: {
    pro_features: boolean;
    blocking_mode: boolean;
  };
  error_message?: string;
}

export interface MeasurementInfo {
  uuid: string;
  name: string;
  index: number;
  type: string;
  has_ir: boolean;
  has_fr: boolean;
}

export interface MeasurementData {
  uuid: string;
  name: string;
  frequency_response?: FrequencyResponseData;
  impulse_response?: ImpulseResponseData;
  metadata: {
    sample_rate_hz?: number;
    start_time?: string;
    notes?: string;
  };
}

export interface FrequencyResponseOptions {
  smoothing?: string;  // '1/3', '1/6', etc.
  ppo?: number;        // Points per octave
  unit?: string;       // 'dBFS', 'dB SPL'
}

export interface ImpulseResponseOptions {
  windowed?: boolean;
}

export interface WaterfallOptions {
  mode?: string; // "Fourier" (default) or "Burst decay"
  slices?: number;
  leftWindowType?: string;
  rightWindowType?: string;
  windowWidthMs?: number;
  timeRangeMs?: number;
  riseTimeMs?: number;
  useCsdMode?: boolean;
  ppo?: number;
  smoothing?: string;
}

/**
 * REW API HTTP Response
 */
interface REWApiResponse {
  status: number;
  data?: unknown;
  error?: string;
}

/**
 * REW API Client Class
 */
export class REWApiClient {
  private config: REWApiConfig;
  private connected: boolean = false;
  private baseUrl: string;

  constructor(config?: Partial<REWApiConfig>) {
    this.config = {
      host: config?.host || '127.0.0.1',
      port: config?.port || 4735,
      timeout: config?.timeout || 10000
    };
    this.baseUrl = `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Make an HTTP request to the REW API
   */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<REWApiResponse> {
    const url = `${this.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      };

      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        data
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 408,
          error: 'Request timeout'
        };
      }
      
      return {
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle API response errors with typed exceptions
   * @param response - REW API response
   * @param context - Context for error message (e.g., "Measurement abc123")
   * @throws REWApiError with appropriate error code
   */
  private handleResponseError(response: REWApiResponse, context: string): never {
    if (response.status === 0) {
      throw new REWApiError(
        `Connection to REW failed: ${response.error || 'Connection refused'}`,
        'CONNECTION_REFUSED',
        0
      );
    }
    if (response.status === 404) {
      throw new REWApiError(
        `${context} not found`,
        'NOT_FOUND',
        404
      );
    }
    if (response.status === 408) {
      throw new REWApiError(
        `Request timeout: ${context}`,
        'TIMEOUT',
        408
      );
    }
    throw new REWApiError(
      `Unexpected error (${response.status}): ${response.error || 'Unknown'}`,
      'INTERNAL_ERROR',
      response.status
    );
  }

  /**
   * Fetch the REW application and REST API versions from the lightweight
   * /version endpoint, which returns e.g. { "message": "5.40 Beta 130 API 0.9.5" }.
   * The application version precedes the "API <x>" marker; the API version follows it.
   */
  async getVersion(): Promise<{ status: number; rew_version?: string; api_version?: string; raw?: string; error?: string }> {
    const response = await this.request('GET', '/version');

    if (response.status !== 200 || !response.data) {
      return { status: response.status, error: response.error };
    }

    const message = (response.data as Record<string, unknown>).message as string | undefined;
    if (!message) {
      return { status: response.status };
    }

    const apiMatch = message.match(/\bAPI\s+([\d.]+)/i);
    return {
      status: response.status,
      rew_version: (apiMatch ? message.slice(0, apiMatch.index).trim() : message.trim()) || undefined,
      api_version: apiMatch?.[1],
      raw: message
    };
  }

  /**
   * Connect to REW API and verify connection
   *
   * Per REW docs, the API is accessible at localhost:4735 by default.
   * Connectivity and version are checked via the lightweight /version endpoint;
   * the full OpenAPI spec at /doc.json is only fetched when actually needed.
   *
   * NOTE: The /application endpoint may not exist in all REW versions,
   * so we use /version and /measurements as the primary health checks.
   */
  async connect(): Promise<ConnectionStatus> {
    try {
      // First, verify the API server is actually running via the lightweight
      // /version endpoint (far cheaper than fetching the full OpenAPI document).
      const versionInfo = await this.getVersion();

      if (versionInfo.status === 0) {
        // Connection refused - REW not running or API not enabled
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: `Cannot connect to REW at ${this.baseUrl}. Ensure REW is running and the API is enabled in Preferences → API (click "Start" button).`
        };
      }

      if (versionInfo.status === 404) {
        // Server responding but endpoint not found - likely wrong port or old REW version
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: `REW API endpoint not found (HTTP 404). This usually means: (1) REW version is too old (API requires v5.30+), or (2) The API server isn't started. Check Preferences → API and click "Start". Also verify the port number matches.`
        };
      }

      if (versionInfo.status !== 200) {
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: versionInfo.error || `Unexpected HTTP ${versionInfo.status} from /version endpoint`
        };
      }

      const apiVersion = versionInfo.api_version;
      const reportedRewVersion = versionInfo.rew_version;

      // Verify we can access measurements endpoint (this is more reliable than /application)
      const measurementsResponse = await this.request('GET', '/measurements');
      
      if (measurementsResponse.status === 404) {
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: `REW /measurements endpoint not found. The API may be partially available. Check REW version.`
        };
      }
      
      if (measurementsResponse.status !== 200) {
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: measurementsResponse.error || `Unexpected HTTP ${measurementsResponse.status} from /measurements endpoint`
        };
      }

      const compatibility = checkApiCompatibility(apiVersion);

      // Current REW returns measurements as an index-keyed object; the array
      // form is a legacy/assumed shape kept for back-compat.
      const measurementData = measurementsResponse.data;
      const measurementIsObject = measurementData !== null && typeof measurementData === 'object';
      // Hard-fail on an unexpected shape rather than silently reporting 0 measurements:
      // a non-null primitive body means the response contract is not what we understand
      // (most likely an incompatible REW API version).
      if (measurementData !== null && measurementData !== undefined && !measurementIsObject) {
        return {
          connected: false,
          api_version: apiVersion,
          api_version_supported: compatibility.supported,
          compatibility_warning: compatibility.warning,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: `Unexpected /measurements response shape (got ${typeof measurementData}); this usually means an incompatible REW API version. Client targets API ${SUPPORTED_API_VERSION}, REW reports ${apiVersion ?? 'unknown'}.`
        };
      }
      const measurementCount = Array.isArray(measurementData)
        ? measurementData.length // legacy array form
        : (measurementIsObject ? Object.keys(measurementData as Record<string, unknown>).length : 0);

      // The bare GET /application endpoint was removed in current REW builds
      // (404 on API 0.9.5). Application/API versions now come from /version.
      const rewVersion = reportedRewVersion;

      // Pro features are not detectable via the REST API: API 0.9.5 exposes no
      // pro/license/feature endpoint. Report false; a Pro-gated operation (e.g. a
      // sweep measurement) simply fails at call time if the licence is missing.
      const hasProFeatures = false;

      // Check for blocking mode capability (GET /application/blocking → boolean).
      const blockingResponse = await this.request('GET', '/application/blocking');
      const hasBlocking = blockingResponse.status === 200;

      this.connected = true;

      return {
        connected: true,
        rew_version: rewVersion,
        api_version: apiVersion,
        api_version_supported: compatibility.supported,
        compatibility_warning: compatibility.warning,
        measurements_available: measurementCount,
        api_capabilities: {
          pro_features: hasProFeatures,
          blocking_mode: hasBlocking
        }
      };
    } catch (error) {
      return {
        connected: false,
        measurements_available: 0,
        api_capabilities: { pro_features: false, blocking_mode: false },
        error_message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Check API health without full connection
   * Returns diagnostic info about the API server state
   */
  async healthCheck(): Promise<{
    server_responding: boolean;
    openapi_available: boolean;
    api_version?: string;
    rew_version?: string;
    error?: string;
    suggestion?: string;
  }> {
    // Probe the lightweight /version endpoint first for liveness and version info
    const versionInfo = await this.getVersion();

    if (versionInfo.status === 0) {
      return {
        server_responding: false,
        openapi_available: false,
        error: versionInfo.error || 'Connection refused',
        suggestion: 'REW is not responding. Ensure REW is running and go to Preferences → API → click "Start".'
      };
    }

    if (versionInfo.status === 404) {
      // Something is responding but it's not the REW API
      return {
        server_responding: true,
        openapi_available: false,
        error: 'HTTP 404 - /version not found',
        suggestion: 'A server is responding but the REW API is not available. Check: (1) REW version is 5.30+, (2) API is enabled and started in Preferences → API, (3) Port number is correct.'
      };
    }

    if (versionInfo.status !== 200) {
      return {
        server_responding: true,
        openapi_available: false,
        error: `Unexpected status: ${versionInfo.status}`,
        suggestion: 'Check REW API settings and try restarting the API server.'
      };
    }

    // Server is up; check whether the OpenAPI document is also available (diagnostic only)
    const docResponse = await this.request('GET', '/doc.json');
    return {
      server_responding: true,
      openapi_available: docResponse.status === 200,
      api_version: versionInfo.api_version,
      rew_version: versionInfo.rew_version
    };
  }

  /**
   * Disconnect from API (cleanup)
   */
  disconnect(): void {
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * List all measurements in REW
   * Per REW docs: "use UUIDs as indices shift when measurements are added/removed"
   */
  async listMeasurements(): Promise<MeasurementInfo[]> {
    const response = await this.request('GET', '/measurements');

    if (response.status !== 200 || response.data === null || typeof response.data !== 'object') {
      return [];
    }

    // Current REW returns measurements as an object keyed by a 1-based index
    // string ({ "1": {...}, "2": {...} }). The array shape is a legacy/assumed
    // form kept for back-compat. Normalise both to [indexKey, measurement] pairs.
    const entries: Array<[string, unknown]> = Array.isArray(response.data)
      ? response.data.map((m, i) => [String(i + 1), m]) // legacy array form
      : Object.entries(response.data as Record<string, unknown>);

    return entries.map(([key, m]) => {
      const rec = (m ?? {}) as Record<string, unknown>;
      const parsed = MeasurementInfoSchema.safeParse(m);
      const data: Record<string, unknown> = parsed.success ? parsed.data : rec;
      const keyIndex = Number.parseInt(key, 10);
      return {
        uuid: String(data.uuid ?? data.id ?? `measurement_${key}`),
        // REW uses `title`; assumed/legacy shapes use `name`.
        name: String(data.name ?? data.title ?? `Measurement ${key}`),
        index: typeof data.index === 'number' ? data.index : (Number.isNaN(keyIndex) ? 0 : keyIndex),
        type: typeof data.type === 'string' ? data.type : 'unknown',
        has_ir: typeof data.has_ir === 'boolean' ? data.has_ir : (data.hasImpulse !== false),
        has_fr: typeof data.has_fr === 'boolean' ? data.has_fr : (data.hasFrequencyResponse !== false)
      };
    });
  }

  /**
   * Get a specific measurement by UUID
   */
  async getMeasurement(uuid: string): Promise<MeasurementData> {
    const response = await this.request('GET', `/measurements/${uuid}`);

    if (response.status !== 200) {
      this.handleResponseError(response, `Measurement ${uuid}`);
    }

    const data = response.data as Record<string, unknown>;

    return {
      uuid: (data.uuid as string) || uuid,
      // REW labels measurements with `title`; `name` is the assumed/legacy key.
      name: (data.name as string) || (data.title as string) || 'Unknown',
      metadata: {
        sample_rate_hz: data.sampleRate as number | undefined,
        start_time: (data.startTime as string) || (data.date as string) || undefined,
        notes: data.notes as string | undefined
      }
    };
  }

  /**
   * Decode a REW `FrequencyResponse` object (base64 magnitude/phase plus a
   * frequency axis expressed either as `ppo` for log-spaced data or `freqStep`
   * for linear-spaced FFT data). Shared by all endpoints that return this shape
   * (frequency-response, group-delay, target-response, eq/frequency-response).
   */
  private decodeFrequencyResponse(data: FrequencyResponse): {
    frequencies_hz: number[];
    magnitude: number[];
    phase_degrees: number[];
  } {
    const magnitude = data.magnitude ? decodeREWFloatArray(data.magnitude) : [];
    const phase = data.phase ? decodeREWFloatArray(data.phase) : magnitude.map(() => 0);

    let frequencies: number[] = [];
    const startFreq = data.startFreq;
    const ppo = data.ppo;
    const freqStep = data.freqStep;

    if (startFreq !== undefined && magnitude.length > 0) {
      if (ppo !== undefined && ppo > 0) {
        // Log-spaced data: freq[i] = startFreq * 2^(i/ppo)
        const logRatio = Math.log(2) / ppo;
        frequencies = magnitude.map((_, i) => startFreq * Math.exp(i * logRatio));
      } else if (freqStep !== undefined && freqStep > 0) {
        // Linear-spaced FFT data: freq[i] = startFreq + i * freqStep
        frequencies = magnitude.map((_, i) => startFreq + i * freqStep);
      }
    }

    return { frequencies_hz: frequencies, magnitude, phase_degrees: phase };
  }

  /**
   * Get frequency response data from a measurement
   *
   * Per REW API docs, FrequencyResponse returns:
   * - startFrequency: starting frequency in Hz
   * - pointsPerOctave (ppo): for log-spaced data
   * - freqStep: for linear-spaced data
   * - magnitude: Base64-encoded magnitudes
   * - phase: Base64-encoded phases (optional)
   *
   * Frequencies must be computed from startFrequency + ppo/freqStep.
   */
  async getFrequencyResponse(
    uuid: string,
    options?: FrequencyResponseOptions
  ): Promise<FrequencyResponseData> {
    let path = `/measurements/${uuid}/frequency-response`;
    const params = new URLSearchParams();

    if (options?.smoothing) {
      params.set('smoothing', options.smoothing);
    }
    if (options?.ppo) {
      params.set('ppo', options.ppo.toString());
    }
    if (options?.unit) {
      params.set('unit', options.unit);
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    const response = await this.request('GET', path);

    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `Frequency response for ${uuid}`);
    }

    const data = response.data as Record<string, unknown>;

    // Decode Base64 magnitude array
    const spl = (data.magnitude || data.magnitudes)
      ? decodeREWFloatArray((data.magnitude || data.magnitudes) as string)
      : [];

    // Decode Base64 phase array (optional)
    const phase = data.phase
      ? decodeREWFloatArray(data.phase as string)
      : spl.map(() => 0);

    // Compute frequencies from startFrequency + ppo/freqStep per REW API spec
    let frequencies: number[] = [];
    const startFreq = (data.startFrequency ?? data.startFreq) as number | undefined;
    const ppo = (data.pointsPerOctave ?? data.ppo) as number | undefined;
    const freqStep = data.freqStep as number | undefined;

    if (startFreq !== undefined && spl.length > 0) {
      if (ppo !== undefined && ppo > 0) {
        // Log-spaced data: freq[i] = startFreq * 2^(i/ppo)
        // Per REW docs: "frequency at any zero-based index is startFreq*e^(index*ln(2)/ppo)"
        const logRatio = Math.log(2) / ppo;
        frequencies = spl.map((_, i) => startFreq * Math.exp(i * logRatio));
      } else if (freqStep !== undefined && freqStep > 0) {
        // Linear-spaced data: freq[i] = startFreq + i * freqStep
        frequencies = spl.map((_, i) => startFreq + i * freqStep);
      }
    }

    // Fallback: check if frequencies array is directly provided (non-standard but safe)
    if (frequencies.length === 0 && data.frequencies) {
      frequencies = decodeREWFloatArray(data.frequencies as string);
    }

    const result: FrequencyResponseData = {
      frequencies_hz: frequencies,
      spl_db: spl,
      phase_degrees: phase
    };

    // Validate structure matches schema
    validateApiResponse(FrequencyResponseSchema, result, 'getFrequencyResponse');
    return result;
  }

  /**
   * Get impulse response data from a measurement
   *
   * Per REW API docs, ImpulseResponse returns:
   * - startTime: start time
   * - sampleInterval: sample interval in seconds
   * - sampleRate: sample rate in Hz
   * - data: Base64-encoded response data (NOT 'samples')
   */
  async getImpulseResponse(
    uuid: string,
    options?: ImpulseResponseOptions
  ): Promise<ImpulseResponseData> {
    let path = `/measurements/${uuid}/impulse-response`;
    const params = new URLSearchParams();

    if (options?.windowed !== undefined) {
      params.set('windowed', options.windowed.toString());
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    const response = await this.request('GET', path);

    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `Impulse response for ${uuid}`);
    }

    const rawData = response.data;

    // Validate structure before processing
    if (typeof rawData !== 'object' || rawData === null) {
      throw new REWApiError('Invalid impulse response data structure', 'INVALID_RESPONSE', 200);
    }

    const apiData = rawData as Record<string, unknown>;

    // Decode Base64 array - per REW API spec, the field is 'data' not 'samples'
    // Also check 'samples' for backward compatibility with any existing mocks/tests
    const samples = (apiData.data || apiData.samples)
      ? decodeREWFloatArray((apiData.data || apiData.samples) as string)
      : [];

    // Find peak
    let peakIndex = 0;
    let maxAbs = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxAbs) {
        maxAbs = abs;
        peakIndex = i;
      }
    }

    const sampleRate = (apiData.sampleRate as number) || 48000;

    const result: ImpulseResponseData = {
      samples,
      sample_rate_hz: sampleRate,
      peak_index: peakIndex,
      start_time_s: (apiData.startTime as number) || 0,
      duration_s: samples.length / sampleRate
    };

    // Validate final structure
    validateApiResponse(ImpulseResponseSchema, result, 'getImpulseResponse');
    return result;
  }

  /**
   * Get waterfall (cumulative spectral decay) data for a measurement.
   *
   * There is no GET endpoint for waterfall data. REW computes it on demand via
   * the "Generate waterfall" command on POST /measurements/{id}/command, and — in
   * blocking mode — returns the full 2D matrix in the command response as a
   * `ProcessResult`. The response body is `{ message: "<JSON ProcessResult>" }`
   * whose `results["0"]` holds:
   *   - "0".."N-1": base64 float32 (big-endian) magnitudes per time slice (dB)
   *   - "Frequencies": base64 float32 frequency axis (Hz)
   *   - "Times": base64 float32 slice times (seconds)
   *
   * Blocking mode is required for the data to be returned synchronously; it is
   * enabled for the duration of the call and restored to its previous state
   * afterwards. Magnitude bins REW leaves undefined (NaN, typically the lowest
   * frequencies) are floored to -200 dB so the result stays finite.
   */
  async getWaterfallData(uuid: string, options?: WaterfallOptions): Promise<WaterfallData> {
    const parameters: Record<string, unknown> = {
      'mode': options?.mode ?? 'Fourier',
      'slices': options?.slices ?? 10,
      'left window type': options?.leftWindowType ?? 'Hann',
      'right window type': options?.rightWindowType ?? 'Hann',
      'window width ms': options?.windowWidthMs ?? 300,
      'time range ms': options?.timeRangeMs ?? 300,
      'rise time ms': options?.riseTimeMs ?? 100,
      'use csd mode': options?.useCsdMode ?? false,
      'ppo': options?.ppo ?? 48,
      'smoothing': options?.smoothing ?? 'None',
    };

    const wasBlocking = await this.getBlockingMode();
    let response;
    try {
      if (!wasBlocking) {
        await this.setBlockingMode(true);
      }
      response = await this.request('POST', `/measurements/${uuid}/command`, {
        command: 'Generate waterfall',
        parameters,
      });
    } finally {
      if (!wasBlocking) {
        await this.setBlockingMode(false);
      }
    }

    if (response.status !== 200 && response.status !== 202) {
      this.handleResponseError(response, `Waterfall data for ${uuid}`);
    }

    // In blocking mode the command returns the ProcessResult as a JSON string in
    // `message`; without blocking it is only an "…in progress" acknowledgement.
    const envelope = response.data as { message?: string };
    let processResult: { results?: Record<string, Record<string, string>> };
    try {
      processResult = JSON.parse(envelope.message ?? '') as typeof processResult;
    } catch {
      throw new REWApiError(
        'Waterfall data was not returned; enable blocking mode so the Generate waterfall command responds with the computed matrix',
        'INVALID_RESPONSE',
        response.status
      );
    }

    const grid = processResult.results?.['0'];
    if (!grid) {
      throw new REWApiError('Waterfall ProcessResult did not contain a data grid', 'INVALID_RESPONSE', response.status);
    }

    const frequencies = grid.Frequencies ? decodeREWFloatArray(grid.Frequencies) : [];
    const timesSeconds = grid.Times ? decodeREWFloatArray(grid.Times) : [];
    const sliceKeys = Object.keys(grid)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    const magnitude = sliceKeys.map((k) =>
      decodeREWFloatArray(grid[k]).map((v) => (Number.isFinite(v) ? v : -200))
    );

    const result = {
      frequencies_hz: frequencies,
      time_slices_ms: timesSeconds.map((s) => s * 1000),
      magnitude_db: magnitude,
    };

    return validateApiResponse(WaterfallSchema, result, 'getWaterfallData');
  }

  /**
   * Get RT60 data
   *
   * Per REW API docs: "RT60 results can be read from /measurements/:id/rt60,
   * specifying the octave fraction as a query parameter, e.g. ?octaveFrac=1"
   *
   * @param uuid - Measurement UUID
   * @param options - Options including octaveFrac (1 for full octave, 3 or '1/3' for third octave)
   */
  async getRT60(uuid: string, options?: { octaveFrac?: number | string }): Promise<RT60Data> {
    let path = `/measurements/${uuid}/rt60`;
    const params = new URLSearchParams();

    if (options?.octaveFrac !== undefined) {
      // Handle both numeric (1, 3) and string ('1/3') formats
      const octaveFrac = String(options.octaveFrac);
      params.set('octaveFrac', octaveFrac);
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    const response = await this.request('GET', path);

    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `RT60 data for ${uuid}`);
    }

    // REW returns a map keyed by centre frequency (as a string) → RT60Result.
    // The unfiltered/broadband result is mapped to the "0.0" key. RT60 data must
    // first be generated with the "Generate RT60" command; until then REW replies
    // with a { message } object and a 4xx status (handled above).
    const bands = Object.values(response.data as Record<string, RT60Result>)
      .filter((b): b is RT60Result => b !== null && typeof b === 'object' && 'fc' in b)
      .sort((a, b) => (a.fc ?? 0) - (b.fc ?? 0));

    const result = {
      frequencies_hz: bands.map((b) => b.fc ?? 0),
      t20_seconds: bands.map((b) => b.T20 ?? 0),
      t30_seconds: bands.map((b) => b.T30 ?? 0),
      edt_seconds: bands.map((b) => b.EDT ?? 0),
      topt_seconds: bands.map((b) => b.Topt ?? 0),
    };

    return validateApiResponse(RT60Schema, result, 'getRT60');
  }

  /**
   * Enable/disable blocking mode
   * Per REW docs: "the API will not respond until the requested action is completed"
   */
  async setBlockingMode(enabled: boolean): Promise<boolean> {
    const response = await this.request('POST', '/application/blocking', enabled);
    return response.status === 200;
  }

  /**
   * Get current blocking mode status
   */
  async getBlockingMode(): Promise<boolean> {
    const response = await this.request('GET', '/application/blocking');
    return response.status === 200 && response.data === true;
  }

  // ============================================================
  // MEASUREMENT CONTROL METHODS
  // Note: Automated sweep measurements require REW Pro license
  // ============================================================

  /**
   * Get list of available measurement commands
   */
  async getMeasureCommands(): Promise<string[]> {
    const response = await this.request('GET', '/measure/commands');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Execute a measurement command
   * Common commands: "Measure", "SPL", "Impedance", "Cancel"
   * API expects: { command: "Measure", parameters: [] }
   */
  async executeMeasureCommand(command: string, parameters?: string[]): Promise<MeasureCommandResult> {
    const body = {
      command,
      parameters: parameters || []
    };

    const response = await this.request('POST', '/measure/command', body);

    // Without a Pro licence REW rejects API-triggered measurements with HTTP 401
    // and a plain-text body ("A Pro upgrade license is required for this action").
    const rawMessage = typeof response.data === 'string'
      ? response.data
      : ((response.data as { message?: string } | undefined)?.message ?? '');
    const proLicenseRequired =
      response.status === 401 || /pro upgrade licen[cs]e/i.test(rawMessage);

    return {
      success: response.status === 200 || response.status === 202,
      status: response.status,
      message: response.status === 202
        ? 'Measurement started (async)'
        : (proLicenseRequired ? (rawMessage || 'A Pro upgrade license is required for this action') : undefined),
      data: response.data,
      proLicenseRequired
    };
  }

  /**
   * Get current measurement level.
   * Response is a Value { value, unit } (not { level, unit }).
   */
  async getMeasureLevel(): Promise<MeasureValue> {
    const response = await this.request('GET', '/measure/level');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Measurement level');
    }
    return response.data as MeasureValue;
  }

  /**
   * Set measurement level
   * API expects: { value: -12, unit: "dBFS" }
   * @param level - Level value
   * @param unit - Unit (dBFS, dBV, dBu, etc.) - defaults to dBFS
   */
  async setMeasureLevel(level: number, unit?: string): Promise<boolean> {
    const body: { value: number; unit?: string } = { value: level };
    if (unit) body.unit = unit;
    const response = await this.request('POST', '/measure/level', body);
    return response.status === 200;
  }

  /**
   * Get available level units
   */
  async getMeasureLevelUnits(): Promise<string[]> {
    const response = await this.request('GET', '/measure/level/units');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get sweep configuration.
   * Response is MeasSweepConfiguration { startFrequency, endFrequency,
   * length (string, e.g. "128k"), fillSilenceWithDither }.
   */
  async getSweepConfig(): Promise<MeasSweepConfiguration> {
    const response = await this.request('GET', '/measure/sweep/configuration');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Sweep configuration');
    }
    return response.data as MeasSweepConfiguration;
  }

  /**
   * Set sweep configuration. Body fields are startFrequency/endFrequency and a
   * string `length` from the sweep-lengths list (see getSweepLengths).
   */
  async setSweepConfig(config: MeasSweepConfiguration): Promise<boolean> {
    const response = await this.request('POST', '/measure/sweep/configuration', config);
    return response.status === 200;
  }

  /**
   * Get the available sweep lengths (e.g. "64k", "128k", ..., "4M").
   * Path moved to /measure/sweep/configuration/sweep-lengths; values are strings.
   */
  async getSweepLengths(): Promise<string[]> {
    const response = await this.request('GET', '/measure/sweep/configuration/sweep-lengths');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data as string[] : [];
  }

  /**
   * Get measurement naming settings
   */
  async getMeasureNaming(): Promise<unknown> {
    const response = await this.request('GET', '/measure/naming');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Measurement naming settings');
    }
    return response.data;
  }

  /**
   * Set measurement naming settings.
   * Body is MeasurementNaming { title, namingOption, nextNumber, numberIncrement,
   * dateTimeFormat, prefixMeasNameWithOutput, appendLevelToMeasName }.
   * (The old prefix/includeDate/includeTime fields do not exist in the API.)
   */
  async setMeasureNaming(naming: MeasurementNaming): Promise<boolean> {
    const response = await this.request('POST', '/measure/naming', naming);
    return response.status === 200;
  }

  /**
   * Get/set notes for next measurement
   */
  async getMeasureNotes(): Promise<string> {
    const response = await this.request('GET', '/measure/notes');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Measurement notes');
    }
    return response.data as string;
  }

  async setMeasureNotes(notes: string): Promise<boolean> {
    const response = await this.request('POST', '/measure/notes', notes);
    return response.status === 200;
  }

  /**
   * Get timing reference settings
   */
  async getTimingReference(): Promise<unknown> {
    const response = await this.request('GET', '/measure/timing/reference');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Timing reference settings');
    }
    return response.data;
  }

  // ============================================================
  // AUDIO CONFIGURATION METHODS
  // ============================================================

  /**
   * Get audio status
   */
  async getAudioStatus(): Promise<AudioStatus> {
    const response = await this.request('GET', '/audio/status');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Audio status');
    }
    return response.data as AudioStatus;
  }

  /**
   * Get current audio driver
   */
  async getAudioDriver(): Promise<string> {
    const response = await this.request('GET', '/audio/driver');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Audio driver');
    }
    return (response.data as Driver).driver ?? '';
  }

  /**
   * Get available audio driver types
   */
  async getAudioDriverTypes(): Promise<string[]> {
    const response = await this.request('GET', '/audio/driver-types');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get current sample rate
   */
  async getSampleRate(): Promise<number> {
    const response = await this.request('GET', '/audio/samplerate');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Sample rate');
    }
    return (response.data as Value).value ?? 0;
  }

  /**
   * Get available sample rates
   */
  async getAvailableSampleRates(): Promise<number[]> {
    const response = await this.request('GET', '/audio/samplerates');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data)
      ? (response.data as Value[]).map((v) => v.value ?? 0)
      : [];
  }

  /**
   * Set sample rate
   * API expects: { value: 48000, unit: "Hz" }
   */
  async setSampleRate(rate: number): Promise<boolean> {
    const response = await this.request('POST', '/audio/samplerate', { value: rate, unit: 'Hz' });
    // API returns 202 for async changes
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get Java audio input devices
   */
  async getJavaInputDevices(): Promise<string[]> {
    const response = await this.request('GET', '/audio/java/input-devices');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get Java audio output devices
   */
  async getJavaOutputDevices(): Promise<string[]> {
    const response = await this.request('GET', '/audio/java/output-devices');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get current Java input device
   */
  async getJavaInputDevice(): Promise<string> {
    const response = await this.request('GET', '/audio/java/input-device');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Java input device');
    }
    return (response.data as Device).device ?? '';
  }

  /**
   * Set Java input device
   * API expects: { device: "Device Name" }
   */
  async setJavaInputDevice(device: string): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/input-device', { device });
    // API returns 202 for async device changes
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get current Java output device
   */
  async getJavaOutputDevice(): Promise<string> {
    const response = await this.request('GET', '/audio/java/output-device');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Java output device');
    }
    return (response.data as Device).device ?? '';
  }

  /**
   * Set Java output device
   * API expects: { device: "Device Name" }
   */
  async setJavaOutputDevice(device: string): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/output-device', { device });
    // API returns 202 for async device changes
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get input calibration configuration
   */
  async getInputCalibration(): Promise<InputCalibration | null> {
    const response = await this.request('GET', '/audio/input-cal');
    if (response.status !== 200) {
      return null;
    }
    if (response.data) {
      const result = InputCalibrationSchema.safeParse(response.data);
      return result.success ? result.data : null;
    }
    return null;
  }

  // ============================================================
  // SIGNAL GENERATOR METHODS
  // ============================================================

  /**
   * Get generator status — composed from individual endpoints.
   * The REW API does not have a single /generator/status endpoint.
   */
  async getGeneratorStatus(): Promise<{
    signal: string;
    level: number;
    level_unit: string;
    available_commands: string[];
  }> {
    const [signalResp, levelResp, commandsResp] = await Promise.all([
      this.request('GET', '/generator/signal'),
      this.request('GET', '/generator/level'),
      this.request('GET', '/generator/commands'),
    ]);
    const levelData = levelResp.status === 200 ? levelResp.data as Value : {};
    const signalData = signalResp.status === 200 ? signalResp.data as Signal : {};
    return {
      signal: signalData.signal ?? 'unknown',
      level: levelData.value ?? 0,
      level_unit: levelData.unit ?? 'dBFS',
      available_commands: commandsResp.status === 200 && Array.isArray(commandsResp.data) ? commandsResp.data : [],
    };
  }

  /**
   * Get available generator signals
   */
  async getGeneratorSignals(): Promise<string[]> {
    const response = await this.request('GET', '/generator/signals');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get current generator signal name.
   * Response is Signal { signal }, not a bare string.
   */
  async getGeneratorSignal(): Promise<string> {
    const response = await this.request('GET', '/generator/signal');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator signal');
    }
    return (response.data as Signal).signal ?? '';
  }

  /**
   * Set generator signal.
   * Uses POST (there is no PUT) with a Signal body { signal: "<name>" }.
   * Valid names come from GET /generator/signals (e.g. "pinknoise",
   * "logsweep"), not display strings like "Pink noise".
   */
  async setGeneratorSignal(signal: string): Promise<boolean> {
    const response = await this.request('POST', '/generator/signal', { signal });
    return response.status === 200;
  }

  /**
   * Get generator level as a Value { value, unit }.
   */
  async getGeneratorLevel(): Promise<Value> {
    const response = await this.request('GET', '/generator/level');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator level');
    }
    return response.data as Value;
  }

  /**
   * Set generator level
   * API expects: { value: -18, unit: "dBFS" }
   */
  async setGeneratorLevel(level: number, unit?: string): Promise<boolean> {
    const body: { value: number; unit?: string } = { value: level };
    if (unit) body.unit = unit;
    const response = await this.request('POST', '/generator/level', body);
    return response.status === 200;
  }

  /**
   * Get generator frequency (for tone signals) in Hz.
   * Response is a Value { value, unit }; `value` is omitted for noise signals,
   * so this returns 0 when no tone frequency is set.
   */
  async getGeneratorFrequency(): Promise<number> {
    const response = await this.request('GET', '/generator/frequency');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator frequency');
    }
    return (response.data as Value).value ?? 0;
  }

  /**
   * Set generator frequency (for tone signals)
   * API expects: { value: 1000, unit: "Hz" }
   */
  async setGeneratorFrequency(frequency: number): Promise<boolean> {
    const response = await this.request('POST', '/generator/frequency', { value: frequency, unit: 'Hz' });
    return response.status === 200;
  }

  /**
   * Get generator commands
   */
  async getGeneratorCommands(): Promise<string[]> {
    const response = await this.request('GET', '/generator/commands');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Execute generator command (Play, Stop)
   * API expects: { command: "Play", parameters: [] }
   * Returns 202 for async commands
   */
  async executeGeneratorCommand(command: string): Promise<boolean> {
    const response = await this.request('POST', '/generator/command', { command, parameters: [] });
    return response.status === 200 || response.status === 202;
  }

  // ============================================================
  // SPL METER METHODS
  // ============================================================

  /**
   * Get SPL meter commands
   */
  async getSPLMeterCommands(): Promise<string[]> {
    const response = await this.request('GET', '/spl-meter/commands');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Execute SPL meter command (Start, Stop, Reset)
   * API expects: { command: "Start", parameters: [] }
   * Returns 202 for async commands
   */
  async executeSPLMeterCommand(meterId: number, command: string): Promise<boolean> {
    const response = await this.request('POST', `/spl-meter/${meterId}/command`, { command, parameters: [] });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get SPL meter levels.
   *
   * Returns the full SPLValues payload. Note the frequency weighting is split
   * into splWeighting/leqWeighting/selWeighting (there is no single `weighting`
   * field), and `filter` is the time weighting (Fast/Slow).
   */
  async getSPLMeterLevels(meterId: number): Promise<SPLValues> {
    const response = await this.request('GET', `/spl-meter/${meterId}/levels`);
    if (response.status !== 200) {
      this.handleResponseError(response, `SPL meter ${meterId} levels`);
    }
    return response.data as SPLValues;
  }

  /**
   * Get SPL meter configuration
   */
  async getSPLMeterConfig(meterId: number): Promise<unknown> {
    const response = await this.request('GET', `/spl-meter/${meterId}/configuration`);
    if (response.status !== 200) {
      this.handleResponseError(response, `SPL meter ${meterId} configuration`);
    }
    return response.data;
  }

  /**
   * Set SPL meter configuration.
   *
   * Accepts the real SPLMeterConfiguration fields plus two convenience aliases,
   * which are expanded before posting (the REW API has no `mode`/`weighting`
   * fields, so passing them raw would be silently ignored):
   *  - `weighting` (A/C/Z) → splWeighting + leqWeighting + selWeighting
   *  - `mode` ('SPL'|'Leq'|'SEL') → showSPL/showLeq/showSEL
   */
  async setSPLMeterConfig(meterId: number, config: SPLMeterConfigInput): Promise<boolean> {
    const body: SPLMeterConfiguration = {};
    const rawKeys: (keyof SPLMeterConfiguration)[] = [
      'showSPL', 'showLeq', 'showSEL', 'splWeighting', 'leqWeighting', 'selWeighting',
      'filter', 'highPassActive', 'rollingLeqActive', 'rollingLeqMinutes'
    ];
    for (const key of rawKeys) {
      if (config[key] !== undefined) {
        (body[key] as unknown) = config[key];
      }
    }
    if (config.weighting !== undefined) {
      body.splWeighting = config.weighting;
      body.leqWeighting = config.weighting;
      body.selWeighting = config.weighting;
    }
    if (config.mode !== undefined) {
      body.showSPL = config.mode === 'SPL';
      body.showLeq = config.mode === 'Leq';
      body.showSEL = config.mode === 'SEL';
    }
    const response = await this.request('POST', `/spl-meter/${meterId}/configuration`, body);
    return response.status === 200;
  }

  // ============================================================
  // INPUT LEVEL MONITORING METHODS
  // ============================================================

  /**
   * Get available input level monitoring commands
   */
  async getInputLevelCommands(): Promise<string[]> {
    const response = await this.request('GET', '/input-levels/commands');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Start input level monitoring
   * API expects a Command body: { command: "Start", parameters: [] }
   * (canonical casing per GET /input-levels/commands)
   */
  async startInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', { command: 'Start', parameters: [] });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Stop input level monitoring
   * API expects a Command body: { command: "Stop", parameters: [] }
   */
  async stopInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', { command: 'Stop', parameters: [] });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get available input level units
   */
  async getInputLevelUnits(): Promise<string[]> {
    const response = await this.request('GET', '/input-levels/units');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get latest input levels (RMS and peak per channel)
   *
   * The unit is determined by REW's input level configuration and reported
   * in the response. GET /input-levels/last-levels takes no query parameters
   * (API 0.9.5); any unit selection must be made via REW itself.
   *
   * @returns InputLevels object or null if monitoring not active or validation fails
   */
  async getInputLevels(): Promise<InputLevels | null> {
    const response = await this.request('GET', '/input-levels/last-levels');

    if (response.status !== 200 || !response.data) {
      return null;
    }

    // Validate response structure
    const parsed = InputLevelsSchema.safeParse(response.data);
    if (!parsed.success) {
      return null;
    }

    // Transform to normalized interface
    return {
      unit: parsed.data.unit,
      rms_levels: parsed.data.rms,
      peak_levels: parsed.data.peak,
      time_span_seconds: parsed.data.timeSpanSeconds
    };
  }

  // ============================================================
  // MEASUREMENT DATA RETRIEVAL — NEW ENDPOINTS (P1)
  // ============================================================

  /**
   * Get group delay data for a measurement
   */
  async getGroupDelay(uuid: string, options?: { ppo?: number }): Promise<GroupDelayData> {
    let path = `/measurements/${uuid}/group-delay`;
    if (options?.ppo) {
      path += `?ppo=${options.ppo}`;
    }
    const response = await this.request('GET', path);
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `Group delay for ${uuid}`);
    }
    // Response is a FrequencyResponse whose base64 `magnitude` carries the
    // group-delay values in seconds (unit "s"); convert to milliseconds.
    const decoded = this.decodeFrequencyResponse(response.data as FrequencyResponse);
    const result: GroupDelayData = {
      frequencies_hz: decoded.frequencies_hz,
      group_delay_ms: decoded.magnitude.map((s) => s * 1000),
    };
    return validateApiResponse(GroupDelaySchema, result, 'getGroupDelay');
  }

  /**
   * Get distortion data (THD + harmonics) for a measurement
   */
  async getDistortion(uuid: string): Promise<DistortionData> {
    const response = await this.request('GET', `/measurements/${uuid}/distortion`);
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `Distortion data for ${uuid}`);
    }
    // Response is a tabular Distortion object: `columnHeaders` names each column
    // ("Freq (Hz)", "Fundamental (dB)", "THD (%)", "Noise (%)", "H2 (%)"..."H9 (%)")
    // and `data` is a row-per-frequency matrix of doubles (number[][] live,
    // despite the spec declaring a flat array).
    const data = response.data as Omit<Distortion, 'data'> & { data?: number[][] };
    const headers = data.columnHeaders ?? [];
    const rows: number[][] = Array.isArray(data.data) ? data.data : [];

    const colIndex = (predicate: (h: string) => boolean): number =>
      headers.findIndex((h) => predicate(h));
    const column = (idx: number): number[] =>
      idx < 0 ? [] : rows.map((row) => row[idx] ?? 0);

    const freqIdx = colIndex((h) => /^freq/i.test(h));
    const thdIdx = colIndex((h) => /^thd/i.test(h));

    const harmonics: Record<string, number[]> = {};
    headers.forEach((h, idx) => {
      const match = /^(H\d+)/i.exec(h);
      if (match) {
        harmonics[match[1].toUpperCase()] = column(idx);
      }
    });

    const result: DistortionData = {
      frequencies_hz: column(freqIdx),
      thd_percent: column(thdIdx),
      harmonics: Object.keys(harmonics).length > 0 ? harmonics : undefined,
    };
    return validateApiResponse(DistortionSchema, result, 'getDistortion');
  }

  /**
   * Get IR window settings for a measurement
   */
  async getIRWindows(uuid: string): Promise<unknown> {
    const response = await this.request('GET', `/measurements/${uuid}/ir-windows`);
    if (response.status !== 200) {
      this.handleResponseError(response, `IR windows for ${uuid}`);
    }
    return response.data;
  }

  /**
   * Set IR window parameters for a measurement
   */
  async setIRWindows(uuid: string, windows: unknown): Promise<boolean> {
    const response = await this.request('POST', `/measurements/${uuid}/ir-windows`, windows);
    return response.status === 200;
  }

  // ============================================================
  // PER-MEASUREMENT COMMANDS (P1)
  // ============================================================

  /**
   * Get available commands for a specific measurement
   */
  async getMeasurementCommands(uuid: string): Promise<string[]> {
    const response = await this.request('GET', `/measurements/${uuid}/commands`);
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Execute a command on a specific measurement
   * Commands include: "Generate waterfall", "Generate spectrogram", "Generate RT60",
   * "Generate minimum phase", "Smooth", "Normalise", "Invert", "Offset",
   * "Trim IR", "Window", "Time align", "Delete", etc.
   */
  async executeMeasurementCommand(uuid: string, command: string, parameters?: string[]): Promise<CommandExecutionResult> {
    const response = await this.request('POST', `/measurements/${uuid}/command`, {
      command,
      parameters: parameters || [],
    });
    return {
      success: response.status === 200 || response.status === 202,
      status: response.status,
      data: response.data,
    };
  }

  // ============================================================
  // BULK MEASUREMENT COMMANDS & ARITHMETIC (P1)
  // ============================================================

  /**
   * Get available bulk measurement commands
   */
  async getMeasurementsCommands(): Promise<string[]> {
    const response = await this.request('GET', '/measurements/commands');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Execute a bulk measurement command (Load, Save all, Dirac pulse, etc.)
   */
  async executeMeasurementsCommand(command: string, parameters?: string[]): Promise<CommandExecutionResult> {
    const response = await this.request('POST', '/measurements/command', {
      command,
      parameters: parameters || [],
    });
    return {
      success: response.status === 200 || response.status === 202,
      status: response.status,
      data: response.data,
    };
  }

  /**
   * Get available arithmetic functions for combining measurements
   */
  async getArithmeticFunctions(): Promise<string[]> {
    const response = await this.request('GET', '/measurements/arithmetic-functions');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Apply an arithmetic operation between two measurements.
   *
   * REW has no standalone `/measurements/arithmetic` endpoint; arithmetic is the
   * "Arithmetic" process command routed through `/measurements/process-measurements`
   * with the chosen function (from `getArithmeticFunctions`, e.g. "A + B", "A - B",
   * "A * B", "A / B") supplied as the `function` parameter. The resulting new
   * measurement is read back from `/measurements/process-result`.
   */
  async executeArithmetic(func: string, measurementA: string, measurementB: string): Promise<{
    success: boolean;
    uuid?: string;
  }> {
    const process = await this.processMeasurements(
      [measurementA, measurementB],
      'Arithmetic',
      { function: func }
    );
    if (!process.success) {
      return { success: false };
    }

    const resultResponse = await this.request('GET', '/measurements/process-result');
    const result = resultResponse.data as {
      results?: Record<string, { UUID?: string }>;
    } | undefined;
    const firstResult = result?.results ? Object.values(result.results)[0] : undefined;

    return {
      success: true,
      uuid: firstResult?.UUID,
    };
  }

  /**
   * Batch-process multiple measurements with a process command.
   *
   * Body is a `ProcessMeasurements` object: the command goes in `processName`,
   * the targets in `measurementUUIDs`, and any command-specific arguments in the
   * `parameters` map (e.g. `{ function: "A + B" }` for Arithmetic).
   */
  async processMeasurements(
    uuids: string[],
    command: string,
    parameters?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    status: number;
  }> {
    const response = await this.request('POST', '/measurements/process-measurements', {
      processName: command,
      measurementUUIDs: uuids,
      parameters: parameters ?? {},
    });
    return {
      success: response.status === 200 || response.status === 202,
      status: response.status,
    };
  }

  // ============================================================
  // SELECTED MEASUREMENT (P1)
  // ============================================================

  /**
   * Get the currently selected measurement UUID
   */
  async getSelectedMeasurement(): Promise<string | null> {
    const response = await this.request('GET', '/measurements/selected-uuid');
    if (response.status !== 200) {
      return null;
    }
    return response.data as string;
  }

  /**
   * Set the currently selected measurement
   */
  async setSelectedMeasurement(uuid: string): Promise<boolean> {
    const response = await this.request('POST', '/measurements/selected-uuid', uuid);
    return response.status === 200;
  }

  // ============================================================
  // PER-MEASUREMENT EQ ENDPOINTS (P1)
  // ============================================================

  /**
   * Get the equaliser assigned to a measurement
   */
  async getMeasurementEqualiser(uuid: string): Promise<unknown> {
    const response = await this.request('GET', `/measurements/${uuid}/equaliser`);
    if (response.status !== 200) {
      this.handleResponseError(response, `Equaliser for ${uuid}`);
    }
    return response.data;
  }

  /**
   * Assign an equaliser to a measurement
   */
  async setMeasurementEqualiser(uuid: string, equaliser: unknown): Promise<boolean> {
    const response = await this.request('POST', `/measurements/${uuid}/equaliser`, equaliser);
    return response.status === 200;
  }

  /**
   * Get EQ filters applied to a measurement
   */
  async getMeasurementFilters(uuid: string): Promise<FilterSetting[]> {
    const response = await this.request('GET', `/measurements/${uuid}/filters`);
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? (response.data as FilterSetting[]) : [];
  }

  /**
   * Set EQ filters on a measurement.
   * Body is a `FilterList` wrapper: `{ filters: [...] }` (a raw array is rejected).
   */
  async setMeasurementFilters(uuid: string, filters: FilterSetting[]): Promise<boolean> {
    const response = await this.request('POST', `/measurements/${uuid}/filters`, { filters });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get target curve settings for a measurement
   */
  async getMeasurementTargetSettings(uuid: string): Promise<unknown> {
    const response = await this.request('GET', `/measurements/${uuid}/target-settings`);
    if (response.status !== 200) {
      this.handleResponseError(response, `Target settings for ${uuid}`);
    }
    return response.data;
  }

  /**
   * Set target curve settings for a measurement
   */
  async setMeasurementTargetSettings(uuid: string, settings: unknown): Promise<boolean> {
    const response = await this.request('POST', `/measurements/${uuid}/target-settings`, settings);
    return response.status === 200;
  }

  /**
   * Get the computed target response curve for a measurement
   */
  async getMeasurementTargetResponse(uuid: string): Promise<FrequencyResponseData> {
    const response = await this.request('GET', `/measurements/${uuid}/target-response`);
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `Target response for ${uuid}`);
    }
    const decoded = this.decodeFrequencyResponse(response.data as FrequencyResponse);
    return {
      frequencies_hz: decoded.frequencies_hz,
      spl_db: decoded.magnitude,
      phase_degrees: decoded.phase_degrees,
    };
  }

  /**
   * Get the predicted frequency response of the equalised measurement.
   *
   * The former `/eq/predicted-response` path was removed; the equalised response
   * is now served by `GET /measurements/{id}/eq/frequency-response`.
   */
  async getEQPredictedResponse(uuid: string): Promise<FrequencyResponseData> {
    const response = await this.request('GET', `/measurements/${uuid}/eq/frequency-response`);
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `EQ predicted response for ${uuid}`);
    }
    const decoded = this.decodeFrequencyResponse(response.data as FrequencyResponse);
    return {
      frequencies_hz: decoded.frequencies_hz,
      spl_db: decoded.magnitude,
      phase_degrees: decoded.phase_degrees,
    };
  }

  /**
   * Generate a new measurement containing the combined EQ filter response.
   *
   * There is no direct GET for the filter response; REW produces it via the EQ
   * command "Generate filters measurement", which appends a new measurement to
   * the list. Its frequency response can then be read with `getFrequencyResponse`
   * (or `getEQPredictedResponse`) on the newly created measurement.
   */
  async generateFiltersMeasurement(uuid: string): Promise<{ success: boolean; message?: string }> {
    const response = await this.request('POST', `/measurements/${uuid}/eq/command`, {
      command: 'Generate filters measurement',
    });
    const data = response.data as { message?: string } | undefined;
    return {
      success: response.status === 200 || response.status === 202,
      message: data?.message,
    };
  }

  /**
   * Auto-generate EQ filters to match the target curve.
   *
   * The former `/eq/match-target` path was removed; matching is now the EQ command
   * "Match target" routed through `POST /measurements/{id}/eq/command`.
   */
  async matchTarget(uuid: string): Promise<{ success: boolean }> {
    const response = await this.request('POST', `/measurements/${uuid}/eq/command`, {
      command: 'Match target',
    });
    return { success: response.status === 200 || response.status === 202 };
  }

  // ============================================================
  // AUDIO CHANNEL ROUTING & OUTPUT CALIBRATION (P1)
  // ============================================================

  /**
   * Get output calibration configuration
   */
  async getOutputCalibration(): Promise<unknown> {
    const response = await this.request('GET', '/audio/output-cal');
    if (response.status !== 200) {
      return null;
    }
    return response.data;
  }

  /**
   * Get current Java input channel number
   */
  async getJavaInputChannel(): Promise<number> {
    const response = await this.request('GET', '/audio/java/input-channel');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Java input channel');
    }
    return (response.data as InputChannel).channel ?? 0;
  }

  /**
   * Set Java input channel
   * API expects: { channel: <number> }
   */
  async setJavaInputChannel(channel: number): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/input-channel', { channel });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get reference input channel
   */
  async getJavaRefInputChannel(): Promise<number> {
    const response = await this.request('GET', '/audio/java/ref-input-channel');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Java reference input channel');
    }
    return (response.data as InputChannel).channel ?? 0;
  }

  /**
   * Set reference input channel
   * API expects: { channel: <number> }
   */
  async setJavaRefInputChannel(channel: number): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/ref-input-channel', { channel });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get last used input channel
   */
  async getJavaLastInputChannel(): Promise<number> {
    const response = await this.request('GET', '/audio/java/last-input-channel');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Java last input channel');
    }
    return (response.data as InputChannel).channel ?? 0;
  }

  /**
   * Get output channel mapping
   */
  async getJavaOutputChannelMapping(): Promise<unknown> {
    const response = await this.request('GET', '/audio/java/output-channel-mapping');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Java output channel mapping');
    }
    return response.data;
  }

  /**
   * Set output channel mapping
   */
  async setJavaOutputChannelMapping(mapping: unknown): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/output-channel-mapping', mapping);
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get stereo-only mode
   */
  async getJavaStereoOnly(): Promise<boolean> {
    const response = await this.request('GET', '/audio/java/stereo-only');
    if (response.status !== 200) {
      return false;
    }
    return (response.data as Enable).enable ?? false;
  }

  /**
   * Set stereo-only mode
   * API expects: { enable: <boolean> }
   */
  async setJavaStereoOnly(stereoOnly: boolean): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/stereo-only', { enable: stereoOnly });
    return response.status === 200 || response.status === 202;
  }

  // ============================================================
  // MEASURE CONFIG EXPANSION (P1)
  // ============================================================

  /**
   * Get speaker protection options
   */
  async getMeasureProtectionOptions(): Promise<unknown> {
    const response = await this.request('GET', '/measure/protection-options');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Protection options');
    }
    return response.data;
  }

  /**
   * Set speaker protection options
   */
  async setMeasureProtectionOptions(options: unknown): Promise<boolean> {
    const response = await this.request('POST', '/measure/protection-options', options);
    return response.status === 200;
  }

  /**
   * Get playback mode
   */
  async getMeasurePlaybackMode(): Promise<string> {
    const response = await this.request('GET', '/measure/playback-mode');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Playback mode');
    }
    return response.data as string;
  }

  /**
   * Set playback mode
   */
  async setMeasurePlaybackMode(mode: string): Promise<boolean> {
    const response = await this.request('POST', '/measure/playback-mode', mode);
    return response.status === 200;
  }

  /**
   * Get measurement mode (sequential, ramped, repeated)
   */
  async getMeasurementMode(): Promise<string> {
    const response = await this.request('GET', '/measure/measurement-mode');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Measurement mode');
    }
    return response.data as string;
  }

  /**
   * Set measurement mode
   */
  async setMeasurementMode(mode: string): Promise<boolean> {
    const response = await this.request('POST', '/measure/measurement-mode', mode);
    return response.status === 200;
  }

  /**
   * Get sequential channel configuration
   */
  async getSequentialChannels(): Promise<unknown> {
    const response = await this.request('GET', '/measure/sequential-channels');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Sequential channels');
    }
    return response.data;
  }

  /**
   * Set sequential channel configuration
   */
  async setSequentialChannels(channels: unknown): Promise<boolean> {
    const response = await this.request('POST', '/measure/sequential-channels', channels);
    return response.status === 200;
  }

  /**
   * Get measurement start delay
   */
  async getMeasureStartDelay(): Promise<unknown> {
    const response = await this.request('GET', '/measure/start-delay');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Start delay');
    }
    return response.data;
  }

  /**
   * Set measurement start delay
   */
  async setMeasureStartDelay(delay: unknown): Promise<boolean> {
    const response = await this.request('POST', '/measure/start-delay', delay);
    return response.status === 200;
  }

  // ============================================================
  // GENERATOR EXPANSION (P1)
  // ============================================================

  /**
   * Get detailed signal configuration (duty cycle, channels, etc.)
   */
  async getGeneratorSignalConfig(): Promise<unknown> {
    const response = await this.request('GET', '/generator/signal/configuration');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator signal configuration');
    }
    return response.data;
  }

  /**
   * Set detailed signal configuration
   */
  async setGeneratorSignalConfig(config: unknown): Promise<boolean> {
    const response = await this.request('POST', '/generator/signal/configuration', config);
    return response.status === 200;
  }

  /**
   * Get generator protection settings
   */
  async getGeneratorProtection(): Promise<unknown> {
    const response = await this.request('GET', '/generator/protection');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator protection');
    }
    return response.data;
  }

  /**
   * Set generator protection settings
   */
  async setGeneratorProtection(protection: unknown): Promise<boolean> {
    const response = await this.request('POST', '/generator/protection', protection);
    return response.status === 200;
  }

  // ============================================================
  // SPL METER EXPANSION (P1)
  // ============================================================

  /**
   * List available SPL meters.
   *
   * The REW API has no meter-enumeration endpoint (the old /spl-meter/meters
   * path returns 404); meters are addressed by id. Meter ids are contiguous
   * from 1, so this probes /spl-meter/{id}/configuration upward until one is
   * missing and returns the ids that exist.
   */
  async getSPLMeters(): Promise<Array<{ id: number }>> {
    const meters: Array<{ id: number }> = [];
    const maxProbe = 8;
    for (let id = 1; id <= maxProbe; id++) {
      const response = await this.request('GET', `/spl-meter/${id}/configuration`);
      if (response.status !== 200) {
        break;
      }
      meters.push({ id });
    }
    return meters;
  }

  /**
   * Get available frequency weightings (A/C/Z). Global in the current API.
   */
  async getSPLMeterWeightings(): Promise<string[]> {
    const response = await this.request('GET', '/spl-meter/weightings');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get available time-weighting filters (Fast/Slow). Global in the current API.
   */
  async getSPLMeterFilters(): Promise<string[]> {
    const response = await this.request('GET', '/spl-meter/filters');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  // ============================================================
  // IMPORT ENDPOINTS (P2)
  // ============================================================

  /**
   * Import frequency response from a file path
   */
  async importFrequencyResponseFile(filePath: string): Promise<{ success: boolean; uuid?: string }> {
    const response = await this.request('POST', '/import/frequency-response-file', { filePath });
    const data = response.data as Record<string, unknown> | undefined;
    return {
      success: response.status === 200 || response.status === 201,
      uuid: data?.uuid as string | undefined,
    };
  }

  /**
   * Import frequency response from inline data
   */
  async importFrequencyResponseData(data: {
    frequencies: number[];
    magnitudes: number[];
    phases?: number[];
  }): Promise<{ success: boolean; uuid?: string }> {
    const response = await this.request('POST', '/import/frequency-response-data', data);
    const respData = response.data as Record<string, unknown> | undefined;
    return {
      success: response.status === 200 || response.status === 201,
      uuid: respData?.uuid as string | undefined,
    };
  }

  /**
   * Import impulse response from a file path
   */
  async importImpulseResponseFile(filePath: string): Promise<{ success: boolean; uuid?: string }> {
    const response = await this.request('POST', '/import/impulse-response-file', { filePath });
    const data = response.data as Record<string, unknown> | undefined;
    return {
      success: response.status === 200 || response.status === 201,
      uuid: data?.uuid as string | undefined,
    };
  }

  /**
   * Import impulse response from inline data
   */
  async importImpulseResponseData(data: {
    samples: number[];
    sampleRate: number;
  }): Promise<{ success: boolean; uuid?: string }> {
    const response = await this.request('POST', '/import/impulse-response-data', data);
    const respData = response.data as Record<string, unknown> | undefined;
    return {
      success: response.status === 200 || response.status === 201,
      uuid: respData?.uuid as string | undefined,
    };
  }

  /**
   * Import RTA capture from a file path
   */
  async importRTAFile(filePath: string): Promise<{ success: boolean }> {
    const response = await this.request('POST', '/import/rta-file', { filePath });
    return { success: response.status === 200 || response.status === 201 };
  }

  /**
   * Import sweep recording from a file path
   */
  async importSweepRecording(filePath: string): Promise<{ success: boolean; uuid?: string }> {
    const response = await this.request('POST', '/import/sweep-recording', { filePath });
    const data = response.data as Record<string, unknown> | undefined;
    return {
      success: response.status === 200 || response.status === 201,
      uuid: data?.uuid as string | undefined,
    };
  }

  // ============================================================
  // EQ DEFAULTS & MANAGEMENT (P2)
  // ============================================================

  /**
   * List available equaliser types
   */
  async getEqualisers(): Promise<unknown[]> {
    const response = await this.request('GET', '/eq/equalisers');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * List EQ hardware/software manufacturers
   */
  async getEQManufacturers(): Promise<string[]> {
    const response = await this.request('GET', '/eq/manufacturers');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get the default equaliser (manufacturer + model).
   */
  async getDefaultEqualiser(): Promise<EqualiserEntry | null> {
    const response = await this.request('GET', '/eq/default-equaliser');
    return response.status === 200 ? (response.data as EqualiserEntry) : null;
  }

  /**
   * Set the default equaliser (manufacturer + model).
   */
  async setDefaultEqualiser(entry: EqualiserEntry): Promise<boolean> {
    const response = await this.request('POST', '/eq/default-equaliser', entry);
    return response.status === 200;
  }

  /**
   * Get the default target settings (shape, bass management, crossovers).
   */
  async getDefaultTargetSettings(): Promise<EqTargetSettings | null> {
    const response = await this.request('GET', '/eq/default-target-settings');
    return response.status === 200 ? (response.data as EqTargetSettings) : null;
  }

  /**
   * Set the default target settings.
   */
  async setDefaultTargetSettings(settings: EqTargetSettings): Promise<boolean> {
    const response = await this.request('POST', '/eq/default-target-settings', settings);
    return response.status === 200;
  }

  /**
   * Get the default target level (dB SPL).
   */
  async getDefaultTargetLevel(): Promise<number | null> {
    const response = await this.request('GET', '/eq/default-target-level');
    return response.status === 200 && typeof response.data === 'number'
      ? response.data
      : null;
  }

  /**
   * Set the default target level (dB SPL).
   */
  async setDefaultTargetLevel(level: number): Promise<boolean> {
    const response = await this.request('POST', '/eq/default-target-level', level);
    return response.status === 200;
  }

  /**
   * Get the default room curve settings.
   */
  async getDefaultRoomCurveSettings(): Promise<EqRoomCurveSettings | null> {
    const response = await this.request('GET', '/eq/default-room-curve-settings');
    return response.status === 200 ? (response.data as EqRoomCurveSettings) : null;
  }

  /**
   * Set the default room curve settings.
   */
  async setDefaultRoomCurveSettings(settings: EqRoomCurveSettings): Promise<boolean> {
    const response = await this.request('POST', '/eq/default-room-curve-settings', settings);
    return response.status === 200;
  }

  /**
   * Get all default EQ settings as a composite view.
   *
   * REW API 0.9.5 removed the single GET /eq/defaults blob and split it into
   * four typed endpoints; this aggregates them. Any endpoint that fails leaves
   * its key undefined rather than failing the whole call.
   */
  async getEQDefaults(): Promise<EQDefaults> {
    const [equaliser, targetSettings, targetLevel, roomCurveSettings] = await Promise.all([
      this.getDefaultEqualiser(),
      this.getDefaultTargetSettings(),
      this.getDefaultTargetLevel(),
      this.getDefaultRoomCurveSettings()
    ]);

    const defaults: EQDefaults = {};
    if (equaliser) defaults.equaliser = equaliser;
    if (targetSettings) defaults.targetSettings = targetSettings;
    if (targetLevel !== null) defaults.targetLevel = targetLevel;
    if (roomCurveSettings) defaults.roomCurveSettings = roomCurveSettings;
    return defaults;
  }

  /**
   * Set default EQ settings.
   *
   * Dispatches each provided key to its dedicated endpoint (POST /eq/default-*).
   * Returns true only if every attempted update succeeded. Keys left undefined
   * are not touched; passing an empty object is a no-op that returns false.
   */
  async setEQDefaults(defaults: EQDefaults): Promise<boolean> {
    const results: boolean[] = [];
    if (defaults.equaliser !== undefined) {
      results.push(await this.setDefaultEqualiser(defaults.equaliser));
    }
    if (defaults.targetSettings !== undefined) {
      results.push(await this.setDefaultTargetSettings(defaults.targetSettings));
    }
    if (defaults.targetLevel !== undefined) {
      results.push(await this.setDefaultTargetLevel(defaults.targetLevel));
    }
    if (defaults.roomCurveSettings !== undefined) {
      results.push(await this.setDefaultRoomCurveSettings(defaults.roomCurveSettings));
    }
    return results.length > 0 && results.every(Boolean);
  }

  /**
   * Get house curve configuration
   */
  async getHouseCurve(): Promise<unknown> {
    const response = await this.request('GET', '/eq/house-curve');
    if (response.status !== 200) {
      this.handleResponseError(response, 'House curve');
    }
    return response.data;
  }

  /**
   * Set house curve configuration
   */
  async setHouseCurve(curve: unknown): Promise<boolean> {
    const response = await this.request('POST', '/eq/house-curve', curve);
    return response.status === 200;
  }

  // ============================================================
  // MEASUREMENT GROUPS (P2)
  // ============================================================

  /**
   * List all measurement groups
   */
  async listGroups(): Promise<unknown[]> {
    const response = await this.request('GET', '/groups');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Create a new measurement group.
   *
   * Body is a partial GroupInfo ({name}); REW assigns the uuid. Although the
   * spec declares the response as APIResponse, live REW (0.9.5) returns the
   * created GroupInfo including the assigned uuid, which is read back here.
   */
  async createGroup(name: string): Promise<{ id: string }> {
    const response = await this.request('POST', '/groups', { name });
    if (response.status !== 200 && response.status !== 201) {
      this.handleResponseError(response, 'Create group');
    }
    const data = response.data as Record<string, unknown>;
    return { id: (data.id as string) || (data.uuid as string) || '' };
  }

  /**
   * Get group details
   */
  async getGroup(groupId: string): Promise<unknown> {
    const response = await this.request('GET', `/groups/${groupId}`);
    if (response.status !== 200) {
      this.handleResponseError(response, `Group ${groupId}`);
    }
    return response.data;
  }

  /**
   * Update a group
   */
  async updateGroup(groupId: string, data: unknown): Promise<boolean> {
    const response = await this.request('PUT', `/groups/${groupId}`, data);
    return response.status === 200;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<boolean> {
    const response = await this.request('DELETE', `/groups/${groupId}`);
    return response.status === 200 || response.status === 204;
  }

  /**
   * List measurements in a group
   */
  async getGroupMeasurements(groupId: string): Promise<unknown[]> {
    const response = await this.request('GET', `/groups/${groupId}/measurements`);
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Add a measurement to a group
   */
  async addMeasurementToGroup(groupId: string, measurementUuid: string): Promise<boolean> {
    const response = await this.request('POST', `/groups/${groupId}/measurements`, { uuid: measurementUuid });
    return response.status === 200 || response.status === 201;
  }

  /**
   * Remove a measurement from a group, leaving the group and its other members
   * intact.
   *
   * The REW API (0.9.5) has no direct "remove from group" endpoint. Group
   * membership is singular and deleting a group ungroups its members, so this
   * moves the measurement into a throwaway group and deletes that group, which
   * leaves the measurement ungrouped. Verified live against REW 5.40 Beta 130.
   *
   * The measurement must currently be in `groupId`; otherwise this is a no-op
   * that returns false (nothing was removed from the requested group).
   */
  async removeMeasurementFromGroup(groupId: string, measurementUuid: string): Promise<boolean> {
    // Guard: only act if the measurement is actually in the requested group.
    const members = await this.getGroupMeasurements(groupId);
    const isMember = members.some(
      (m) => (m as { uuid?: string }).uuid === measurementUuid
    );
    if (!isMember) {
      return false;
    }

    // Move the measurement into a throwaway group (removes it from groupId),
    // then delete that group to leave the measurement ungrouped.
    const temp = await this.createGroup(`__rew-mcp-ungroup-${measurementUuid}__`);
    if (!temp.id) {
      return false;
    }
    const moved = await this.addMeasurementToGroup(temp.id, measurementUuid);
    const deleted = await this.deleteGroup(temp.id);
    return moved && deleted;
  }

  // ============================================================
  // REAL-TIME ANALYZER (P2)
  // ============================================================

  /**
   * Get available RTA commands
   */
  async getRTACommands(): Promise<string[]> {
    const response = await this.request('GET', '/rta/commands');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Execute an RTA command (Start, Stop, Capture, Reset)
   */
  async executeRTACommand(command: string): Promise<{ success: boolean; status: number }> {
    const response = await this.request('POST', '/rta/command', { command, parameters: [] });
    return {
      success: response.status === 200 || response.status === 202,
      status: response.status,
    };
  }

  /**
   * Get RTA configuration
   */
  async getRTAConfiguration(): Promise<unknown> {
    const response = await this.request('GET', '/rta/configuration');
    if (response.status !== 200) {
      this.handleResponseError(response, 'RTA configuration');
    }
    return response.data;
  }

  /**
   * Set RTA configuration
   */
  async setRTAConfiguration(config: unknown): Promise<boolean> {
    const response = await this.request('POST', '/rta/configuration', config);
    return response.status === 200;
  }

  /**
   * Get current RTA spectral levels
   */
  async getRTALevels(): Promise<unknown> {
    const response = await this.request('GET', '/rta/levels');
    if (response.status !== 200) {
      this.handleResponseError(response, 'RTA levels');
    }
    return response.data;
  }

  /**
   * Decode an RTA FrequencyResponse payload (magnitude/phase are base64 float32
   * arrays; frequencies derive from startFreq with either ppo (log) or freqStep
   * (linear FFT bins)). Shared by captured-data and captured-peak-data.
   */
  private decodeRTAFrequencyResponse(data: Record<string, unknown>): RTACapturedData {
    // REW signals an empty snapshot with a bare message and no magnitude.
    if (typeof data.message === 'string' && data.magnitude === undefined) {
      return { message: data.message, frequencies_hz: [], magnitude_db: [] };
    }

    const magnitude = data.magnitude
      ? decodeREWFloatArray(data.magnitude as string)
      : [];
    const phase = data.phase
      ? decodeREWFloatArray(data.phase as string)
      : undefined;

    const startFreq = data.startFreq as number | undefined;
    const ppo = data.ppo as number | undefined;
    const freqStep = data.freqStep as number | undefined;

    let frequencies: number[] = [];
    if (startFreq !== undefined && magnitude.length > 0) {
      if (ppo !== undefined && ppo > 0) {
        const logRatio = Math.log(2) / ppo;
        frequencies = magnitude.map((_, i) => startFreq * Math.exp(i * logRatio));
      } else if (freqStep !== undefined && freqStep > 0) {
        frequencies = magnitude.map((_, i) => startFreq + i * freqStep);
      }
    }

    const result: RTACapturedData = {
      unit: data.unit as string | undefined,
      smoothing: data.smoothing as string | undefined,
      frequencies_hz: frequencies,
      magnitude_db: magnitude,
      nanotime: data.nanotime as number | undefined,
      total_samples_processed: data.totalSamplesProcessed as number | undefined
    };
    if (phase) result.phase_degrees = phase;
    return result;
  }

  /**
   * Get the current captured RTA snapshot as decoded frequency/magnitude arrays.
   *
   * @param options.unit  Optional magnitude unit (spec query `unit`)
   * @param options.index Optional capture index (spec query `index`)
   */
  async getRTACapturedData(options?: { unit?: string; index?: string }): Promise<RTACapturedData> {
    const response = await this.request('GET', this.rtaCapturePath('/rta/captured-data', options));
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, 'RTA captured data');
    }
    return this.decodeRTAFrequencyResponse(response.data as Record<string, unknown>);
  }

  /**
   * Get the captured RTA peak-hold snapshot as decoded frequency/magnitude arrays.
   */
  async getRTACapturedPeakData(options?: { unit?: string; index?: string }): Promise<RTACapturedData> {
    const response = await this.request('GET', this.rtaCapturePath('/rta/captured-peak-data', options));
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, 'RTA captured peak data');
    }
    return this.decodeRTAFrequencyResponse(response.data as Record<string, unknown>);
  }

  /** Build an RTA capture path with optional unit/index query parameters. */
  private rtaCapturePath(base: string, options?: { unit?: string; index?: string }): string {
    const params = new URLSearchParams();
    if (options?.unit) params.set('unit', options.unit);
    if (options?.index) params.set('index', options.index);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  /**
   * Get RTA distortion data (THD + harmonics)
   */
  async getRTADistortion(): Promise<unknown> {
    const response = await this.request('GET', '/rta/distortion');
    if (response.status !== 200) {
      this.handleResponseError(response, 'RTA distortion');
    }
    return response.data;
  }
}

// Export singleton instance factory
export function createREWApiClient(config?: Partial<REWApiConfig>): REWApiClient {
  return new REWApiClient(config);
}

// Default client instance
let defaultClient: REWApiClient | null = null;

export function getDefaultClient(): REWApiClient {
  if (!defaultClient) {
    defaultClient = new REWApiClient();
  }
  return defaultClient;
}

export function resetDefaultClient(): void {
  if (defaultClient) {
    defaultClient.disconnect();
    defaultClient = null;
  }
}
