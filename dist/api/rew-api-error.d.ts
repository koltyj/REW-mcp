/**
 * REW API Error Types
 *
 * Discriminated error codes for structured error handling.
 * Enables tools to distinguish between different failure modes.
 */
export type REWApiErrorCode = 'NOT_FOUND' | 'CONNECTION_REFUSED' | 'TIMEOUT' | 'INTERNAL_ERROR' | 'INVALID_RESPONSE';
/**
 * REW API Error Class
 *
 * Thrown by API client methods on failure instead of returning null.
 * Contains discriminated error code for type-safe error handling in tools.
 */
export declare class REWApiError extends Error {
    readonly code: REWApiErrorCode;
    readonly httpStatus: number;
    constructor(message: string, code: REWApiErrorCode, httpStatus: number);
}
//# sourceMappingURL=rew-api-error.d.ts.map