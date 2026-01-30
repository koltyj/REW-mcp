/**
 * REW Text Export Parser
 *
 * Parses Room EQ Wizard frequency response and impulse response text exports.
 * Based on the specification in docs/file-formats.md
 */
import type { FrequencyResponseData, ImpulseResponseData, ParsedFileMetadata, DataQuality } from '../types/index.js';
export interface ParseResult {
    frequency_response: FrequencyResponseData;
    impulse_response?: ImpulseResponseData;
    parsed_metadata: ParsedFileMetadata;
    data_quality: DataQuality;
}
/**
 * Detect the format of a REW export file
 */
export declare function detectFormat(content: string): 'frequency_response' | 'impulse_response' | 'unknown';
/**
 * Parse frequency response text export
 */
export declare function parseFrequencyResponse(content: string): ParseResult;
/**
 * Parse impulse response text export
 *
 * Supports both formats:
 * - 2-column format: Time (seconds), Amplitude (common REW export)
 * - 1-column format: Header with sample rate, followed by amplitude values only
 */
export declare function parseImpulseResponse(content: string): {
    impulse_response: ImpulseResponseData;
    parsed_metadata: ParsedFileMetadata;
    data_quality: DataQuality;
};
/**
 * Main parse function - auto-detects format
 */
export declare function parseREWExport(content: string): ParseResult;
//# sourceMappingURL=rew-text.d.ts.map