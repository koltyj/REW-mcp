# REW MCP Server Plan

## 1) Overview
Room EQ Wizard (REW) exposes a local-only HTTP API on `127.0.0.1:4735` (default) when enabled in Preferences > API or when launched with `-api` (and optional `-port`). This MCP server acts as a thin, deterministic orchestrator: it never plays audio itself, and instead drives REW to perform sweeps, export measurements, and then runs pure, deterministic analysis on the exported data. The REW API is the single control surface for measurement orchestration, configuration, and export.

The server is designed for speaker placement workflows and for validating pre/post Genelec GLM measurements. It provides deterministic, explainable analysis with explicit confidence scoring and never claims success without evidence: a 2xx response from REW and a parseable export artifact. Each operation has at most one retry, and the server relies on documented REW endpoints and subscription progress updates (no endpoint probing).

The MCP server surfaces tools for health checks, sweep configuration, measurement naming, running/canceling sweeps, listing and exporting measurements, deterministic analysis, and comparing pre/post results. It stores data locally under a structured workspace (runs/{sessionId}/{measurementId}/...), with an index mapping REW measurement IDs (numeric index or UUID) to session metadata. It enforces localhost-only REW control by default, rejecting non-local addresses unless explicitly configured. All interactions are limited to documented REW endpoints (no discovery or probing beyond the documented commands/choices endpoints).

Implementation choice: TypeScript with the official MCP SDK (`@modelcontextprotocol/sdk`) and `undici` (or Node’s built-in `fetch`) for HTTP requests. The REW client is a thin wrapper over `fetch`, with request/response logging, strict 2xx checking, and a single retry rule baked into each operation.

## 2) Phase plan (v0/v1/v1.5) with acceptance criteria

### v0 — API orchestration + export pipeline
**Scope**
- MCP server can reach REW API (`/` or `/api` health check as documented, plus `/measure/commands` round-trip).
- Configure sweep parameters, level, timing, playback mode, measurement mode, and protection options via API.
- Run a sweep, track progress via subscriptions, export measurement data, and verify file parseability.
- Store artifacts and metadata in local workspace.

**Acceptance criteria**
- [ ] `rew.api_healthcheck` reports status only after a 2xx response from REW.
- [ ] `rew.configure_sweep` sets sweep configuration, level, timing, playback mode, measurement mode, start delay, and protection options; verify with GET calls.
- [ ] `rew.run_sweep` returns success only after REW confirms completion via subscription + a measurement appears in `/measurements`.
- [ ] `rew.export_measurement` saves a file to `runs/{sessionId}/{measurementId}/raw_exports` and verifies it is parseable.
- [ ] For any step: one retry max; otherwise FAIL with actionable error.

### v1 — Deterministic analysis + comparison
**Scope**
- Deterministic analysis of exported FR/IR (no ML).
- Pre/post and L/R comparison tools.
- Confidence scoring and sanity checks.

**Acceptance criteria**
- [ ] `rew.analyze_measurement` returns band summaries, peaks/nulls, symmetry metrics, and sanity checks.
- [ ] `rew.compare_measurements` returns structured deltas and top divergences.
- [ ] Confidence (high/medium/low) and reasons are always provided.

### v1.5 — Session sequencing + optional generator checks
**Scope**
- `rew.session_run_sequence` for scripted L/R sweeps with metadata.
- Optional use of generator endpoints for pink noise/tones (non-sweep checks).

**Acceptance criteria**
- [ ] Run scripted L, R, Both, repeat sweeps with deterministic naming and metadata.
- [ ] Optional generator control uses documented endpoints only and is fully cancellable.

## 3) Repo layout (tree)

```
rew-mcp/
  README.md
  src/
    server.ts               # MCP server entry (TypeScript)
    config/
      defaults.ts           # Default REW host/port and timeouts
    rew/
      client.ts             # HTTP client wrapper for REW API
      endpoints.ts          # Typed endpoint definitions + payload shapes
      subscriptions.ts      # Subscription handling for /measure progress
    tools/
      apiHealthcheck.ts
      configureSweep.ts
      setMeasurementNaming.ts
      runSweep.ts
      cancelMeasurement.ts
      listMeasurements.ts
      exportMeasurement.ts
      analyzeMeasurement.ts
      compareMeasurements.ts
      sessionRunSequence.ts
    analysis/
      parseExport.ts         # Parse FR/IR exports
      metrics.ts             # Peak/null detection, bands, symmetry
      compare.ts             # Pre/post comparison
      confidence.ts          # Confidence scoring rules
    storage/
      workspace.ts           # Filesystem paths + index
      index.ts               # Measurement ID ↔ metadata mapping
    state/
      sessionMachine.ts      # State machine implementation
      types.ts
  tests/
    unit/
      analysis/*.test.ts
    integration/
      rew-api/*.test.ts
    fixtures/
      exports/
        example-fr.csv
        example-ir.csv
```

## 4) REW API mapping table

| MCP tool | REW endpoint(s) | Method | Payload (shape) | Expected response | Failure modes |
|---|---|---|---|---|---|
| `rew.api_healthcheck` | `/measure/commands` | GET | none | 2xx + list of commands | 4xx/5xx, connection refused, non-local host rejected |
| `rew.configure_sweep` | `/measure/sweep/configuration` | GET/POST/PUT | `{ startFreq, endFreq, length, dither }` | 2xx + updated config | 4xx invalid params, 5xx |
|  | `/measure/level` | GET/POST/PUT | `{ level, unit }` (unit validated against `/measure/level/units`) | 2xx + updated level | unit unsupported, 4xx |
|  | `/measure/level/units` | GET | none | 2xx + list | 4xx/5xx |
|  | `/measure/playback-mode` | GET/POST/PUT | `{ mode }` (validated against `/measure/playback-mode/choices`) | 2xx | invalid mode |
|  | `/measure/playback-mode/choices` | GET | none | 2xx + list | 4xx/5xx |
|  | `/measure/file-playback-stimulus` | POST | `{ path }` | 2xx | file missing, 4xx |
|  | `/measure/measurement-mode` | GET/POST/PUT | `{ mode }` (validated against `/measure/measurement-mode/choices`) | 2xx | invalid mode |
|  | `/measure/measurement-mode/choices` | GET | none | 2xx + list | 4xx/5xx |
|  | `/measure/sequential-channels` | GET/POST/PUT | `{ channels }` (validated against `/measure/sequential-choices`) | 2xx | invalid channel list |
|  | `/measure/sequential-choices` | GET | none | 2xx + list | 4xx/5xx |
|  | `/measure/timing` | GET/POST/PUT | `{ reference, mode }` | 2xx | invalid reference |
|  | `/measure/timing-offset` | GET/POST/PUT | `{ offsetMs }` | 2xx | 4xx |
|  | `/measure/start-delay` | GET/POST/PUT | `{ seconds }` | 2xx | 4xx |
|  | `/measure/protection-options` | GET/POST/PUT | `{ abortOnClipping, abortOnSPL, clipThreshold, splThreshold }` | 2xx | 4xx |
| `rew.set_measurement_naming` | `/measure/naming` | POST/PUT | `{ namePattern }` | 2xx | 4xx |
|  | `/measure/notes` | POST/PUT | `{ notes }` | 2xx | 4xx |
| `rew.run_sweep` | `/measure/commands` | GET | none | 2xx + commands list | 4xx/5xx |
|  | `/measure/command` | POST | `{ command: "start" }` (or documented equivalent) | 2xx + ack | 4xx, 409 busy |
|  | `/measure` subscription | SUBSCRIBE | `{ path: "/measure" }` | progress strings | missing progress, timeout |
| `rew.cancel_measurement` | `/measure/command` | POST | `{ command: "cancel" }` | 2xx | 4xx |
| `rew.list_measurements` | `/measurements` | GET | none | 2xx + list of measurements (id/index/uuid) | 4xx/5xx |
| `rew.export_measurement` | `/measurements/:id` | GET | none | 2xx + metadata | 404 if missing |
|  | `/measurements/commands` | GET | none | 2xx + commands list | 4xx |
|  | `/measurements/command` | POST | `{ command: "Export", options: { format, targetPath, dataType } }` | 2xx + export status | 4xx invalid, 5xx |
|  | `/measurements/command` | POST | `{ command: "Save all", options: { directoryPath, note } }` | 2xx + save status | 4xx invalid, 5xx |
| `rew.analyze_measurement` | (filesystem exports) | local | parse FR/IR exports | metrics JSON | parse error, empty data |
| `rew.compare_measurements` | (filesystem exports) | local | read analysis JSON | delta report | missing analysis |
| `rew.session_run_sequence` | `/measure/command` + `/measure/notes` + `/measure/naming` | POST | L/R/Both steps | 2xx + progress | busy, timeout |
| Optional generator | `/generator/status`, `/generator/signal`, `/generator/signals`, `/generator/level`, `/generator/frequency`, `/generator/commands` | GET/POST | as documented | 2xx + state | 4xx/5xx |

## 5) MCP tool schema definitions (JSON Schema style)

### Common types
```json
{
  "$defs": {
    "status": {"enum": ["success", "failed", "pending"]},
    "confidence": {"enum": ["high", "medium", "low"]},
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code": {"type": "string"},
        "message": {"type": "string"},
        "details": {"type": "object"}
      }
    }
  }
}
```

### `rew.api_healthcheck`
**Input**
```json
{
  "type": "object",
  "properties": {
    "host": {"type": "string", "default": "127.0.0.1"},
    "port": {"type": "integer", "default": 4735},
    "timeoutMs": {"type": "integer", "default": 2000}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence", "rewVersion"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "rewVersion": {"type": "string"},
    "commands": {"type": "array", "items": {"type": "string"}},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.configure_sweep`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId", "sweep", "level", "timing", "playback", "measurement", "startDelay", "protection"],
  "properties": {
    "sessionId": {"type": "string"},
    "sweep": {
      "type": "object",
      "required": ["startFreq", "endFreq", "lengthSec", "dither"],
      "properties": {
        "startFreq": {"type": "number"},
        "endFreq": {"type": "number"},
        "lengthSec": {"type": "number"},
        "dither": {"type": "boolean"}
      }
    },
    "level": {
      "type": "object",
      "required": ["value", "unit"],
      "properties": {
        "value": {"type": "number"},
        "unit": {"type": "string", "default": "dBFS"}
      }
    },
    "timing": {
      "type": "object",
      "required": ["reference", "mode", "offsetMs"],
      "properties": {
        "reference": {"type": "string"},
        "mode": {"type": "string"},
        "offsetMs": {"type": "number"}
      }
    },
    "playback": {
      "type": "object",
      "required": ["mode"],
      "properties": {
        "mode": {"type": "string"},
        "fileStimulusPath": {"type": "string"}
      }
    },
    "measurement": {
      "type": "object",
      "required": ["mode"],
      "properties": {
        "mode": {"type": "string"},
        "sequentialChannels": {"type": "array", "items": {"type": "string"}}
      }
    },
    "startDelay": {"type": "number"},
    "protection": {
      "type": "object",
      "properties": {
        "abortOnClipping": {"type": "boolean"},
        "abortOnSPL": {"type": "boolean"},
        "clipThreshold": {"type": "number"},
        "splThreshold": {"type": "number"}
      }
    }
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "applied": {"type": "object"},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.set_measurement_naming`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId", "namePattern"],
  "properties": {
    "sessionId": {"type": "string"},
    "namePattern": {"type": "string"},
    "notes": {"type": "string"}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.run_sweep`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId"],
  "properties": {
    "sessionId": {"type": "string"},
    "command": {"type": "string", "default": "start"},
    "timeoutMs": {"type": "integer", "default": 120000}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "measurementId": {"type": "string"},
    "progress": {"type": "array", "items": {"type": "string"}},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.cancel_measurement`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId"],
  "properties": {"sessionId": {"type": "string"}}
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.list_measurements`
**Input**
```json
{
  "type": "object",
  "properties": {
    "includeDetails": {"type": "boolean", "default": false}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence", "measurements"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "measurements": {
      "type": "array",
      "items": {"type": "object"}
    },
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.export_measurement`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId", "measurementId", "format", "dataType"],
  "properties": {
    "sessionId": {"type": "string"},
    "measurementId": {"type": "string"},
    "format": {"type": "string", "enum": ["csv", "txt"]},
    "dataType": {"type": "string", "enum": ["frequency_response", "impulse_response"]},
    "targetPath": {"type": "string"}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "exportPath": {"type": "string"},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.analyze_measurement`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId", "measurementId"],
  "properties": {
    "sessionId": {"type": "string"},
    "measurementId": {"type": "string"},
    "analysisProfile": {"type": "string", "enum": ["placement", "glm_validation"]}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence", "summary"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "summary": {"type": "object"},
    "bands": {"type": "array", "items": {"type": "object"}},
    "peaks": {"type": "array", "items": {"type": "object"}},
    "nulls": {"type": "array", "items": {"type": "object"}},
    "sanity": {"type": "object"},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.compare_measurements`
**Input**
```json
{
  "type": "object",
  "required": ["baselineMeasurementId", "compareMeasurementId"],
  "properties": {
    "baselineMeasurementId": {"type": "string"},
    "compareMeasurementId": {"type": "string"},
    "mode": {"type": "string", "enum": ["pre_post", "lr_symmetry", "placement"]}
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence", "deltas"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "deltas": {"type": "object"},
    "topDivergences": {"type": "array", "items": {"type": "object"}},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

### `rew.session_run_sequence`
**Input**
```json
{
  "type": "object",
  "required": ["sessionId", "sequence"],
  "properties": {
    "sessionId": {"type": "string"},
    "sequence": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["label", "command"],
        "properties": {
          "label": {"type": "string"},
          "command": {"type": "string", "enum": ["L", "R", "Both", "Repeat"]},
          "notes": {"type": "string"}
        }
      }
    }
  }
}
```
**Output**
```json
{
  "type": "object",
  "required": ["status", "confidence", "results"],
  "properties": {
    "status": {"$ref": "#/$defs/status"},
    "confidence": {"$ref": "#/$defs/confidence"},
    "results": {"type": "array", "items": {"type": "object"}},
    "error": {"$ref": "#/$defs/error"}
  }
}
```

## 6) Measurement session state machine

```
IDLE
  └─(configure request + 2xx responses)→ CONFIGURING
CONFIGURING
  └─(all GET verifies match desired config)→ READY
READY
  └─(run sweep command 2xx)→ RUNNING
RUNNING
  ├─(subscription progress “complete” + new measurement in /measurements)→ WAITING_EXPORT
  ├─(cancel command 2xx)→ CANCELLED
  └─(timeout + 1 retry exhausted)→ FAILED
WAITING_EXPORT
  └─(export command 2xx)→ EXPORTING
EXPORTING
  └─(artifact exists + parseable)→ PARSING
PARSING
  └─(parse success)→ ANALYZING
ANALYZING
  └─(analysis done)→ COMPLETE
FAILED
CANCELLED
```

**Transition evidence**
- A state transition only occurs after a 2xx response and/or a documented progress event (subscription) plus local artifact verification.
- If progress events are missing, the server waits until timeout and retries once.

## 7) Error taxonomy + remediation guidance

**Connectivity**
- `ERR_REW_UNREACHABLE`: connection refused or timeout; verify REW running with `-api` and correct port.
- `ERR_REW_NONLOCAL_BLOCKED`: host not loopback; enforce localhost-only unless explicitly configured.

**Configuration**
- `ERR_INVALID_PARAM`: REW rejects payload (4xx). Remediate by validating against choices endpoints.
- `ERR_UNSUPPORTED_UNIT`: level unit not in `/measure/level/units`.

**Measurement lifecycle**
- `ERR_MEASURE_BUSY`: REW reports busy/409; retry once after delay.
- `ERR_MEASURE_TIMEOUT`: no completion progress within timeout.
- `ERR_MEASURE_CANCELLED`: cancellation confirmed.

**Export/parsing**
- `ERR_EXPORT_FAILED`: export command 4xx/5xx.
- `ERR_ARTIFACT_MISSING`: expected file not found.
- `ERR_PARSE_FAILED`: exported data not parseable or empty.

**Analysis**
- `ERR_ANALYSIS_INCOMPLETE`: missing or insufficient data for requested metrics.

## 7.1) Deterministic analysis rules (explicit)

**Frequency bands (SPL averages + deltas):**
- 20–80 Hz, 80–200 Hz, 200–500 Hz, 500–2 kHz, 2–10 kHz, 10 kHz+.

**Peak/null detection:**
- Peaks: local maxima ≥ +5 dB over local moving average, minimum 1/6th octave width.
- Nulls: local minima ≤ −6 dB under local moving average, minimum 1/6th octave width.

**Symmetry metrics (L/R):**
- RMS delta per band.
- Max divergence frequencies (top 3 by absolute delta).

**Sanity checks:**
- Export parseable and non-empty.
- Noise floor (estimate from lowest 10% energy bins if explicit noise floor not present).
- Clipping flags: if REW provides a flag, use it; otherwise detect saturation in IR samples when present.

**Confidence scoring:**
- High: all sanity checks pass, expected sweep length present, and noise floor below threshold.
- Medium: minor gaps or partial data, no critical failures.
- Low: parse failures, missing bands, or high noise floor uncertainty.

## 8) Testing plan

### Unit tests
- Pure analysis functions: peak/null detection, band summaries, symmetry, confidence.
- Use fixture exports (`tests/fixtures/exports/*`).

### Integration tests (requires REW running with `-api`)
**Windows**
- `"C:\\Program Files\\REW\\REW.exe" -api` (optional `-port 4735`).

**macOS**
- `/Applications/REW.app/Contents/MacOS/REW -api` (optional `-port 4735`).

**Headless**
- `REW -nogui -api` for automation; must call application shutdown command when done (documented in REW API help).

### Golden path scenario
1) Health check
2) Configure sweep
3) Set naming to `Session-{sessionId}-{channel}` and notes
4) Run L sweep → export FR/IR → analyze
5) Run R sweep → export FR/IR → analyze
6) Compare L vs R and pre/post, produce report

## 9) Future extensions
- Subscribe to `/measurements` and `/groups` for real-time updates.
- Use alignment tool endpoints when documented.
- Generator-based pink noise checks to validate noise floor and SPL stability.

## 10) REW endpoint inventory (exact endpoints + methods)

**Measure commands**
- `GET /measure/commands`
- `POST /measure/command` with `{ "command": "start" }` or `{ "command": "cancel" }`

**Sweep configuration**
- `GET|POST|PUT /measure/sweep/configuration` with `{ startFreq, endFreq, length, dither }`

**Measurement level**
- `GET|POST|PUT /measure/level` with `{ level, unit }`
- `GET /measure/level/units`

**Playback mode**
- `GET|POST|PUT /measure/playback-mode` with `{ mode }`
- `GET /measure/playback-mode/choices`
- `POST /measure/file-playback-stimulus` with `{ path }`

**Measurement mode**
- `GET|POST|PUT /measure/measurement-mode` with `{ mode }`
- `GET /measure/measurement-mode/choices`
- `GET|POST|PUT /measure/sequential-channels` with `{ channels }`
- `GET /measure/sequential-choices`

**Timing**
- `GET|POST|PUT /measure/timing` with `{ reference, mode }`
- `GET|POST|PUT /measure/timing-offset` with `{ offsetMs }`

**Start delay**
- `GET|POST|PUT /measure/start-delay` with `{ seconds }`

**Protection options**
- `GET|POST|PUT /measure/protection-options` with `{ abortOnClipping, abortOnSPL, clipThreshold, splThreshold }`

**Progress subscriptions**
- Subscribe to `/measure` to receive progress strings (avoid polling when possible).

**Measurements management**
- `GET /measurements`
- `GET /measurements/commands`
- `POST /measurements/command` with `{ command, options }` (e.g., export, save-all)
- `GET /measurements/:id` (supports numeric index or UUID)

**Optional generator**
- `GET /generator/status`
- `GET|POST /generator/signal`
- `GET /generator/signals`
- `GET|POST /generator/level`
- `GET|POST /generator/frequency`
- `POST /generator/commands`
