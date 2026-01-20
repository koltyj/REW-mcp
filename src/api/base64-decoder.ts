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
export function decodeREWFloatArray(base64String: string): number[] {
  if (!base64String || base64String.length === 0) {
    return [];
  }

  const buffer = Buffer.from(base64String, 'base64');
  const floats: number[] = [];

  // Each float is 4 bytes
  for (let i = 0; i < buffer.length; i += 4) {
    if (i + 4 <= buffer.length) {
      // Big-endian 32-bit float
      floats.push(buffer.readFloatBE(i));
    }
  }

  return floats;
}

/**
 * Encode a number array to REW API Base64 format
 * Useful for sending data back to REW if needed
 */
export function encodeREWFloatArray(values: number[]): string {
  if (!values || values.length === 0) {
    return '';
  }

  const buffer = Buffer.alloc(values.length * 4);

  for (let i = 0; i < values.length; i++) {
    buffer.writeFloatBE(values[i], i * 4);
  }

  return buffer.toString('base64');
}

/**
 * Validate that a Base64 string is valid for REW float array decoding
 */
export function isValidREWBase64(base64String: string): boolean {
  if (base64String.length === 0) {
    return true;
  }
  
  // Check for valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64String)) {
    return false;
  }
  
  // Check that length is valid for base64 (multiple of 4)
  if (base64String.length % 4 !== 0) {
    return false;
  }
  
  try {
    const buffer = Buffer.from(base64String, 'base64');
    // Must be divisible by 4 bytes (32-bit floats)
    return buffer.length % 4 === 0;
  } catch {
    return false;
  }
}
