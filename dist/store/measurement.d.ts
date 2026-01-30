/**
 * In-memory Measurement Store
 *
 * Stores parsed REW measurements for analysis operations.
 */
import type { StoredMeasurement, MeasurementMetadata } from '../types/index.js';
declare class MeasurementStore {
    private measurements;
    /**
     * Generate a unique measurement ID from metadata
     */
    generateId(metadata: MeasurementMetadata): string;
    /**
     * Store a measurement
     */
    store(measurement: StoredMeasurement): void;
    /**
     * Get a measurement by ID
     */
    get(id: string): StoredMeasurement | undefined;
    /**
     * Check if a measurement exists
     */
    has(id: string): boolean;
    /**
     * Get all measurements
     */
    getAll(): StoredMeasurement[];
    /**
     * Get measurements by speaker ID
     */
    getBySpeaker(speakerId: string): StoredMeasurement[];
    /**
     * Get measurements by condition
     */
    getByCondition(condition: string): StoredMeasurement[];
    /**
     * List all measurement IDs with basic info
     */
    list(): Array<{
        id: string;
        speaker_id: string;
        condition: string;
        timestamp: string;
        data_type: string;
        frequency_range_hz: [number, number];
    }>;
    /**
     * Delete a measurement
     */
    delete(id: string): boolean;
    /**
     * Clear all measurements
     */
    clear(): void;
    /**
     * Get count of stored measurements
     */
    get count(): number;
}
export declare const measurementStore: MeasurementStore;
export {};
//# sourceMappingURL=measurement.d.ts.map