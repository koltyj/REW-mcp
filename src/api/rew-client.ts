/**
 * REW API Client
 *
 * Connects to REW's REST API at localhost:4735
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
 */

import { decodeREWFloatArray } from './base64-decoder.js';
import type { FrequencyResponseData, ImpulseResponseData } from '../types/index.js';
import { REWApiError } from './rew-api-error.js';

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
  data?: any;
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
    body?: any
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
      const apiVersion = healthCheck.data?.info?.version;

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
      const rewVersion = appResponse.status === 200 ? appResponse.data?.version : apiVersion;
      const hasProFeatures = appResponse.status === 200 ? (appResponse.data?.proFeatures || false) : false;

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
      const version = docResponse.data?.info?.version;
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

    return response.data.map((m: any, index: number) => ({
      uuid: m.uuid || m.id || `measurement_${index}`,
      name: m.name || `Measurement ${index + 1}`,
      index,
      type: m.type || 'unknown',
      has_ir: m.hasImpulse !== false,
      has_fr: m.hasFrequencyResponse !== false
    }));
  }

  /**
   * Get a specific measurement by UUID
   */
  async getMeasurement(uuid: string): Promise<MeasurementData> {
    const response = await this.request('GET', `/measurements/${uuid}`);

    if (response.status !== 200) {
      this.handleResponseError(response, `Measurement ${uuid}`);
    }

    const data = response.data;

    return {
      uuid: data.uuid || uuid,
      name: data.name || 'Unknown',
      metadata: {
        sample_rate_hz: data.sampleRate,
        start_time: data.startTime,
        notes: data.notes
      }
    };
  }

  /**
   * Get frequency response data from a measurement
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

    const data = response.data;

    // Decode Base64 arrays per REW API spec
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies)
      : [];
    const spl = data.magnitude || data.spl
      ? decodeREWFloatArray(data.magnitude || data.spl)
      : [];
    const phase = data.phase
      ? decodeREWFloatArray(data.phase)
      : frequencies.map(() => 0);

    return {
      frequencies_hz: frequencies,
      spl_db: spl,
      phase_degrees: phase
    };
  }

  /**
   * Get impulse response data from a measurement
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

    const data = response.data;

    // Decode Base64 array
    const samples = data.samples
      ? decodeREWFloatArray(data.samples)
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

    const sampleRate = data.sampleRate || 48000;

    return {
      samples,
      sample_rate_hz: sampleRate,
      peak_index: peakIndex,
      start_time_s: data.startTime || 0,
      duration_s: samples.length / sampleRate
    };
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

    const data = response.data;

    // Decode frequency array
    const frequencies = data.frequencies
      ? decodeREWFloatArray(data.frequencies)
      : [];

    // Time slices
    const timeSlices = data.timeSlices || [];

    // Magnitude data (2D array)
    const magnitude: number[][] = [];
    if (Array.isArray(data.magnitude)) {
      for (const slice of data.magnitude) {
        if (typeof slice === 'string') {
          magnitude.push(decodeREWFloatArray(slice));
        } else if (Array.isArray(slice)) {
          magnitude.push(slice);
        }
      }
    }

    return {
      frequencies_hz: frequencies,
      time_slices_ms: timeSlices,
      magnitude_db: magnitude
    };
  }

  /**
   * Get RT60 data
   */
  async getRT60(uuid: string): Promise<RT60Data> {
    const response = await this.request('GET', `/measurements/${uuid}/rt60`);

    if (response.status !== 200 || !response.data) {
      this.handleResponseError(response, `RT60 data for ${uuid}`);
    }

    const data = response.data;

    return {
      frequencies_hz: data.frequencies ? decodeREWFloatArray(data.frequencies) : [],
      t20_seconds: data.t20 ? decodeREWFloatArray(data.t20) : [],
      t30_seconds: data.t30 ? decodeREWFloatArray(data.t30) : [],
      edt_seconds: data.edt ? decodeREWFloatArray(data.edt) : []
    };
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
    data?: any;
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
    return response.data;
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
    return response.data;
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
  async getMeasureNaming(): Promise<any> {
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
    return response.data;
  }

  async setMeasureNotes(notes: string): Promise<boolean> {
    const response = await this.request('POST', '/measure/notes', notes);
    return response.status === 200;
  }

  /**
   * Get timing reference settings
   */
  async getTimingReference(): Promise<any> {
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
    return response.data;
  }

  /**
   * Get current audio driver
   */
  async getAudioDriver(): Promise<string> {
    const response = await this.request('GET', '/audio/driver');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Audio driver');
    }
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
  async getInputCalibration(): Promise<any> {
    const response = await this.request('GET', '/audio/input-cal');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Input calibration');
    }
    return response.data;
  }

  // ============================================================
  // SIGNAL GENERATOR METHODS
  // ============================================================

  /**
   * Get generator status
   */
  async getGeneratorStatus(): Promise<{
    enabled: boolean;
    playing: boolean;
    signal?: string;
    level?: number;
  }> {
    const response = await this.request('GET', '/generator/status');
    if (response.status !== 200) {
      this.handleResponseError(response, 'Generator status');
    }
    return response.data;
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
    return response.data;
  }

  /**
   * Set generator signal
   * API expects: { signal: "pinknoise" }
   */
  async setGeneratorSignal(signal: string): Promise<boolean> {
    const response = await this.request('POST', '/generator/signal', { signal });
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
    return response.data;
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
    return response.data;
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
    return response.data;
  }

  /**
   * Get SPL meter configuration
   */
  async getSPLMeterConfig(meterId: number): Promise<any> {
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
