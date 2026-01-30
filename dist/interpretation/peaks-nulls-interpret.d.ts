/**
 * Peaks and Nulls Interpretation
 *
 * Wraps peaks-nulls analysis with plain language summaries and SBIR classification.
 * Provides GLM-aware recommendations for addressable issues.
 */
import type { DetectedPeak, DetectedNull, ConfidenceLevel } from '../types/index.js';
import type { InterpretedResult } from './types.js';
export interface SBIRClassification {
    is_sbir: boolean;
    confidence: ConfidenceLevel;
    estimated_boundary_distance_ft?: number;
    boundary_type?: 'rear_wall' | 'front_wall' | 'side_wall' | 'floor' | 'ceiling' | 'unknown';
    explanation: string;
}
export interface PeaksNullsData {
    peaks: DetectedPeak[];
    nulls: DetectedNull[];
    sbir_nulls: Array<DetectedNull & {
        sbir_classification: SBIRClassification;
    }>;
}
/**
 * Classify a null as SBIR (Speaker Boundary Interference Response)
 *
 * SBIR occurs when sound reflects off a nearby boundary and cancels the direct sound.
 * Detection criteria:
 * - Frequency range: 60-300 Hz (below = room modes, above = unlikely)
 * - Q factor: > 5 (narrow null from single reflection)
 * - Distance range: 1-4 ft (typical speaker-to-boundary distance)
 *
 * Uses quarter-wavelength formula: distance_ft = 1125 / (4 * frequency_hz)
 */
export declare function classifySBIR(null_: DetectedNull): SBIRClassification;
/**
 * Interpret peaks and nulls analysis with SBIR classification
 */
export declare function interpretPeaksNulls(peaks: DetectedPeak[], nulls: DetectedNull[]): InterpretedResult<PeaksNullsData>;
//# sourceMappingURL=peaks-nulls-interpret.d.ts.map