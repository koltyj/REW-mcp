/**
 * In-memory Measurement Store
 * 
 * Stores parsed REW measurements for analysis operations.
 */

import type { StoredMeasurement, MeasurementMetadata } from '../types/index.js';

class MeasurementStore {
  private measurements: Map<string, StoredMeasurement> = new Map();

  /**
   * Generate a unique measurement ID from metadata
   */
  generateId(metadata: MeasurementMetadata): string {
    const base = `${metadata.speaker_id}_${metadata.condition}`;
    const sanitized = base.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    
    // If ID exists, append a counter
    let id = sanitized;
    let counter = 1;
    while (this.measurements.has(id)) {
      id = `${sanitized}_${counter}`;
      counter++;
    }
    
    return id;
  }

  /**
   * Store a measurement
   */
  store(measurement: StoredMeasurement): void {
    this.measurements.set(measurement.id, measurement);
  }

  /**
   * Get a measurement by ID
   */
  get(id: string): StoredMeasurement | undefined {
    return this.measurements.get(id);
  }

  /**
   * Check if a measurement exists
   */
  has(id: string): boolean {
    return this.measurements.has(id);
  }

  /**
   * Get all measurements
   */
  getAll(): StoredMeasurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Get measurements by speaker ID
   */
  getBySpeaker(speakerId: string): StoredMeasurement[] {
    return this.getAll().filter(m => m.metadata.speaker_id === speakerId);
  }

  /**
   * Get measurements by condition
   */
  getByCondition(condition: string): StoredMeasurement[] {
    return this.getAll().filter(m => m.metadata.condition === condition);
  }

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
  }> {
    return this.getAll().map(m => ({
      id: m.id,
      speaker_id: m.metadata.speaker_id,
      condition: m.metadata.condition,
      timestamp: m.timestamp,
      data_type: m.impulse_response ? 'combined' : 'frequency_response',
      frequency_range_hz: m.frequency_response.frequencies_hz.length > 0
        ? [
            m.frequency_response.frequencies_hz[0],
            m.frequency_response.frequencies_hz[m.frequency_response.frequencies_hz.length - 1]
          ] as [number, number]
        : [0, 0]
    }));
  }

  /**
   * Delete a measurement
   */
  delete(id: string): boolean {
    return this.measurements.delete(id);
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Get count of stored measurements
   */
  get count(): number {
    return this.measurements.size;
  }
}

// Export singleton instance
export const measurementStore = new MeasurementStore();
