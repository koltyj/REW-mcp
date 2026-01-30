/**
 * REW API Base64 Float Array Decoder
 *
 * Reference: REW API docs state arrays use "big-endian" 32-bit floats
 * Base64: PgAAAD6AAAA+wAAAPwAAAA==
 * Result: {0.125f, 0.25f, 0.375f, 0.5f}
 */
/**
 * Decode REW API Base64-encoded float array
 *
 * Per REW documentation, arrays are "Base64-encoded strings from raw bytes
 * of 32-bit float values" with "big-endian" byte order.
 */
export declare function decodeREWFloatArray(base64String: string): number[];
/**
 * Encode a number array to REW API Base64 format
 * Useful for sending data back to REW if needed
 */
export declare function encodeREWFloatArray(values: number[]): string;
/**
 * Validate that a Base64 string is valid for REW float array decoding
 */
export declare function isValidREWBase64(base64String: string): boolean;
//# sourceMappingURL=base64-decoder.d.ts.map