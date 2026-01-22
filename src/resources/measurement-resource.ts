/**
 * Measurement Resource Handler
 *
 * Provides read access to full measurement data via MCP Resources.
 * URI scheme: measurement://{measurement_id}
 */

import { measurementStore } from '../store/measurement.js';

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
export function readMeasurementResource(measurementId: string): MeasurementResourceData {
  const measurement = measurementStore.get(measurementId);

  if (!measurement) {
    const error = new Error(`Measurement not found: ${measurementId}`);
    (error as any).code = -32002;
    throw error;
  }

  return {
    id: measurement.id,
    metadata: {
      speaker_id: measurement.metadata.speaker_id,
      condition: measurement.metadata.condition,
      mic_position_id: measurement.metadata.mic_position_id,
      notes: measurement.metadata.notes,
    },
    frequency_response: {
      frequencies_hz: measurement.frequency_response.frequencies_hz,
      spl_db: measurement.frequency_response.spl_db,
      phase_degrees: measurement.frequency_response.phase_degrees,
    },
    timestamp: measurement.timestamp,
  };
}

/**
 * List all measurement resources for dynamic resource list
 *
 * @returns Array of resource descriptors for stored measurements
 */
export function listMeasurementResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  const measurements = measurementStore.list();
  return measurements.map((m) => ({
    uri: `measurement://${m.id}`,
    name: `Measurement ${m.id}`,
    description: `${m.speaker_id} - ${m.condition} (${m.data_type})`,
    mimeType: 'application/json',
  }));
}
