/**
 * REW API Client
 *
 * Connects to REW's REST API at localhost:4735
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
 */

import { decodeREWFloatArray } from './base64-decoder.js';
import type { FrequencyResponseData, ImpulseResponseData } from '../types/index.js';

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
   * Connect to REW API and verify connection
   */
  async connect(): Promise<ConnectionStatus> {
    try {
      // Try to get application info
      const response = await this.request('GET', '/application');
      
      if (response.status !== 200) {
        return {
          connected: false,
          measurements_available: 0,
          api_capabilities: { pro_features: false, blocking_mode: false },
          error_message: response.error || `HTTP ${response.status}`
        };
      }

      // Get measurement count
      const measurementsResponse = await this.request('GET', '/measurements');
      const measurementCount = Array.isArray(measurementsResponse.data) 
        ? measurementsResponse.data.length 
        : 0;

      // Check for blocking mode capability
      const blockingResponse = await this.request('GET', '/application/blocking');
      const hasBlocking = blockingResponse.status === 200;

      this.connected = true;

      return {
        connected: true,
        rew_version: response.data?.version,
        measurements_available: measurementCount,
        api_capabilities: {
          pro_features: response.data?.proFeatures || false,
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
  async getMeasurement(uuid: string): Promise<MeasurementData | null> {
    const response = await this.request('GET', `/measurements/${uuid}`);
    
    if (response.status !== 200) {
      return null;
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
  ): Promise<FrequencyResponseData | null> {
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
      return null;
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
  ): Promise<ImpulseResponseData | null> {
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
      return null;
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
  async getWaterfallData(uuid: string): Promise<WaterfallData | null> {
    console.warn('REW API: getWaterfallData endpoint may not exist in official REW API');
    
    const response = await this.request('GET', `/measurements/${uuid}/waterfall`);
    
    if (response.status !== 200 || !response.data) {
      return null;
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
  async getRT60(uuid: string): Promise<RT60Data | null> {
    const response = await this.request('GET', `/measurements/${uuid}/rt60`);
    
    if (response.status !== 200 || !response.data) {
      return null;
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
