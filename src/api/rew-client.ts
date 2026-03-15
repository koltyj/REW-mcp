/**
 * REW API Client
 *
 * Connects to REW's REST API at localhost:4735
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
 */

import { decodeREWFloatArray } from './base64-decoder.js';
import type { FrequencyResponseData, ImpulseResponseData, GroupDelayData, DistortionData } from '../types/index.js';
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
  type InputLevels
} from './schemas.js';

export interface REWApiConfig {
  host: string;      // Default: '127.0.0.1'
  port: number;      // Default: 4735
  timeout: number;   // Default: 10000ms
}

export interface ConnectionStatus {
  connected: boolean;
  rew_version?: string;
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

export interface WaterfallData {
  frequencies_hz: number[];
  time_slices_ms: number[];
  magnitude_db: number[][]; // [time_index][freq_index]
}

export interface RT60Data {
  frequencies_hz: number[];
  t20_seconds: number[];
  t30_seconds: number[];
  edt_seconds: number[];
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
   * Connect to REW API and verify connection
   *
   * Per REW docs, the API is accessible at localhost:4735 by default.
   * The OpenAPI spec is at /doc.json or /doc.yaml.
   * Swagger UI is served at the root URL.
   *
   * NOTE: The /application endpoint may not exist in all REW versions,
   * so we use /doc.json and /measurements as the primary health checks.
   */
  async connect(): Promise<ConnectionStatus> {
    try {
      // First, verify the API server is actually running by checking the OpenAPI spec
      // This is the most reliable endpoint since swagger-ui serves it
      const healthCheck = await this.request('GET', '/doc.json');
      
      if (healthCheck.status === 0) {
        // Connection refused - REW not running or API not enabled
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: `Cannot connect to REW at ${this.baseUrl}. Ensure REW is running and the API is enabled in Preferences → API (click "Start" button).`
        };
      }
      
      if (healthCheck.status === 404) {
        // Server responding but endpoint not found - likely wrong port or old REW version
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: `REW API endpoint not found (HTTP 404). This usually means: (1) REW version is too old (API requires v5.30+), or (2) The API server isn't started. Check Preferences → API and click "Start". Also verify the port number matches.`
        };
      }
      
      if (healthCheck.status !== 200) {
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: healthCheck.error || `Unexpected HTTP ${healthCheck.status} from /doc.json endpoint`
        };
      }

      // Extract API version from OpenAPI spec
      const apiVersion = (healthCheck.data as Record<string, unknown>)?.info ?
        ((healthCheck.data as Record<string, unknown>).info as Record<string, unknown>).version as string :
        undefined;

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

      const measurementCount = Array.isArray(measurementsResponse.data) 
        ? measurementsResponse.data.length 
        : 0;

      // Try to get application info (optional - may not exist in all versions)
      const appResponse = await this.request('GET', '/application');
      const appData = appResponse.data as Record<string, unknown> | undefined;
      const rewVersion = appResponse.status === 200 ? (appData?.version as string) : apiVersion;
      const hasProFeatures = appResponse.status === 200 ? ((appData?.proFeatures as boolean) || false) : false;

      // Check for blocking mode capability (optional)
      const blockingResponse = await this.request('GET', '/application/blocking');
      const hasBlocking = blockingResponse.status === 200;

      this.connected = true;

      return {
        connected: true,
        rew_version: rewVersion,
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
    error?: string;
    suggestion?: string;
  }> {
    // Try the OpenAPI spec first
    const docResponse = await this.request('GET', '/doc.json');
    
    if (docResponse.status === 0) {
      return {
        server_responding: false,
        openapi_available: false,
        error: docResponse.error || 'Connection refused',
        suggestion: 'REW is not responding. Ensure REW is running and go to Preferences → API → click "Start".'
      };
    }

    if (docResponse.status === 404) {
      // Something is responding but it's not the REW API
      return {
        server_responding: true,
        openapi_available: false,
        error: 'HTTP 404 - API spec not found',
        suggestion: 'A server is responding but the REW API is not available. Check: (1) REW version is 5.30+, (2) API is enabled and started in Preferences → API, (3) Port number is correct.'
      };
    }

    if (docResponse.status === 200) {
      // Extract version from OpenAPI spec if available
      const docData = docResponse.data as Record<string, unknown> | undefined;
      const version = docData?.info ? ((docData.info as Record<string, unknown>).version as string) : undefined;
      return {
        server_responding: true,
        openapi_available: true,
        api_version: version
      };
    }

    return {
      server_responding: true,
      openapi_available: false,
      error: `Unexpected status: ${docResponse.status}`,
      suggestion: 'Check REW API settings and try restarting the API server.'
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

    if (response.status !== 200 || !Array.isArray(response.data)) {
      return [];
    }

    return response.data.map((m: unknown, index: number) => {
      const parsed = MeasurementInfoSchema.safeParse(m);
      if (!parsed.success) {
        // Fallback for malformed data
        return {
          uuid: String((m as Record<string, unknown>)?.uuid ?? (m as Record<string, unknown>)?.id ?? `measurement-${index}`),
          name: String((m as Record<string, unknown>)?.name ?? `Measurement ${index + 1}`),
          index,
          type: 'unknown',
          has_ir: false,
          has_fr: false
        };
      }
      return {
        uuid: parsed.data.uuid || parsed.data.id || `measurement_${index}`,
        name: parsed.data.name || `Measurement ${index + 1}`,
        index: parsed.data.index ?? index,
        type: parsed.data.type || 'unknown',
        has_ir: parsed.data.has_ir ?? (parsed.data.hasImpulse !== false),
        has_fr: parsed.data.has_fr ?? (parsed.data.hasFrequencyResponse !== false)
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
      name: (data.name as string) || 'Unknown',
      metadata: {
        sample_rate_hz: data.sampleRate as number | undefined,
        start_time: data.startTime as string | undefined,
        notes: data.notes as string | undefined
      }
    };
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
   * Get waterfall data
   *
   * @deprecated This endpoint may not exist in the official REW API.
   * Per audit (Jan 2026): No evidence found in official REW API documentation
   * for a direct waterfall data retrieval endpoint. The API supports generating
   * waterfall graphs via commands but may not stream raw waterfall matrix data.
   * Consider deriving waterfall data from impulse response instead.
   */
  async getWaterfallData(uuid: string): Promise<WaterfallData> {
    console.warn('REW API: getWaterfallData endpoint may not exist in official REW API');

    const response = await this.request('GET', `/measurements/${uuid}/waterfall`);

    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `Waterfall data for ${uuid}`);
    }

    const rawData = response.data as Record<string, unknown>;

    // Decode frequency array
    const frequencies = rawData.frequencies
      ? decodeREWFloatArray(rawData.frequencies as string)
      : [];

    // Time slices
    const timeSlices = (rawData.timeSlices as number[]) || [];

    // Magnitude data (2D array)
    const magnitude: number[][] = [];
    if (Array.isArray(rawData.magnitude)) {
      for (const slice of rawData.magnitude) {
        if (typeof slice === 'string') {
          magnitude.push(decodeREWFloatArray(slice));
        } else if (Array.isArray(slice)) {
          magnitude.push(slice);
        }
      }
    }

    const result = {
      frequencies_hz: frequencies,
      time_slices_ms: timeSlices,
      magnitude_db: magnitude
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

    const data = response.data as Record<string, unknown>;

    const result = {
      frequencies_hz: data.frequencies ? decodeREWFloatArray(data.frequencies as string) : [],
      t20_seconds: data.t20 ? decodeREWFloatArray(data.t20 as string) : [],
      t30_seconds: data.t30 ? decodeREWFloatArray(data.t30 as string) : [],
      edt_seconds: data.edt ? decodeREWFloatArray(data.edt as string) : []
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
  async executeMeasureCommand(command: string, parameters?: string[]): Promise<{
    success: boolean;
    status: number;
    message?: string;
    data?: unknown;
  }> {
    const body = { 
      command, 
      parameters: parameters || [] 
    };
    
    const response = await this.request('POST', '/measure/command', body);
    
    return {
      success: response.status === 200 || response.status === 202,
      status: response.status,
      message: response.status === 202 ? 'Measurement started (async)' : undefined,
      data: response.data
    };
  }

  /**
   * Get current measurement level
   */
  async getMeasureLevel(): Promise<{ level: number; unit: string }> {
    const response = await this.request('GET', '/measure/level');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Measurement level');
    }
    return response.data as { level: number; unit: string };
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
   * Get sweep configuration
   */
  async getSweepConfig(): Promise<{
    startFreq: number;
    endFreq: number;
    length: number;
    fillSilenceWithDither?: boolean;
  }> {
    const response = await this.request('GET', '/measure/sweep/configuration');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Sweep configuration');
    }
    return response.data as {
      startFreq: number;
      endFreq: number;
      length: number;
      fillSilenceWithDither?: boolean;
    };
  }

  /**
   * Set sweep configuration
   */
  async setSweepConfig(config: {
    startFreq?: number;
    endFreq?: number;
    length?: number;
    fillSilenceWithDither?: boolean;
  }): Promise<boolean> {
    const response = await this.request('POST', '/measure/sweep/configuration', config);
    return response.status === 200;
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
   * Set measurement naming settings
   */
  async setMeasureNaming(naming: {
    prefix?: string;
    includeDate?: boolean;
    includeTime?: boolean;
    dateTimeFormat?: string;
  }): Promise<boolean> {
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
  async getAudioStatus(): Promise<{
    enabled: boolean;
    ready: boolean;
    driver?: string;
  }> {
    const response = await this.request('GET', '/audio');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Audio status');
    }
    return response.data as {
      enabled: boolean;
      ready: boolean;
      driver?: string;
    };
  }

  /**
   * Get current audio driver
   */
  async getAudioDriver(): Promise<string> {
    const response = await this.request('GET', '/audio/driver');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Audio driver');
    }
    return response.data as string;
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
    return response.data as number;
  }

  /**
   * Get available sample rates
   */
  async getAvailableSampleRates(): Promise<number[]> {
    const response = await this.request('GET', '/audio/samplerates');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
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
    return response.data as string;
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
    return response.data as string;
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
    const levelData = levelResp.status === 200 ? levelResp.data as Record<string, unknown> : {};
    return {
      signal: signalResp.status === 200 ? (signalResp.data as string) : 'unknown',
      level: (levelData?.value as number) ?? 0,
      level_unit: (levelData?.unit as string) ?? 'dBFS',
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
   * Get current generator signal
   */
  async getGeneratorSignal(): Promise<string> {
    const response = await this.request('GET', '/generator/signal');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator signal');
    }
    return response.data as string;
  }

  /**
   * Set generator signal
   *
   * Per REW API docs: "A PUT selects a new signal"
   * The PUT body should be the signal object/name
   */
  async setGeneratorSignal(signal: string): Promise<boolean> {
    // REW API docs specify PUT for signal selection
    const response = await this.request('PUT', '/generator/signal', signal);
    return response.status === 200;
  }

  /**
   * Get generator level
   */
  async getGeneratorLevel(): Promise<{ level: number; unit: string }> {
    const response = await this.request('GET', '/generator/level');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator level');
    }
    return response.data as { level: number; unit: string };
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
   * Get generator frequency (for tone signals)
   */
  async getGeneratorFrequency(): Promise<number> {
    const response = await this.request('GET', '/generator/frequency');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator frequency');
    }
    return response.data as number;
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
   * Get SPL meter levels
   */
  async getSPLMeterLevels(meterId: number): Promise<{
    spl: number;
    leq: number;
    sel: number;
    weighting: string;
    filter: string;
  }> {
    const response = await this.request('GET', `/spl-meter/${meterId}/levels`);
    if (response.status !== 200) {
      this.handleResponseError(response, `SPL meter ${meterId} levels`);
    }
    return response.data as {
      spl: number;
      leq: number;
      sel: number;
      weighting: string;
      filter: string;
    };
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
   * Set SPL meter configuration
   */
  async setSPLMeterConfig(meterId: number, config: {
    mode?: string;
    weighting?: string;
    filter?: string;
  }): Promise<boolean> {
    const response = await this.request('POST', `/spl-meter/${meterId}/configuration`, config);
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
   * API expects: { command: "start" }
   */
  async startInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', { command: 'start' });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Stop input level monitoring
   * API expects: { command: "stop" }
   */
  async stopInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', { command: 'stop' });
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
   * @param unit - Optional unit (e.g., "dBFS")
   * @returns InputLevels object or null if monitoring not active or validation fails
   */
  async getInputLevels(unit?: string): Promise<InputLevels | null> {
    let path = '/input-levels/last-levels';
    if (unit) {
      const params = new URLSearchParams({ unit });
      path += `?${params.toString()}`;
    }

    const response = await this.request('GET', path);

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
    const data = response.data as Record<string, unknown>;
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies as string)
      : (Array.isArray(data.frequencies_hz) ? data.frequencies_hz as number[] : []);
    const groupDelay = data.groupDelay
      ? decodeREWFloatArray(data.groupDelay as string)
      : (data.group_delay_ms
        ? decodeREWFloatArray(data.group_delay_ms as string)
        : []);
    const result: GroupDelayData = {
      frequencies_hz: frequencies,
      group_delay_ms: groupDelay,
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
    const data = response.data as Record<string, unknown>;
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies as string)
      : (Array.isArray(data.frequencies_hz) ? data.frequencies_hz as number[] : []);
    const thd = data.thd
      ? decodeREWFloatArray(data.thd as string)
      : (data.thd_percent
        ? decodeREWFloatArray(data.thd_percent as string)
        : []);
    const result: DistortionData = {
      frequencies_hz: frequencies,
      thd_percent: thd,
      harmonics: data.harmonics as Record<string, number[]> | undefined,
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
  async executeMeasurementCommand(uuid: string, command: string, parameters?: string[]): Promise<{
    success: boolean;
    status: number;
    data?: unknown;
  }> {
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
  async executeMeasurementsCommand(command: string, parameters?: string[]): Promise<{
    success: boolean;
    status: number;
    data?: unknown;
  }> {
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
   * Apply arithmetic operation between two measurements (A+B, A-B, A*B, A/B)
   */
  async executeArithmetic(operation: string, measurementA: string, measurementB: string): Promise<{
    success: boolean;
    uuid?: string;
  }> {
    const response = await this.request('POST', '/measurements/arithmetic', {
      operation,
      measurementA,
      measurementB,
    });
    const data = response.data as Record<string, unknown> | undefined;
    return {
      success: response.status === 200 || response.status === 201,
      uuid: data?.uuid as string | undefined,
    };
  }

  /**
   * Batch-process multiple measurements with a command
   */
  async processMeasurements(uuids: string[], command: string, parameters?: string[]): Promise<{
    success: boolean;
    status: number;
  }> {
    const response = await this.request('POST', '/measurements/process-measurements', {
      measurements: uuids,
      command,
      parameters: parameters || [],
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
  async getMeasurementFilters(uuid: string): Promise<unknown[]> {
    const response = await this.request('GET', `/measurements/${uuid}/filters`);
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Set EQ filters on a measurement
   */
  async setMeasurementFilters(uuid: string, filters: unknown[]): Promise<boolean> {
    const response = await this.request('POST', `/measurements/${uuid}/filters`, filters);
    return response.status === 200;
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
    const data = response.data as Record<string, unknown>;
    const spl = data.magnitude
      ? decodeREWFloatArray(data.magnitude as string)
      : [];
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies as string)
      : [];
    return { frequencies_hz: frequencies, spl_db: spl, phase_degrees: [] };
  }

  /**
   * Get predicted response after EQ for a measurement
   */
  async getEQPredictedResponse(uuid: string): Promise<FrequencyResponseData> {
    const response = await this.request('GET', `/measurements/${uuid}/eq/predicted-response`);
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `EQ predicted response for ${uuid}`);
    }
    const data = response.data as Record<string, unknown>;
    const spl = data.magnitude
      ? decodeREWFloatArray(data.magnitude as string)
      : [];
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies as string)
      : [];
    return { frequencies_hz: frequencies, spl_db: spl, phase_degrees: [] };
  }

  /**
   * Get individual filter response curves for a measurement
   */
  async getEQFilterResponse(uuid: string): Promise<FrequencyResponseData> {
    const response = await this.request('GET', `/measurements/${uuid}/eq/filter-response`);
    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `EQ filter response for ${uuid}`);
    }
    const data = response.data as Record<string, unknown>;
    const spl = data.magnitude
      ? decodeREWFloatArray(data.magnitude as string)
      : [];
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies as string)
      : [];
    return { frequencies_hz: frequencies, spl_db: spl, phase_degrees: [] };
  }

  /**
   * Auto-generate EQ filters to match target curve
   */
  async matchTarget(uuid: string): Promise<{ success: boolean }> {
    const response = await this.request('POST', `/measurements/${uuid}/eq/match-target`);
    return { success: response.status === 200 || response.status === 202 };
  }

  /**
   * Get groups a measurement belongs to
   */
  async getMeasurementGroups(uuid: string): Promise<unknown[]> {
    const response = await this.request('GET', `/measurements/${uuid}/groups`);
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
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
    return response.data as number;
  }

  /**
   * Set Java input channel
   */
  async setJavaInputChannel(channel: number): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/input-channel', channel);
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
    return response.data as number;
  }

  /**
   * Set reference input channel
   */
  async setJavaRefInputChannel(channel: number): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/ref-input-channel', channel);
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
    return response.data as number;
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
    return response.data as boolean;
  }

  /**
   * Set stereo-only mode
   */
  async setJavaStereoOnly(stereoOnly: boolean): Promise<boolean> {
    const response = await this.request('POST', '/audio/java/stereo-only', stereoOnly);
    return response.status === 200;
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

  /**
   * Get available sweep length options
   */
  async getSweepLengths(): Promise<number[]> {
    const response = await this.request('GET', '/measure/sweep/lengths');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
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
   * List available SPL meters
   */
  async getSPLMeters(): Promise<unknown[]> {
    const response = await this.request('GET', '/spl-meter/meters');
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get available frequency weightings for a meter
   */
  async getSPLMeterWeightings(meterId: number): Promise<string[]> {
    const response = await this.request('GET', `/spl-meter/${meterId}/weightings`);
    if (response.status !== 200) {
      return [];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get available time filters for a meter
   */
  async getSPLMeterFilters(meterId: number): Promise<string[]> {
    const response = await this.request('GET', `/spl-meter/${meterId}/filters`);
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
   * Get default EQ settings
   */
  async getEQDefaults(): Promise<unknown> {
    const response = await this.request('GET', '/eq/defaults');
    if (response.status !== 200) {
      this.handleResponseError(response, 'EQ defaults');
    }
    return response.data;
  }

  /**
   * Set default EQ settings
   */
  async setEQDefaults(defaults: unknown): Promise<boolean> {
    const response = await this.request('POST', '/eq/defaults', defaults);
    return response.status === 200;
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
   * Create a new measurement group
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
   * Remove a measurement from a group
   */
  async removeMeasurementFromGroup(groupId: string, measurementUuid: string): Promise<boolean> {
    const response = await this.request('DELETE', `/groups/${groupId}/measurements/${measurementUuid}`);
    return response.status === 200 || response.status === 204;
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
   * Get captured RTA snapshots
   */
  async getRTACapturedData(): Promise<unknown> {
    const response = await this.request('GET', '/rta/captured-data');
    if (response.status !== 200) {
      this.handleResponseError(response, 'RTA captured data');
    }
    return response.data;
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
