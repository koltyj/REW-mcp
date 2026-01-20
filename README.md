# REW MCP Server

An MCP (Model Context Protocol) server that interfaces with Room EQ Wizard (REW) via its HTTP API, enabling AI-assisted speaker placement decisions and validation of Genelec GLM calibration.

## Primary Use Cases

1. **Speaker placement optimization** — Compare measurements from different speaker positions
2. **Pre- vs post-GLM calibration comparison** — Validate what Genelec GLM addressed
3. **Room mode and null identification** — Detect problematic frequencies
4. **Decision support** — Move speaker vs trust GLM vs treat room

## Non-Goals

| Not Supported | Reason |
|---------------|--------|
| Real-time audio control | System orchestrates REW; does not play audio itself |
| DSP or EQ application | Human executes all changes |
| Replace Genelec GLM | Complements, doesn't replace |
| Automatic "magic fixes" | Advises only, human decides |

## Core Principle

**Epistemic honesty over false confidence.**

The system must:
- Never hallucinate causes
- Always mark uncertainty
- Prefer "likely" over "certain"
- Defer final judgment to humans

---

## REW HTTP API Reference

> **Official documentation**: https://www.roomeqwizard.com/help/help_en-GB/html/api.html  
> **OpenAPI specification**: Available at `http://localhost:4735/doc.json` or `http://localhost:4735/doc.yaml` when REW API is running.

### Key Facts (from official docs)

| Fact | Citation |
|------|----------|
| Default port is **4735** | "the default port is 4735" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Localhost-only by default | "It cannot be accessed outside the machine REW is running on" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Non-localhost requires `-host` argument | "To specify a different IP address, e.g. 0.0.0.0, add `-host \"0.0.0.0\"`" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Start API with `-api` flag | "To start the API server use the button on the API preferences or run REW with the `-api` argument" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Headless mode with `-nogui` | "To run REW without a GUI use the -nogui argument" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Pro upgrade required for automated sweeps | "to control REW via the API to make automated sweep measurements requires a Pro upgrade license" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Blocking mode for scripting | "a blocking mode can be enabled by POST to `/application/blocking`" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Subscriptions for progress updates | "Some endpoints allow subscriptions to be added to be notified of changes" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| 200 OK or 202 Accepted responses | "the response to a POST to an endpoint that runs a command may be 200 (OK) or 202 (Accepted)" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |
| Bad Request if command in progress | "An attempt to POST to an endpoint that would run another command while one is already in progress will return Bad Request" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) |

### Documented Endpoints

The following endpoints are documented in the official REW API help. Consult the OpenAPI spec at `localhost:4735/doc.json` for exact payload schemas.

#### Application Control
| Endpoint | Methods | Purpose | Citation |
|----------|---------|---------|----------|
| `/application/commands` | GET | List application commands | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#application) |
| `/application/command` | POST | Execute application command (e.g., shutdown) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#application) |
| `/application/blocking` | POST | Enable/disable blocking mode | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#blocking) |
| `/application/errors` | GET | Retrieve logged errors | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#application) |
| `/application/last-error` | GET | Retrieve most recent error | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#application) |
| `/application/logging` | POST | Enable/disable API message logging | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#logging) |
| `/application/inhibit-graph-updates` | POST | Inhibit graph updates | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#inhibitgraphupdates) |

#### Measurement Control (requires Pro upgrade for POST/PUT)
| Endpoint | Methods | Purpose | Citation |
|----------|---------|---------|----------|
| `/measure/commands` | GET | List measurement commands | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/command` | POST | Execute measurement command (start, cancel) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/naming` | GET, POST, PUT | Measurement naming settings | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/naming/naming-options` | GET | Naming options | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/notes` | GET, POST | Notes for next measurement | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/level` | GET, POST, PUT | Measurement level | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/level/units` | GET | Accepted level units | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/protection-options` | GET, POST, PUT | Clipping/SPL abort options | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/sweep/configuration` | GET, POST, PUT | Sweep config (start freq, end freq, length, dither) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/sweep/repetitions` | GET, POST | Number of sweep repetitions | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/timing` | GET, POST, PUT | Timing reference settings | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/timing/reference` | GET, POST | Timing reference | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/timing-offset` | GET, POST | Timing offset | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/playback-mode` | GET, POST | Playback mode | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/playback-mode/choices` | GET | Playback mode options | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/file-playback-stimulus` | POST | Set stimulus file path | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/measurement-mode` | GET, POST | Measurement mode (single, repeated, ramped, sequential) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/measurement-mode/choices` | GET | Measurement mode options | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/sequential-channels` | GET, POST | Channels for sequential mode | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/sequential-choices` | GET | Sequential channel options | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/start-delay` | GET, POST | Delay before measurement starts (seconds) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/number-of-repetitions` | GET, POST | Repetition count for repeated/ramped mode | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/start-level` | GET, POST | Start level for ramped measurements | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/end-level` | GET, POST | End level for ramped measurements | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |
| `/measure/capture-noise-floor` | GET, POST | Whether to capture noise floor | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measure) |

#### Measurements Management
| Endpoint | Methods | Purpose | Citation |
|----------|---------|---------|----------|
| `/measurements` | GET, DELETE | List/delete all measurements | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements) |
| `/measurements/:id` | GET, DELETE, PUT | Get/delete/update single measurement (by index or UUID) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements) |
| `/measurements/commands` | GET | List commands (Save all, Load, Sort alphabetically, Dirac) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements-commands) |
| `/measurements/command` | POST | Execute command | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements-commands) |
| `/measurements/:id/commands` | GET | List single-measurement commands (Save, smooth, etc.) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#singlecommands) |
| `/measurements/:id/command` | POST | Execute single-measurement command | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#singlecommands) |
| `/measurements/:id/frequency-response` | GET | Get frequency response data (Base64-encoded) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#freqresp) |
| `/measurements/:id/impulse-response` | GET | Get impulse response data (Base64-encoded) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#impulseresp) |
| `/measurements/:id/group-delay` | GET | Get group delay data | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#groupdelay) |
| `/measurements/:id/ir-windows` | GET, POST, PUT | IR window settings | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#irwindows) |
| `/measurements/:id/distortion` | GET | Distortion data | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#distortion) |
| `/measurements/selected-uuid` | GET, POST | Selected measurement UUID | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements) |
| `/measurements/selected` | GET, POST | Selected measurement index | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements) |
| `/measurements/frequency-response/units` | GET | Available FR units | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#freqresp) |
| `/measurements/frequency-response/smoothing-choices` | GET | Available smoothing options | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#freqresp) |
| `/measurements/impulse-response/units` | GET | Available IR units | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#impulseresp) |

#### Generator Control
| Endpoint | Methods | Purpose | Citation |
|----------|---------|---------|----------|
| `/generator/status` | GET | Generator status (enabled, playing, signal, level) | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#generator) |
| `/generator/signal` | GET, PUT | Current signal selection | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#generator) |
| `/generator/signals` | GET | Available signals | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#generator) |
| `/generator/signal/configuration` | GET, PUT | Signal configuration | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#generator) |
| `/generator/commands` | GET | List generator commands | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#generator) |

#### Other Endpoints
| Endpoint | Methods | Purpose | Citation |
|----------|---------|---------|----------|
| `/audio/*` | Various | Audio device configuration | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#audio) |
| `/alignment-tool/*` | Various | Alignment tool control | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#alignment-tool) |
| `/groups/*` | Various | Measurement groups | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#groups) |
| `/spl-meter/*` | Various | SPL meter control | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#spl-meter) |
| `/rta/*` | Various | RTA control | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#rta) |
| `/import/*` | Various | Import files/data | [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#import) |

### Example Commands (from official docs)

**Save all measurements** (documented example):
```json
{
  "command": "Save all",
  "parameters": [
    "C:/Users/myusername/REW/latest.mdat",
    "These are my latest files"
  ]
}
```
> Citation: [REW API Help - Measurements commands](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements-commands)

**Load measurements** (documented example):
```json
{
  "command": "Load",
  "parameters": [
    "C:/Users/myusername/REW/file1.mdat",
    "C:/Users/myusername/REW/file2.mdat"
  ]
}
```
> Citation: [REW API Help - Measurements commands](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements-commands)

**Save individual measurement** (documented example):
```json
{
  "command": "Save",
  "parameters": {"filename": "c:/users/myusername/downloads/myfile.mdat"}
}
```
> Citation: [REW API Help - Commands for individual measurements](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#singlecommands)

### Important Notes

1. **UUID vs Index**: "Using index numbers for measurements is NOT recommended. Index numbers change when measurements are added to or removed from a group or when other measurements are deleted." — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements)

2. **Array encoding**: "Arrays are transferred as Base64-encoded strings generated from the raw bytes of the 32-bit float sample values. Note that byte order is big-endian." — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#arrays)

3. **File paths**: "if a file path has backslash as the path separator the string for the path will need to escape the backslash entries, i.e. use a double backslash instead or replace backslash by forward slash." — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html#measurements-commands)

---

## MCP SDK Reference

> **Official repository**: https://github.com/modelcontextprotocol/typescript-sdk  
> **npm package (server)**: `@modelcontextprotocol/server`  
> **npm package (client)**: `@modelcontextprotocol/client`

### Installation

```bash
npm install @modelcontextprotocol/server zod
```
> Citation: [MCP TypeScript SDK README](https://github.com/modelcontextprotocol/typescript-sdk)

### Overview

"The Model Context Protocol (MCP) allows applications to provide context for LLMs in a standardized way, separating the concerns of providing context from the actual LLM interaction." — [MCP TypeScript SDK README](https://github.com/modelcontextprotocol/typescript-sdk)

---

## Implementation Plan

### Phase 0 — API Integration + Data Pipeline

**Scope**
- Connect to REW API (health check via `/measure/commands` or `/application/commands`)
- Configure sweep parameters via documented endpoints
- Run a sweep (requires Pro upgrade), track progress via subscriptions
- Save measurement data using "Save" or "Save all" commands
- Retrieve measurement data via `/measurements/:id/frequency-response` and `/measurements/:id/impulse-response`

**Acceptance Criteria**
- [ ] Health check reports status only after 2xx response from REW
- [ ] Configuration applies settings and verifies with GET calls
- [ ] Sweep returns success only after REW confirms completion via subscription + measurement appears in `/measurements`
- [ ] Data retrieval successfully decodes Base64-encoded frequency/impulse response data
- [ ] For any step: one retry max; otherwise FAIL with actionable error

### Phase 1 — Deterministic Analysis + Comparison

**Scope**
- Parse frequency response and impulse response data from REW API
- Deterministic analysis of FR/IR (no ML)
- Pre/post and L/R comparison tools
- Confidence scoring

**Acceptance Criteria**
- [ ] Analysis returns band summaries, peaks/nulls, and basic metrics
- [ ] Comparison returns structured deltas
- [ ] Confidence (high/medium/low) and reasons are always provided

### Phase 1.5 — Session Sequencing

**Scope**
- Scripted L/R sweeps with metadata using sequential measurement mode
- Optional generator control for pink noise checks

**Acceptance Criteria**
- [ ] Run scripted L, R, Both sweeps with deterministic naming
- [ ] Optional generator control uses only documented endpoints

---

## Proposed MCP Tools

### `rew.health_check`

Check if REW API is reachable and responsive.

**Input**
```json
{
  "host": "127.0.0.1",
  "port": 4735,
  "timeoutMs": 2000
}
```

**Output**
```json
{
  "status": "success | failed",
  "commands": ["list", "of", "commands"],
  "error": { "code": "string", "message": "string" }
}
```

### `rew.configure_sweep`

Configure sweep parameters using documented REW endpoints.

**Implementation**: Uses `/measure/sweep/configuration`, `/measure/level`, `/measure/timing`, `/measure/playback-mode`, `/measure/measurement-mode`, `/measure/start-delay`, `/measure/protection-options`.

### `rew.run_sweep`

Start a sweep measurement (requires REW Pro upgrade).

**Implementation**: Uses `/measure/command` with POST. Monitor progress via subscription to `/measure`.

### `rew.list_measurements`

List current measurements in REW.

**Implementation**: Uses GET `/measurements`.

### `rew.get_measurement_data`

Retrieve frequency response or impulse response data.

**Implementation**: Uses `/measurements/:id/frequency-response` or `/measurements/:id/impulse-response`. Decodes Base64 data per documented format.

### `rew.save_measurements`

Save measurements to file.

**Implementation**: Uses `/measurements/command` with "Save all" command or `/measurements/:id/command` with "Save" command.

### `rew.analyze_measurement`

Perform deterministic analysis on measurement data.

**Implementation**: Local analysis of decoded FR/IR data. No REW API calls.

### `rew.compare_measurements`

Compare two measurements for placement optimization or GLM validation.

**Implementation**: Local comparison of decoded FR/IR data. No REW API calls.

---

## Deterministic Analysis Rules

These are proposed analysis rules for the MCP server to apply. They are **not** part of REW's API—they are local computations performed on data retrieved from REW.

### Frequency Bands (for band summaries)
- Sub-bass: 20–80 Hz
- Bass: 80–200 Hz
- Low-mid: 200–500 Hz
- Mid: 500–2 kHz
- High-mid: 2–10 kHz
- High: 10 kHz+

### Peak/Null Detection (proposed thresholds)
- **Peaks**: Local maxima ≥ +5 dB over local moving average
- **Nulls**: Local minima ≤ −6 dB below local moving average

### Confidence Scoring (proposed)
- **High**: Data parses correctly, expected frequency range present, low noise
- **Medium**: Minor gaps or partial data
- **Low**: Parse issues, missing bands, or high uncertainty

---

## Error Handling (Proposed)

| Error Code | Meaning | Remediation |
|------------|---------|-------------|
| `ERR_CONNECTION_REFUSED` | Cannot connect to REW API | Verify REW is running with `-api` flag |
| `ERR_NONLOCAL_BLOCKED` | Attempted non-localhost connection | Use localhost or configure REW with `-host` |
| `ERR_BAD_REQUEST` | REW rejected request (400) | Check payload against OpenAPI spec |
| `ERR_COMMAND_IN_PROGRESS` | Another command is running | Wait for completion or use blocking mode |
| `ERR_PRO_REQUIRED` | POST/PUT requires Pro upgrade | Acquire REW Pro license for automation |
| `ERR_PARSE_FAILED` | Could not decode response data | Check Base64 decoding and byte order |

---

## Repo Layout (Proposed)

```
rew-mcp/
  README.md
  package.json
  tsconfig.json
  src/
    server.ts               # MCP server entry
    config/
      defaults.ts           # Default host/port, timeouts
    rew/
      client.ts             # HTTP client wrapper for REW API
      endpoints.ts          # Endpoint constants
    tools/
      healthCheck.ts
      configureSweep.ts
      runSweep.ts
      listMeasurements.ts
      getMeasurementData.ts
      saveMeasurements.ts
      analyzeMeasurement.ts
      compareMeasurements.ts
    analysis/
      parseResponse.ts      # Decode Base64 FR/IR data
      metrics.ts            # Peak/null detection, band summaries
      compare.ts            # Comparison logic
    types/
      index.ts              # Type definitions
  tests/
    unit/
      analysis/*.test.ts
    integration/
      rew-api/*.test.ts
    fixtures/
      sample-fr.json
      sample-ir.json
```

---

## Running REW for Development

**Windows**:
```bash
"C:\Program Files\REW\roomeqwizard.exe" -api
```

**macOS**:
```bash
open -a REW.app --args -api
```

**Headless (for automation)**:
```bash
REW -nogui -api
```

> "you must use the application shutdown command to close REW when done" — [REW API Help](https://www.roomeqwizard.com/help/help_en-GB/html/api.html)

**Custom port**:
```bash
REW -api -port 4567
```

---

## Testing Plan

### Unit Tests
- Decoding Base64 frequency response data
- Peak/null detection algorithms
- Band summary calculations
- Comparison logic

### Integration Tests (requires REW running with `-api`)
1. Health check
2. List measurements
3. Get measurement data
4. Save measurements

### Golden Path Scenario
1. Health check → confirm API accessible
2. List existing measurements
3. Retrieve frequency response for a measurement
4. Analyze the measurement locally
5. Compare two measurements

---

## References

1. **REW API Documentation**: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
2. **REW Pro Upgrade** (required for automated measurements): https://www.roomeqwizard.com/upgrades.html
3. **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
4. **Model Context Protocol Specification**: https://modelcontextprotocol.io/

---

## License

[Specify license]
