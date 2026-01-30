/**
 * Tool: rew.api_connect
 *
 * Connect to a running REW instance's REST API.
 * REW must be launched with -api flag or have API enabled in preferences.
 */
import { z } from 'zod';
import { REWApiClient } from '../api/rew-client.js';
import type { ToolResponse } from '../types/index.js';
export declare const ApiConnectInputSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    timeout_ms: z.ZodDefault<z.ZodNumber>;
    host: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    host: string;
    port: number;
    timeout_ms: number;
}, {
    host?: string | undefined;
    port?: number | undefined;
    timeout_ms?: number | undefined;
}>;
export type ApiConnectInput = z.infer<typeof ApiConnectInputSchema>;
export interface ApiConnectResult {
    status: 'connected' | 'error';
    rew_version?: string;
    measurements_available: number;
    api_capabilities: {
        pro_features: boolean;
        blocking_mode: boolean;
    };
    error_message?: string;
    diagnostics?: {
        server_responding: boolean;
        openapi_available: boolean;
        api_version?: string;
        tested_url: string;
    };
}
/**
 * Get the active API client (for use by other tools)
 */
export declare function getActiveApiClient(): REWApiClient | null;
/**
 * Execute API connect tool
 */
export declare function executeApiConnect(input: ApiConnectInput): Promise<ToolResponse<ApiConnectResult>>;
//# sourceMappingURL=api-connect.d.ts.map