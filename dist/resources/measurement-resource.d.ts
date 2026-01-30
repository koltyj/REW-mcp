/**
 * Measurement Resource Handler
 *
 * Provides read access to full measurement data via MCP Resources.
 * URI scheme: measurement://{measurement_id}
 */
/**
 * Measurement resource data format
 */
export interface MeasurementResourceData {
    id: string;
    metadata: {
        speaker_id: string;
        condition: string;
        mic_position_id?: string;
        notes?: string;
    };
    frequency_response: {
        frequencies_hz: number[];
        spl_db: number[];
        phase_degrees: number[];
    };
    timestamp: string;
}
/**
 * Read full measurement data for resource
 *
 * @param measurementId - Measurement ID
 * @returns Full measurement data including frequency response arrays
 * @throws Error with code -32002 if measurement not found
 */
export declare function readMeasurementResource(measurementId: string): MeasurementResourceData;
/**
 * List all measurement resources for dynamic resource list
 *
 * @returns Array of resource descriptors for stored measurements
 */
export declare function listMeasurementResources(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}>;
//# sourceMappingURL=measurement-resource.d.ts.map