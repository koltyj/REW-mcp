# REW-MCP Implementation Plan

> **Grounded in Official REW Documentation and MCP Specification**
>
> All features and APIs referenced in this document are based on:
> - REW Help Documentation: https://www.roomeqwizard.com/help/help_en-GB/html/
> - REW API Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
> - MCP Protocol Specification: https://modelcontextprotocol.io/specification/2025-06-18/server/tools

---

## Table of Contents

1. [Phase 1: REW API Client Integration](#phase-1-rew-api-client-integration)
2. [Phase 2: Spatial Averaging Support](#phase-2-spatial-averaging-support)
3. [Phase 3: Enhanced Decay Analysis](#phase-3-enhanced-decay-analysis)
4. [Phase 4: Subwoofer Integration & Alignment](#phase-4-subwoofer-integration--alignment)
5. [Phase 5: Target Curve Matching](#phase-5-target-curve-matching)
6. [Phase 6: Advanced ETC/Reflection Analysis](#phase-6-advanced-etcreflection-analysis)
7. [Implementation Timeline](#implementation-timeline)

---

## Phase 1: REW API Client Integration

### Objective

Connect to REW's REST API for live measurement access, eliminating the need for manual file exports.

### Documentation Reference

From [REW API Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/api.html):

> REW's API runs on **localhost (127.0.0.1)**, default port **4735**. Access is restricted to the local machine. Launch with `-api` flag or enable via preferences.

### API Specifications

| Property | Value | Source |
|----------|-------|--------|
| Base URL | `http://localhost:4735` | REW API docs |
| Swagger UI | `localhost:4735` | REW API docs |
| OpenAPI Spec | `localhost:4735/doc.json` | REW API docs |
| Data Encoding | Base64 32-bit floats, big-endian | REW API docs |

### Base64 Array Decoding

Per REW documentation:
```
Base64: PgAAAD6AAAA+wAAAPwAAAA==
Result: {0.125f, 0.25f, 0.375f, 0.5f}
```

### Implementation Tasks

#### 1.1 Create API Client Module

**File**: `src/api/rew-client.ts`

```typescript
/**
 * REW API Client
 *
 * Connects to REW's REST API at localhost:4735
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
 */

export interface REWApiConfig {
  host: string;      // Default: '127.0.0.1'
  port: number;      // Default: 4735
  timeout: number;   // Default: 10000ms
}

export interface REWApiClient {
  // Connection
  connect(): Promise<ConnectionStatus>;
  disconnect(): void;
  isConnected(): boolean;

  // Measurements (from /measurements endpoint)
  listMeasurements(): Promise<MeasurementInfo[]>;
  getMeasurement(uuid: string): Promise<MeasurementData>;

  // Frequency Response (from /measurements/:id/frequency-response)
  getFrequencyResponse(uuid: string, options?: {
    smoothing?: string;  // '1/3', '1/6', etc.
    ppo?: number;        // Points per octave
    unit?: string;       // 'dBFS', 'dB SPL'
  }): Promise<FrequencyResponseData>;

  // Impulse Response (from /measurements/:id/impulse-response)
  getImpulseResponse(uuid: string, options?: {
    windowed?: boolean;
  }): Promise<ImpulseResponseData>;

  // Waterfall Data (requires Pro for automation)
  getWaterfallData(uuid: string): Promise<WaterfallData>;

  // RT60 Data
  getRT60(uuid: string): Promise<RT60Data>;
}
```

#### 1.2 Implement Base64 Float Decoder

**File**: `src/api/base64-decoder.ts`

Per REW documentation, arrays are "Base64-encoded strings from raw bytes of 32-bit float values" with "big-endian" byte order.

```typescript
/**
 * Decode REW API Base64-encoded float array
 *
 * Reference: REW API docs state arrays use "big-endian" 32-bit floats
 */
export function decodeREWFloatArray(base64String: string): number[] {
  const buffer = Buffer.from(base64String, 'base64');
  const floats: number[] = [];

  for (let i = 0; i < buffer.length; i += 4) {
    // Big-endian 32-bit float
    floats.push(buffer.readFloatBE(i));
  }

  return floats;
}

// Validation test per REW docs
// Input: 'PgAAAD6AAAA+wAAAPwAAAA=='
// Expected: [0.125, 0.25, 0.375, 0.5]
```

#### 1.3 Add API Connection Tool

**File**: `docs/tools/api-connect.md`

```json
{
  "name": "rew.api_connect",
  "title": "Connect to REW API",
  "description": "Connect to a running REW instance's REST API. REW must be launched with -api flag or have API enabled in preferences.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "port": {
        "type": "integer",
        "default": 4735,
        "minimum": 1025,
        "maximum": 65535,
        "description": "REW API port (default 4735)"
      },
      "timeout_ms": {
        "type": "integer",
        "default": 10000,
        "minimum": 1000,
        "maximum": 60000,
        "description": "Connection timeout in milliseconds"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["connected", "error"] },
      "rew_version": { "type": "string" },
      "measurements_available": { "type": "integer" },
      "api_capabilities": {
        "type": "object",
        "properties": {
          "pro_features": { "type": "boolean" },
          "blocking_mode": { "type": "boolean" }
        }
      },
      "error_message": { "type": "string" }
    },
    "required": ["status"]
  }
}
```

#### 1.4 Add Live Measurement Fetch Tool

```json
{
  "name": "rew.api_get_measurement",
  "title": "Get Measurement from REW",
  "description": "Fetch a measurement directly from REW via API. Measurement is identified by UUID, not index (per REW docs: 'use UUIDs as indices shift when measurements are added/removed').",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_uuid": {
        "type": "string",
        "description": "UUID of the measurement in REW"
      },
      "include_ir": {
        "type": "boolean",
        "default": false,
        "description": "Include impulse response data"
      },
      "smoothing": {
        "type": "string",
        "enum": ["none", "1/48", "1/24", "1/12", "1/6", "1/3", "1/1"],
        "default": "none",
        "description": "Frequency response smoothing"
      }
    },
    "required": ["measurement_uuid"]
  }
}
```

### Response Codes (from REW docs)

| Code | Meaning | Handling |
|------|---------|----------|
| 200 | OK - Command completed | Process result |
| 202 | Accepted - Long-running task | Poll for completion or use blocking mode |
| 400 | Bad Request | Report error with message |

### Blocking Mode

Per REW docs: POST boolean to `/application/blocking` for synchronous responses. When enabled, "the API will not respond until the requested action is completed, but that may mean the response is delayed by several seconds."

---

## Phase 2: Spatial Averaging Support

### Objective

Support multi-position measurement averaging as used by professionals for room calibration.

### Documentation Reference

From [REW All SPL Graph Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/graph_allspl.html):

> **RMS Averaging**: "Phase is not taken into account, measurements are treated as incoherent."
>
> **Vector Averaging**: "averages the currently selected traces taking into account both magnitude and phase" and requires impulse response data.
>
> **Spatial Averaging**: "it is usually best to first use the Align SPL... feature to remove overall level differences due to different source distances."

From [REW Multi-Input Capture](https://www.roomeqwizard.com/help/help_en-GB/html/multichannelcapture.html):

> "inputs can be aligned to a common SPL in a chosen frequency range before being averaged, useful for spatial averaging."

### Averaging Methods

| Method | Phase | Use Case | Requirements |
|--------|-------|----------|--------------|
| RMS | Ignored | Spatial averaging (different positions) | Magnitude only |
| dB | Ignored | Target curve derivation | Smoothed data |
| Vector | Included | Same position, multiple takes | IR data required |
| RMS + Phase | Hybrid | Position averaging with phase | IR data required |

### Implementation Tasks

#### 2.1 Add Averaging Analysis Module

**File**: `src/analysis/averaging.ts`

```typescript
/**
 * Measurement Averaging
 *
 * Implements REW's averaging methods per official documentation.
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/graph_allspl.html
 */

export type AveragingMethod = 'rms' | 'db' | 'vector' | 'rms_phase' | 'db_phase';

export interface AveragingOptions {
  method: AveragingMethod;
  align_spl?: boolean;           // Align levels before averaging
  alignment_frequency_range?: [number, number];  // Hz range for alignment
  weighting?: number[];          // Per-measurement weights (0-1)
}

/**
 * RMS Average (per REW docs)
 *
 * "converts dB values to linear magnitudes, squares them, sums and
 * divides by the number of measurements, then takes the square root
 * and converts back to dB"
 */
export function rmsAverage(measurements: FrequencyResponseData[]): FrequencyResponseData {
  // Implementation per REW specification
}

/**
 * Vector Average (per REW docs)
 *
 * "averages the currently selected traces taking into account both
 * magnitude and phase"
 *
 * Note: "can exhibit magnitude dips due to phase cancellations"
 */
export function vectorAverage(measurements: MeasurementWithIR[]): FrequencyResponseData {
  // Requires IR data per docs
}

/**
 * Align SPL before averaging (per REW docs)
 *
 * "remove overall level differences due to different source distances"
 */
export function alignSPL(
  measurements: FrequencyResponseData[],
  frequencyRange: [number, number]
): FrequencyResponseData[] {
  // Calculate average level in range for each, then offset
}
```

#### 2.2 Add Averaging Tool

**File**: `docs/tools/average-measurements.md`

```json
{
  "name": "rew.average_measurements",
  "title": "Average Multiple Measurements",
  "description": "Create a spatial average from multiple measurement positions. Implements REW's averaging methods: RMS (incoherent, ignores phase), Vector (coherent, requires IR data), or hybrid methods.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_ids": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 2,
        "maxItems": 16,
        "description": "IDs of measurements to average (2-16 measurements)"
      },
      "method": {
        "type": "string",
        "enum": ["rms", "db", "vector", "rms_phase", "db_phase"],
        "default": "rms",
        "description": "Averaging method. RMS recommended for spatial averaging (different positions). Vector requires IR data and is best for same-position measurements."
      },
      "align_spl": {
        "type": "boolean",
        "default": true,
        "description": "Align SPL levels before averaging to compensate for distance differences (recommended for spatial averaging)"
      },
      "alignment_range_hz": {
        "type": "array",
        "items": { "type": "number" },
        "minItems": 2,
        "maxItems": 2,
        "default": [200, 2000],
        "description": "Frequency range for SPL alignment [min, max] Hz"
      },
      "weights": {
        "type": "array",
        "items": { "type": "number", "minimum": 0, "maximum": 1 },
        "description": "Optional per-measurement weights (0-1). If omitted, equal weighting is used."
      }
    },
    "required": ["measurement_ids"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "averaged_measurement_id": { "type": "string" },
      "method_used": { "type": "string" },
      "input_measurements": { "type": "integer" },
      "frequency_range_hz": {
        "type": "array",
        "items": { "type": "number" },
        "minItems": 2,
        "maxItems": 2
      },
      "spl_alignment_applied": { "type": "boolean" },
      "alignment_offsets_db": {
        "type": "array",
        "items": { "type": "number" }
      },
      "warnings": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["averaged_measurement_id", "method_used", "input_measurements"]
  }
}
```

#### 2.3 Add Multi-Position Workflow Prompt

```markdown
# Multi-Position Measurement Workflow

## Overview
Professional calibration typically uses 4-16 measurement positions around the listening area.

## Recommended Positions (per industry practice)

Position microphones in a grid pattern around the primary listening position:
- Main listening position (MLP)
- 15-30 cm left/right of MLP
- 15-30 cm forward/back of MLP
- Vary heights slightly (±5-10 cm)

## Step 1: Ingest All Position Measurements
For each measurement file:
- Call `rew.ingest_measurement` with position metadata

## Step 2: Align and Average
Call `rew.average_measurements` with:
- `measurement_ids`: [all position measurement IDs]
- `method`: "rms" (recommended for spatial averaging)
- `align_spl`: true

## Step 3: Analyze Averaged Response
Call `rew.analyze_room_modes` with the averaged measurement for overall room characterization.

## Note on Vector Averaging
Per REW docs, vector averaging "can exhibit magnitude dips due to phase cancellations." Use RMS for spatial averaging from different positions.
```

---

## Phase 3: Enhanced Decay Analysis

### Objective

Implement frequency-domain RT60 analysis with T20/T30/Topt calculations per REW methodology.

### Documentation Reference

From [REW RT60 Graph Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html):

> **T20**: Measures slope between -5 dB and -25 dB on the Schroeder curve
>
> **T30**: Measures slope between -5 dB and -35 dB on the Schroeder curve
>
> **Topt**: REW's adaptive measure that "uses a start point based on the intersection of the EDT and T30 regression lines"

From [REW RT60 Decay Graph](https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60decay.html):

> REW's RT60 Decay graph enables examination of reverberation at "much higher frequency resolutions and with much narrower octave fractions than is usually possible, even at low frequencies."
>
> **T60M (Topt)**: "Analyzes Short-Time Fourier Transform (STFT) slices" and "fits an exponential decay plus noise function to the data series"

### Target Values (from REW docs)

| Room Size | Target RT60 |
|-----------|-------------|
| Small rooms (<50 m³) | 0.3 seconds |
| Larger rooms (up to 200 m³) | 0.4–0.6 seconds |

### Implementation Tasks

#### 3.1 Enhance Decay Analysis Module

**File**: `src/analysis/decay.ts` (extend existing)

```typescript
/**
 * Enhanced Decay Analysis
 *
 * Implements REW's RT60 calculation methods.
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html
 */

export interface RT60Result {
  frequency_hz: number;
  t20_seconds: number | null;   // -5 to -25 dB slope
  t30_seconds: number | null;   // -5 to -35 dB slope
  topt_seconds: number | null;  // REW's adaptive method
  edt_seconds: number | null;   // Early Decay Time
  confidence: 'high' | 'medium' | 'low';
  noise_floor_db: number;
}

/**
 * Calculate T20 (per REW docs)
 *
 * "Measures slope between -5 dB and -25 dB on the Schroeder curve"
 */
export function calculateT20(schroederCurve: SchroederCurve): number | null {
  // Find -5 dB and -25 dB crossing points
  // Calculate slope between them
  // Extrapolate to 60 dB decay
}

/**
 * Calculate T30 (per REW docs)
 *
 * "Measures slope between -5 dB and -35 dB on the Schroeder curve"
 */
export function calculateT30(schroederCurve: SchroederCurve): number | null {
  // Similar to T20 but with -35 dB endpoint
}

/**
 * Calculate Topt (per REW docs)
 *
 * REW's frequency domain method using STFT slices
 * "fits an exponential decay plus noise function to the data series"
 */
export function calculateTopt(stftSlices: STFTSlice[]): number | null {
  // Exponential + noise model fitting
}

/**
 * Build Schroeder Curve (per REW docs)
 *
 * "a plot of the energy (squared values) of the impulse response
 * that is backwards integrated"
 */
export function buildSchroederCurve(ir: ImpulseResponseData): SchroederCurve {
  // Square IR values
  // Backwards integrate
  // Convert to dB
}
```

#### 3.2 Update Decay Tool Output Schema

**File**: `docs/tools/analyze-decay.md` (update)

```json
{
  "name": "rew.analyze_decay",
  "title": "Analyze Decay Times",
  "description": "Analyze reverberation times using REW's RT60 calculation methods: T20 (-5 to -25 dB), T30 (-5 to -35 dB), and Topt (frequency domain STFT method).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": { "type": "string" },
      "frequency_range_hz": {
        "type": "array",
        "items": { "type": "number" },
        "default": [20, 500],
        "description": "Frequency range for decay analysis"
      },
      "resolution": {
        "type": "string",
        "enum": ["octave", "third_octave", "sixth_octave"],
        "default": "third_octave",
        "description": "Frequency band resolution"
      },
      "methods": {
        "type": "array",
        "items": { "type": "string", "enum": ["t20", "t30", "topt", "edt"] },
        "default": ["t30", "topt"],
        "description": "RT60 calculation methods to use"
      }
    },
    "required": ["measurement_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": { "type": "string" },
      "analysis_type": { "type": "string", "const": "decay_analysis" },
      "rt60_by_frequency": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "center_frequency_hz": { "type": "number" },
            "bandwidth": { "type": "string" },
            "t20_seconds": { "type": "number" },
            "t30_seconds": { "type": "number" },
            "topt_seconds": { "type": "number" },
            "edt_seconds": { "type": "number" },
            "assessment": {
              "type": "string",
              "enum": ["excellent", "good", "acceptable", "problematic", "severe"]
            },
            "target_seconds": { "type": "number" },
            "deviation_seconds": { "type": "number" }
          }
        }
      },
      "problematic_bands": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "frequency_hz": { "type": "number" },
            "rt60_seconds": { "type": "number" },
            "target_seconds": { "type": "number" },
            "excess_seconds": { "type": "number" },
            "likely_cause": { "type": "string" },
            "glm_addressable": { "type": "boolean" }
          }
        }
      },
      "overall_assessment": {
        "type": "object",
        "properties": {
          "average_rt60_below_200hz": { "type": "number" },
          "average_rt60_200_1000hz": { "type": "number" },
          "quality": { "type": "string", "enum": ["good", "acceptable", "needs_treatment"] },
          "primary_issues": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

---

## Phase 4: Subwoofer Integration & Alignment

### Objective

Support subwoofer/mains alignment analysis including phase, delay, and polarity optimization.

### Documentation Reference

From [REW Waterfall Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/graph_waterfall.html):

> The Alignment Tool allows users to "align two measurements" for phase and timing analysis.

From [REW EQ Window Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/eqwindow.html):

> Crossover configuration and subwoofer integration are part of the speaker type selection, with options for "Bass Limited (with bass management)" configurations.

### Professional Workflow (from miniDSP and industry practice)

1. Measure mains solo
2. Measure sub solo
3. Find spectral crossover frequency
4. Optimize delay/polarity for smoothest summation
5. Verify with combined measurement

### Implementation Tasks

#### 4.1 Add Subwoofer Integration Analysis

**File**: `src/analysis/sub-integration.ts`

```typescript
/**
 * Subwoofer Integration Analysis
 *
 * Analyzes phase alignment and timing between subwoofer and main speakers
 * at the crossover region.
 */

export interface SubIntegrationAnalysis {
  crossover_region: {
    recommended_crossover_hz: number;
    current_overlap_hz: [number, number];
    phase_difference_at_crossover_degrees: number;
  };

  timing_analysis: {
    sub_delay_relative_to_mains_ms: number;
    recommended_delay_adjustment_ms: number;
    alignment_method: 'ir_peak' | 'group_delay' | 'phase_match';
  };

  polarity_analysis: {
    current_polarity_match: boolean;
    recommended_polarity_invert: boolean;
    summation_improvement_db: number;
  };

  summation_prediction: {
    predicted_response: FrequencyResponseData;
    dip_at_crossover_db: number;
    smoothness_improvement_db: number;
  };
}

/**
 * Calculate optimal delay for sub/mains alignment
 *
 * Uses IR peak alignment as primary method, with group delay
 * verification at crossover frequency.
 */
export function calculateOptimalDelay(
  mainsIR: ImpulseResponseData,
  subIR: ImpulseResponseData,
  crossoverHz: number
): DelayRecommendation {
  // Find IR peaks
  // Calculate group delay at crossover
  // Recommend delay adjustment
}

/**
 * Predict combined response with given delay and polarity
 */
export function predictCombinedResponse(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  delayMs: number,
  invertPolarity: boolean
): FrequencyResponseData {
  // Apply delay as phase shift
  // Optionally invert polarity (180° phase)
  // Sum responses considering phase
}
```

#### 4.2 Add Sub Integration Tool

**File**: `docs/tools/analyze-sub-integration.md`

```json
{
  "name": "rew.analyze_sub_integration",
  "title": "Analyze Subwoofer Integration",
  "description": "Analyze subwoofer integration with main speakers. Evaluates phase alignment, timing, and polarity at the crossover region. Provides delay and polarity recommendations for optimal summation.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "mains_measurement_id": {
        "type": "string",
        "description": "Measurement ID for main speakers only (no sub)"
      },
      "sub_measurement_id": {
        "type": "string",
        "description": "Measurement ID for subwoofer only (no mains)"
      },
      "combined_measurement_id": {
        "type": "string",
        "description": "Optional: Measurement ID for mains + sub combined"
      },
      "crossover_hz": {
        "type": "number",
        "minimum": 40,
        "maximum": 200,
        "description": "Crossover frequency in Hz. If omitted, will estimate from measurements."
      },
      "current_sub_delay_ms": {
        "type": "number",
        "default": 0,
        "description": "Current delay applied to subwoofer (for reference)"
      },
      "current_sub_polarity": {
        "type": "string",
        "enum": ["normal", "inverted"],
        "default": "normal"
      }
    },
    "required": ["mains_measurement_id", "sub_measurement_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "analysis_type": { "type": "string", "const": "sub_integration" },
      "crossover_analysis": {
        "type": "object",
        "properties": {
          "detected_crossover_hz": { "type": "number" },
          "phase_at_crossover_mains_deg": { "type": "number" },
          "phase_at_crossover_sub_deg": { "type": "number" },
          "phase_difference_deg": { "type": "number" },
          "phase_alignment_quality": {
            "type": "string",
            "enum": ["excellent", "good", "fair", "poor"]
          }
        }
      },
      "timing_recommendations": {
        "type": "object",
        "properties": {
          "current_delay_ms": { "type": "number" },
          "optimal_delay_ms": { "type": "number" },
          "adjustment_needed_ms": { "type": "number" },
          "alignment_method_used": { "type": "string" }
        }
      },
      "polarity_recommendation": {
        "type": "object",
        "properties": {
          "current_polarity": { "type": "string" },
          "recommended_polarity": { "type": "string" },
          "invert_recommended": { "type": "boolean" },
          "expected_improvement_db": { "type": "number" }
        }
      },
      "summation_prediction": {
        "type": "object",
        "properties": {
          "current_dip_at_crossover_db": { "type": "number" },
          "predicted_dip_after_optimization_db": { "type": "number" },
          "improvement_db": { "type": "number" }
        }
      },
      "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
      "warnings": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

---

## Phase 5: Target Curve Matching

### Objective

Support comparison of measurements against target response curves.

### Documentation Reference

From [REW EQ Window Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/eqwindow.html):

> **Target configuration** includes:
> - **Speaker Type Selection**: Full Range (flat response), Bass Limited (with bass management), Subwoofer
> - **House Curve**: Custom offset curves loaded from text files with frequency/dB pairs
> - **Room Curve**: Features HF Fall (absorption effects) and LF Rise (low-frequency boost)
> - **Target Level**: Manual or automatic adjustment

### Standard Target Curves

| Curve Type | Description |
|------------|-------------|
| Flat | 0 dB across frequency range |
| House Curve | User-defined frequency/dB pairs |
| Room Curve | HF fall + LF rise (per REW) |
| Harman | ~3 dB bass shelf, -1 dB/octave above 1kHz |

### Implementation Tasks

#### 5.1 Add Target Curve Module

**File**: `src/analysis/target-curves.ts`

```typescript
/**
 * Target Curve Analysis
 *
 * Compare measurements against target response curves.
 * Supports REW-compatible house curve format.
 */

export interface TargetCurve {
  name: string;
  points: Array<{ frequency_hz: number; level_db: number }>;
  interpolation: 'linear' | 'log';
}

// Built-in curves
export const FLAT_CURVE: TargetCurve = {
  name: 'Flat',
  points: [{ frequency_hz: 20, level_db: 0 }, { frequency_hz: 20000, level_db: 0 }],
  interpolation: 'linear'
};

export const REW_ROOM_CURVE: TargetCurve = {
  name: 'REW Room Curve',
  points: [
    { frequency_hz: 20, level_db: 6 },    // LF rise
    { frequency_hz: 100, level_db: 0 },   // Transition
    { frequency_hz: 1000, level_db: 0 },  // Flat mid
    { frequency_hz: 10000, level_db: -3 }, // HF fall
    { frequency_hz: 20000, level_db: -6 }
  ],
  interpolation: 'log'
};

/**
 * Parse REW house curve file format
 *
 * Per REW docs: "Custom offset curves loaded from text files
 * with frequency/dB pairs"
 */
export function parseHouseCurve(content: string): TargetCurve {
  // Parse frequency/dB pairs from text file
}

/**
 * Calculate deviation from target
 */
export function calculateTargetDeviation(
  measurement: FrequencyResponseData,
  target: TargetCurve,
  alignmentFrequencyHz: number = 1000
): TargetDeviationResult {
  // Align measurement to target at reference frequency
  // Calculate deviation at each point
  // Return statistics
}
```

#### 5.2 Add Target Comparison Tool

```json
{
  "name": "rew.compare_to_target",
  "title": "Compare to Target Curve",
  "description": "Compare a measurement against a target response curve. Supports flat, house curves, and REW room curve with LF rise and HF fall.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": { "type": "string" },
      "target_type": {
        "type": "string",
        "enum": ["flat", "rew_room_curve", "harman", "custom"],
        "default": "flat"
      },
      "custom_curve_points": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "frequency_hz": { "type": "number" },
            "level_db": { "type": "number" }
          }
        },
        "description": "Custom target curve points (frequency/dB pairs). Required if target_type is 'custom'."
      },
      "alignment_frequency_hz": {
        "type": "number",
        "default": 1000,
        "description": "Frequency at which to align measurement to target"
      },
      "evaluation_range_hz": {
        "type": "array",
        "items": { "type": "number" },
        "default": [20, 20000],
        "description": "Frequency range for evaluation [min, max]"
      }
    },
    "required": ["measurement_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "target_used": { "type": "string" },
      "alignment_offset_db": { "type": "number" },
      "deviation_statistics": {
        "type": "object",
        "properties": {
          "average_deviation_db": { "type": "number" },
          "max_positive_deviation_db": { "type": "number" },
          "max_negative_deviation_db": { "type": "number" },
          "rms_deviation_db": { "type": "number" }
        }
      },
      "by_band": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "band_name": { "type": "string" },
            "range_hz": { "type": "array" },
            "average_deviation_db": { "type": "number" },
            "assessment": { "type": "string" }
          }
        }
      },
      "worst_deviations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "frequency_hz": { "type": "number" },
            "deviation_db": { "type": "number" },
            "type": { "type": "string", "enum": ["peak", "null"] }
          }
        }
      },
      "overall_grade": {
        "type": "string",
        "enum": ["excellent", "good", "acceptable", "needs_work", "poor"]
      }
    }
  }
}
```

---

## Phase 6: Advanced ETC/Reflection Analysis

### Objective

Enhance impulse response analysis with detailed ETC interpretation and reflection characterization.

### Documentation Reference

From [REW Impulse Graph Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/graph_impulse.html):

> The ETC is "the envelope of the impulse, also called the energy-time curve or ETC," which helps identify reflections and visualize overall impulse shape.
>
> Reflections appear as spikes after the initial peak, with timing indicating "additional distance sound traveled before returning to the measurement point."

### Acoustic Metrics (Industry Standard)

| Metric | Definition | Target |
|--------|------------|--------|
| C50 | Energy ratio 0-50ms vs 50ms+ | Speech clarity |
| C80 | Energy ratio 0-80ms vs 80ms+ | Music clarity |
| ITD Gap | Initial Time Delay | >10-15ms ideal |
| D50 | Definition (C50 as ratio) | >0.5 |

### Implementation Tasks

#### 6.1 Enhance ETC Analysis

**File**: `src/analysis/reflections.ts` (extend existing)

```typescript
/**
 * Enhanced ETC Analysis
 *
 * Reference: https://www.roomeqwizard.com/help/help_en-GB/html/graph_impulse.html
 */

export interface ReflectionAnalysis {
  direct_sound: {
    arrival_time_ms: number;
    level_db: number;
  };

  reflections: Array<{
    delay_ms: number;              // Time after direct sound
    level_relative_db: number;     // Level relative to direct sound
    estimated_distance_m: number;  // Round-trip distance
    likely_surface: string;        // Estimated surface
    severity: 'significant' | 'moderate' | 'minor';
    comb_filter_affected_hz: number[];  // Affected frequencies
  }>;

  clarity_metrics: {
    c50_db: number;     // Speech clarity
    c80_db: number;     // Music clarity
    d50: number;        // Definition ratio
    itd_gap_ms: number; // Initial Time Delay
  };

  comb_filtering_analysis: {
    primary_comb_frequency_hz: number;
    affected_harmonics_hz: number[];
    severity: 'severe' | 'moderate' | 'mild' | 'negligible';
  };
}

/**
 * Calculate C50 (speech clarity)
 *
 * C50 = 10 * log10(E_0_50ms / E_50ms_inf)
 */
export function calculateC50(ir: ImpulseResponseData): number {
  // Sum energy in 0-50ms
  // Sum energy in 50ms+
  // Calculate ratio in dB
}

/**
 * Calculate C80 (music clarity)
 */
export function calculateC80(ir: ImpulseResponseData): number {
  // Same as C50 but with 80ms boundary
}

/**
 * Estimate reflecting surface from delay
 *
 * Per REW docs: timing "indicates additional distance sound traveled"
 */
export function estimateSurface(
  delayMs: number,
  roomDimensions?: RoomDimensions
): SurfaceEstimate {
  const distanceM = delayMs * 0.343 / 2;  // Half of round-trip

  // Use room dimensions for more accurate estimation
  // Fall back to generic estimates if not provided
}

/**
 * Calculate comb filter frequencies
 *
 * f_null = (2n-1) * c / (2 * path_difference)
 * f_peak = n * c / path_difference
 */
export function calculateCombFrequencies(
  pathDifferenceM: number,
  maxFrequencyHz: number = 5000
): { nulls_hz: number[]; peaks_hz: number[] } {
  // Calculate harmonic series of nulls and peaks
}
```

#### 6.2 Update Impulse Analysis Tool

**File**: `docs/tools/analyze-impulse.md` (update)

Add new output fields:

```json
{
  "outputSchema": {
    "type": "object",
    "properties": {
      // ... existing fields ...

      "clarity_metrics": {
        "type": "object",
        "properties": {
          "c50_db": {
            "type": "number",
            "description": "Speech clarity ratio (0-50ms vs 50ms+ energy)"
          },
          "c80_db": {
            "type": "number",
            "description": "Music clarity ratio (0-80ms vs 80ms+ energy)"
          },
          "d50": {
            "type": "number",
            "description": "Definition (C50 as linear ratio, 0-1)"
          },
          "itd_gap_ms": {
            "type": "number",
            "description": "Initial Time Delay gap in milliseconds"
          },
          "clarity_assessment": {
            "type": "string",
            "enum": ["excellent", "good", "acceptable", "problematic"]
          }
        }
      },

      "comb_filtering": {
        "type": "object",
        "properties": {
          "risk_level": {
            "type": "string",
            "enum": ["severe", "moderate", "mild", "negligible"]
          },
          "primary_reflection_delay_ms": { "type": "number" },
          "affected_frequencies_hz": {
            "type": "array",
            "items": { "type": "number" }
          },
          "glm_addressable": { "type": "boolean" }
        }
      }
    }
  }
}
```

---

## Implementation Timeline

### Priority Order

| Phase | Priority | Complexity | Dependencies |
|-------|----------|------------|--------------|
| Phase 1: REW API | High | Medium | None |
| Phase 2: Spatial Averaging | High | Low | Phase 1 (optional) |
| Phase 3: Enhanced Decay | Medium | Medium | None |
| Phase 4: Sub Integration | High | Medium | None |
| Phase 5: Target Curves | Medium | Low | None |
| Phase 6: ETC Enhancement | Medium | Low | None |

### Recommended Order

1. **Phase 2** (Spatial Averaging) - Low complexity, high value, no dependencies
2. **Phase 4** (Sub Integration) - High value for professional workflows
3. **Phase 1** (REW API) - Enables live workflows
4. **Phase 3** (Enhanced Decay) - Builds on existing decay module
5. **Phase 6** (ETC Enhancement) - Builds on existing reflection module
6. **Phase 5** (Target Curves) - Adds comparison capabilities

### Testing Requirements

Each phase requires:

1. **Unit tests** for new analysis functions
2. **Integration tests** with sample REW data
3. **Documentation updates** for tool specifications
4. **Example workflows** in `docs/examples.md`

### MCP Compliance Checklist

Per [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools):

- [ ] All tools have `title` field for display
- [ ] All tools have complete `inputSchema` with descriptions
- [ ] All tools have `outputSchema` for validation
- [ ] Servers validate all tool inputs
- [ ] Output includes `isError` flag for error conditions
- [ ] Structured content in `structuredContent` field with text fallback

---

## External Documentation References

All features in this plan are grounded in official documentation:

### REW Documentation
- **API Reference**: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
- **Waterfall Graphs**: https://www.roomeqwizard.com/help/help_en-GB/html/graph_waterfall.html
- **RT60 Measurements**: https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html
- **RT60 Decay Graph**: https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60decay.html
- **Impulse Response**: https://www.roomeqwizard.com/help/help_en-GB/html/graph_impulse.html
- **All SPL/Averaging**: https://www.roomeqwizard.com/help/help_en-GB/html/graph_allspl.html
- **Multi-Input Capture**: https://www.roomeqwizard.com/help/help_en-GB/html/multichannelcapture.html
- **EQ Window**: https://www.roomeqwizard.com/help/help_en-GB/html/eqwindow.html
- **Room Simulator**: https://www.roomeqwizard.com/help/help_en-GB/html/modalsim.html

### MCP Documentation
- **Tools Specification**: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- **Output Schema**: https://modelcontextprotocol.io/specification/2025-06-18/server/tools#output-schema

### Acoustic References
- Allen, J. B., & Berkley, D. A. (1978). Image method for efficiently simulating small-room acoustics. JASA.
- ISO 3382: Measurement of room acoustic parameters
