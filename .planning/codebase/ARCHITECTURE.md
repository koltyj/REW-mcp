# Architecture

**Analysis Date:** 2026-01-21

## Pattern Overview

**Overall:** MCP (Model Context Protocol) Server with Layered Analysis Engine

**Key Characteristics:**
- Tool-based interface following MCP specification for AI-assistant integration
- Modular analysis layers decoupled from transport mechanism
- In-memory measurement storage with ID-based retrieval
- Schema-validated inputs using Zod for type safety
- Dual-path operation: local file ingestion and remote REW API connectivity

## Layers

**Transport Layer:**
- Purpose: Communicate via Model Context Protocol over stdio
- Location: `src/index.ts`
- Contains: MCP server initialization, tool request/response handling
- Depends on: Tools layer, @modelcontextprotocol/sdk
- Used by: Claude and other MCP clients

**Tool Layer:**
- Purpose: MCP tool implementations that expose analysis capabilities as callable functions
- Location: `src/tools/`
- Contains: 18 individual tool executors with Zod input schemas
- Depends on: Analysis layer, Parser layer, API layer, Store, Types
- Used by: Transport layer (CallToolRequest handler)
- Key implementations: `ingest.ts`, `compare.ts`, `room-modes.ts`, `decay.ts`, `impulse.ts`, `api-connect.ts`, `api-measure-workflow.ts`

**Analysis Layer:**
- Purpose: Acoustic analysis algorithms and signal processing
- Location: `src/analysis/`
- Contains: Pure functions for peak/null detection, room mode correlation, decay analysis, reflection identification, averaging, subwoofer integration, target curve comparison
- Depends on: Types
- Used by: Tools layer, other analysis modules
- Key modules: `peaks-nulls.ts`, `room-modes.ts`, `decay.ts`, `reflections.ts`, `averaging.ts`, `sub-integration.ts`, `target-curves.ts`

**API Client Layer:**
- Purpose: REST API communication with running REW instance
- Location: `src/api/`
- Contains: REW HTTP client, Base64 float array decoder for binary data
- Depends on: Types, Node fetch API
- Used by: API tools (api-connect, api-measure, api-audio, api-generator, api-spl-meter, api-measure-workflow)
- Key module: `rew-client.ts` (REWApiClient class with connection management)

**Parser Layer:**
- Purpose: Convert REW text export formats to structured data
- Location: `src/parser/`
- Contains: REW frequency response and impulse response text format parsing
- Depends on: Types
- Used by: Ingest tool
- Key module: `rew-text.ts` (format detection, metadata extraction, data point parsing)

**Storage Layer:**
- Purpose: In-memory persistence of parsed measurements between tool calls
- Location: `src/store/`
- Contains: Singleton measurement store with Map-based storage
- Depends on: Types
- Used by: Analysis tools, comparison tools
- Key module: `measurement.ts` (MeasurementStore class with CRUD operations)

**Types Layer:**
- Purpose: Shared type definitions and interfaces
- Location: `src/types/index.ts`
- Contains: Complete type system for measurements, analysis results, API responses
- Depends on: None
- Used by: All other layers

## Data Flow

**Measurement Ingestion (Local File):**

1. User calls `rew.ingest_measurement` tool with REW text export content
2. Tool validates input with `IngestInputSchema` (Zod validation)
3. Parser detects format (frequency response vs impulse response)
4. Parser extracts metadata, confidence levels, warnings
5. Analysis layer calculates quick stats (bass/midrange/treble averages)
6. StoredMeasurement object created with unique ID
7. Store persists measurement in-memory
8. Tool returns IngestResult with measurement ID and summary

**Measurement Analysis (Room Modes Example):**

1. User calls `rew.analyze_room_modes` with measurement ID and optional room dimensions
2. Tool retrieves StoredMeasurement from store by ID
3. Analysis functions called in sequence:
   - `detectPeaks()` - identifies local maxima in frequency response
   - `detectNulls()` - identifies local minima in frequency response
   - `calculateTheoreticalModes()` - computes expected modes from room dimensions
   - `correlatePeaksWithModes()` - maps detected peaks to theoretical modes
   - `assessModeDistribution()` - evaluates overall mode quality
4. Results compiled into RoomModesResult
5. Severity classifications applied based on deviation thresholds
6. GLM addressability evaluated (cuts only, not fills)
7. Tool returns ToolResponse with analysis results

**Remote Measurement (API Path):**

1. User calls `rew.api_connect` with host/port
2. REWApiClient created and connection tested
3. Client stored as activeClient for subsequent API tools
4. User calls `rew.api_list_measurements` to see available measurements
5. User calls `rew.api_get_measurement` with measurement UUID
6. REWApiClient fetches measurement via HTTP, decodes Base64 float arrays
7. Returns FrequencyResponseData or ImpulseResponseData
8. Can feed results back into analysis tools via local ingestion

**State Management:**

- In-memory only: measurementStore holds all ingested/retrieved measurements
- Session scope: measurements persist for lifetime of server process
- Remote client: activeClient persists for lifetime or until disconnected
- No persistence: measurements lost on server restart
- ID-based retrieval: measurement IDs generated from speaker_id + condition + counter

## Key Abstractions

**StoredMeasurement:**
- Purpose: Unified container for all measurement data and metadata
- Examples: `src/types/index.ts` (lines 93-103)
- Pattern: Immutable data structure combining frequency response, impulse response, quick stats, and quality metadata

**ToolResponse<T>:**
- Purpose: Standardized response envelope for all tool outputs
- Examples: Used in all tool executors
- Pattern: Generic wrapper with status, data, error_type, message, suggestion fields

**FrequencyResponseData:**
- Purpose: Parallel arrays representing acoustic measurement
- Examples: `src/types/index.ts` (lines 31-35)
- Pattern: Three parallel arrays (frequencies_hz, spl_db, phase_degrees) indexed by frequency point

**DetectedPeak / DetectedNull:**
- Purpose: Describes a single acoustic issue with context and severity
- Examples: `src/types/index.ts` (lines 126-146)
- Pattern: Result object with frequency, level, deviation, classification, mode correlation, GLM addressability

**REWApiClient:**
- Purpose: Stateful connection to remote REW instance
- Examples: `src/api/rew-client.ts`
- Pattern: Class wrapping HTTP client with connection validation, URL building, response parsing

## Entry Points

**Server Entry:**
- Location: `src/index.ts`
- Triggers: `npm start` or direct node invocation (binary at dist/index.js)
- Responsibilities: Create MCP server, register tools, handle stdio transport, setup error handlers

**Tool Registration:**
- Location: `src/tools/index.ts` (registerTools function)
- Triggers: Called once at server startup
- Responsibilities: Define all 18 tools with schemas, attach handlers to server

**Individual Tool Execution:**
- Location: Each `src/tools/*.ts` (execute* functions)
- Triggers: MCP CallToolRequest with tool name and arguments
- Responsibilities: Validate input schema, call analysis functions, format response

## Error Handling

**Strategy:** Layered validation with descriptive error responses

**Patterns:**

- Input validation: Zod schema parsing at tool boundary with validation_error responses
- Resource errors: measurement_not_found, client_not_connected with suggestion field
- Analysis errors: Return error status in ToolResponse rather than throwing
- Internal errors: Catch at tool level, return error response via MCP protocol
- Data quality: Confidence levels and warnings embedded in results, not errors

**Data Quality Warnings:**
- Embedded in DataQuality interface (warnings array)
- Severity levels: info, warning, error
- Used in ingest and comparison results to communicate uncertainty

## Cross-Cutting Concerns

**Logging:**
- Console.error for MCP errors and fatal startup errors
- No structured logging framework
- Suggestion field in tool responses conveys user-actionable guidance

**Validation:**
- Zod schemas enforce input correctness at tool boundary
- Type-safe inference of input types from schemas
- Frequency/level ranges validated per tool requirements

**Authentication:**
- REW API: Port/host validation, connection test, no auth token support
- No inter-tool authorization needed

---

*Architecture analysis: 2026-01-21*
