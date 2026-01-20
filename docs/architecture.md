# Architecture

## System Overview

```
REW (manual measurements)
       ↓ (export)
Measurement Files (.txt / .mdat / .csv)
       ↓
┌─────────────────────────────────────┐
│           MCP Server                │
│  ┌─────────────────────────────┐    │
│  │     File Parser Layer       │    │
│  │  - Text parser              │    │
│  │  - CSV parser               │    │
│  │  - MDAT parser (optional)   │    │
│  └─────────────────────────────┘    │
│              ↓                      │
│  ┌─────────────────────────────┐    │
│  │   Measurement Store         │    │
│  │  - In-memory storage        │    │
│  │  - Indexed by ID + metadata │    │
│  └─────────────────────────────┘    │
│              ↓                      │
│  ┌─────────────────────────────┐    │
│  │   Analysis Engine           │    │
│  │  - Deterministic rules      │    │
│  │  - No ML/AI inference       │    │
│  └─────────────────────────────┘    │
│              ↓                      │
│  ┌─────────────────────────────┐    │
│  │   MCP Tool Interface        │    │
│  │  - JSON Schema tools        │    │
│  │  - Structured responses     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
       ↓
LLM (Claude / Copilot)
       ↓
Human decision
```

## Component Responsibilities

### 1. File Parser Layer

**Purpose**: Convert raw REW exports into normalized internal representation.

**Input**: File contents (string or binary)

**Output**: Normalized measurement object

**Responsibilities**:
- Detect file format (text, CSV, MDAT)
- Extract frequency/SPL pairs
- Extract time-domain data if present
- Validate data integrity
- Report parsing errors clearly

**Does NOT**:
- Interpret the data
- Apply any corrections
- Guess missing values

### 2. Measurement Store

**Purpose**: Hold parsed measurements in memory with associated metadata.

**Data Model**:
```typescript
interface StoredMeasurement {
  id: string;                    // Unique identifier
  speaker_id: SpeakerID;         // L | R | Sub | Combined | Center | etc.
  condition: string;             // e.g., "pre_glm", "post_glm", "placement_A"
  mic_position_id: string;       // Identifies listening position
  notes: string;                 // Free-form user notes
  timestamp: ISO8601String;      // When ingested
  
  frequency_response: {
    frequencies_hz: number[];    // Array of frequency values
    spl_db: number[];            // Corresponding SPL values
    phase_degrees?: number[];    // Optional phase data
  };
  
  impulse_response?: {
    samples: number[];           // IR samples
    sample_rate_hz: number;      // Sample rate
  };
  
  etc_data?: {
    time_ms: number[];           // Time values
    level_db: number[];          // Level values
  };
  
  waterfall_data?: {
    frequencies_hz: number[];
    time_slices_ms: number[];
    levels_db: number[][];       // 2D array [time][frequency]
  };
}

type SpeakerID = 'L' | 'R' | 'C' | 'Sub' | 'Combined' | string;
```

### 3. Analysis Engine

**Purpose**: Apply deterministic rules to measurement data.

**Core Principle**: All analysis must be reproducible and explainable.

**Input**: One or more `StoredMeasurement` objects

**Output**: Structured analysis results with confidence scores

**Responsibilities**:
- Peak and null detection
- Room mode classification
- Decay time calculation
- Reflection identification
- Comparative analysis

**Does NOT**:
- Use machine learning
- Hallucinate causes
- Make definitive claims without evidence
- Recommend specific EQ settings

### 4. MCP Tool Interface

**Purpose**: Expose analysis capabilities as MCP tools.

**Responsibilities**:
- Define JSON Schema for each tool (input and output schemas)
- Validate inputs against schemas
- Route to appropriate analysis functions
- Format structured responses per MCP specification
- Include confidence and uncertainty markers
- Return `isError` flag for error responses

**MCP Compliance**:
- Protocol Version: 2025-06-18
- See [MCP Server Configuration](mcp-server-config.md) for full server specification
- See [Resources](resources.md) for data access without computation
- See [Prompts](prompts.md) for workflow templates

## Data Flow Examples

### Example 1: Single Measurement Analysis

```
1. LLM calls: rew.ingest_measurement(file_contents, metadata)
2. Parser identifies format → parses to normalized form
3. Store saves measurement with generated ID
4. Returns: { measurement_id: "abc123", summary: {...} }

5. LLM calls: rew.analyze_room_modes(measurement_id: "abc123")
6. Engine retrieves measurement from store
7. Engine applies peak/null detection rules
8. Returns: { modes: [...], confidence: "high", issues: [...] }
```

### Example 2: Comparison Workflow

```
1. LLM ingests measurement A (pre_glm)
2. LLM ingests measurement B (post_glm)
3. LLM calls: rew.compare_measurements(["A", "B"])
4. Engine computes deltas across frequency bands
5. Returns structured comparison with improvements/regressions
6. LLM calls: rew.interpret_with_glm_context(comparison_result)
7. Engine applies GLM behavior rules
8. Returns interpretation of what GLM addressed vs residual issues
```

## Error Handling

All components must handle errors gracefully:

| Error Type | Response |
|------------|----------|
| Invalid file format | `{ error: "parse_error", message: "..." }` |
| Missing required data | `{ error: "incomplete_data", missing: [...] }` |
| Insufficient data quality | `{ analysis_confidence: "low", reason: "..." }` |
| Internal error | `{ error: "internal_error", message: "..." }` |

## Thread Safety

The MCP server should be stateless between requests where possible. The measurement store may be:
- In-memory (session-scoped)
- Persistent (file-based, for multi-session workflows)

If persistent storage is used, ensure thread-safe read/write operations.

## MCP Response Format

All tool responses must follow the MCP specification format:

### Success Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\": \"success\", \"measurement_id\": \"meas_001\", ...}"
    }
  ],
  "isError": false
}
```

### Error Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\": \"error\", \"error_type\": \"parse_error\", \"message\": \"...\", \"suggestion\": \"...\"}"
    }
  ],
  "isError": true
}
```

### Response Content Rules

1. **Always JSON**: Tool output is always serialized JSON in the `text` field
2. **isError flag**: Set `true` for any error condition, `false` for success
3. **Structured errors**: Include `error_type`, `message`, and `suggestion` fields
4. **Confidence markers**: All analysis results include `analysis_confidence`
5. **Explicit units**: All numeric values have units in key names (e.g., `frequency_hz`, `level_db`)

## Performance Considerations

- Frequency response parsing: Should complete in <100ms for typical files
- Analysis operations: Should complete in <500ms for single measurements
- Comparison operations: Should complete in <1s for pairwise comparisons

Large waterfall datasets may require streaming or chunked processing.
