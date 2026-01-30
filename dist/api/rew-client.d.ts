/**
 * REW API Client
 *
 * Connects to REW's REST API at localhost:4735
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
 */
import type { FrequencyResponseData, ImpulseResponseData } from '../types/index.js';
export interface REWApiConfig {
    host: string;
    port: number;
    timeout: number;
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
    smoothing?: string;
    ppo?: number;
    unit?: string;
}
export interface ImpulseResponseOptions {
    windowed?: boolean;
}
export interface WaterfallData {
    frequencies_hz: number[];
    time_slices_ms: number[];
    magnitude_db: number[][];
}
export interface RT60Data {
    frequencies_hz: number[];
    t20_seconds: number[];
    t30_seconds: number[];
    edt_seconds: number[];
}
/**
 * REW API Client Class
 */
export declare class REWApiClient {
    private config;
    private connected;
    private baseUrl;
    constructor(config?: Partial<REWApiConfig>);
    /**
     * Make an HTTP request to the REW API
     */
    private request;
    /**
     * Handle API response errors with typed exceptions
     * @param response - REW API response
     * @param context - Context for error message (e.g., "Measurement abc123")
     * @throws REWApiError with appropriate error code
     */
    private handleResponseError;
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
    connect(): Promise<ConnectionStatus>;
    /**
     * Check API health without full connection
     * Returns diagnostic info about the API server state
     */
    healthCheck(): Promise<{
        server_responding: boolean;
        openapi_available: boolean;
        api_version?: string;
        error?: string;
        suggestion?: string;
    }>;
    /**
     * Disconnect from API (cleanup)
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * List all measurements in REW
     * Per REW docs: "use UUIDs as indices shift when measurements are added/removed"
     */
    listMeasurements(): Promise<MeasurementInfo[]>;
    /**
     * Get a specific measurement by UUID
     */
    getMeasurement(uuid: string): Promise<MeasurementData>;
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
    getFrequencyResponse(uuid: string, options?: FrequencyResponseOptions): Promise<FrequencyResponseData>;
    /**
     * Get impulse response data from a measurement
     *
     * Per REW API docs, ImpulseResponse returns:
     * - startTime: start time
     * - sampleInterval: sample interval in seconds
     * - sampleRate: sample rate in Hz
     * - data: Base64-encoded response data (NOT 'samples')
     */
    getImpulseResponse(uuid: string, options?: ImpulseResponseOptions): Promise<ImpulseResponseData>;
    /**
     * Get waterfall data
     *
     * @deprecated This endpoint may not exist in the official REW API.
     * Per audit (Jan 2026): No evidence found in official REW API documentation
     * for a direct waterfall data retrieval endpoint. The API supports generating
     * waterfall graphs via commands but may not stream raw waterfall matrix data.
     * Consider deriving waterfall data from impulse response instead.
     */
    getWaterfallData(uuid: string): Promise<WaterfallData>;
}
export declare function createREWApiClient(config?: Partial<REWApiConfig>): REWApiClient;
export declare function getDefaultClient(): REWApiClient;
export declare function resetDefaultClient(): void;
//# sourceMappingURL=rew-client.d.ts.map