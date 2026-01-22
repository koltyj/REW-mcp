/**
 * History Resource Handler
 *
 * Provides read access to measurement history for a session via MCP Resources.
 * URI scheme: history://{session_id}
 */

import { getSession, type SessionState } from '../session/index.js';
import { measurementStore } from '../store/measurement.js';

/**
 * Measurement summary in history
 */
export interface MeasurementSummary {
  measurement_id?: string;
  channel: 'left' | 'right' | 'sub';
  timestamp: number;
  summary: {
    variance_40_200hz?: number;
    peak_spl_db?: number;
    frequency_range?: [number, number];
  };
}

/**
 * History resource data format
 */
export interface HistoryResourceData {
  session_id: string;
  measurements: MeasurementSummary[];
}

/**
 * Read measurement history for a session
 *
 * @param sessionId - Session UUID
 * @returns Measurement history with summaries
 * @throws Error with code -32002 if session not found
 */
export function readHistoryResource(sessionId: string): HistoryResourceData {
  let session: SessionState;
  try {
    session = getSession(sessionId);
  } catch (e) {
    const error = new Error(`Session not found: ${sessionId}`);
    (error as any).code = -32002;
    throw error;
  }

  const measurements: MeasurementSummary[] = session.measurements.map((m) => {
    const summary: MeasurementSummary = {
      measurement_id: m.uuid,
      channel: m.channel,
      timestamp: m.timestamp,
      summary: {},
    };

    // If we have a UUID, try to get summary from measurement store
    if (m.uuid) {
      // Note: Session measurements use UUID from REW, but measurement store uses generated IDs
      // We try to find matching measurement by iterating stored measurements
      const storedMeasurements = measurementStore.getAll();
      const matching = storedMeasurements.find(
        (stored) => stored.id === m.uuid || stored.parsed_file_metadata.measurement_name === m.name
      );

      if (matching) {
        summary.summary = {
          variance_40_200hz: matching.quick_stats.variance_20_200hz_db,
          peak_spl_db: Math.max(...matching.frequency_response.spl_db),
          frequency_range:
            matching.frequency_response.frequencies_hz.length > 0
              ? [
                  matching.frequency_response.frequencies_hz[0],
                  matching.frequency_response.frequencies_hz[
                    matching.frequency_response.frequencies_hz.length - 1
                  ],
                ]
              : undefined,
        };
      }
    }

    return summary;
  });

  return {
    session_id: session.session_id,
    measurements,
  };
}
