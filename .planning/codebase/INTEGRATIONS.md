# External Integrations

**Analysis Date:** 2026-01-21

## APIs & External Services

**Room EQ Wizard (REW) REST API:**
- Service: Local REW instance running on same machine
- What it's used for:
  - Connect to active REW measurement session
  - List available measurements from REW project
  - Fetch frequency response data with various smoothing/options
  - Fetch impulse response and waterfall data
  - Generate test signals (sine sweeps, chirps)
  - Control SPL meter hardware
  - Measure and record new frequency response/impulse response
  - Manage audio playback routing
- SDK/Client: Custom implementation `src/api/rew-client.ts` (REWApiClient class)
- Auth: None - local HTTP communication (no credentials needed)
- Base URL: `http://127.0.0.1:4735` (configurable host/port in `src/tools/api-connect.ts`)
- Port default: 4735 (user-configurable via tool parameters)
- OpenAPI spec: Available at `/doc.json` endpoint (Swagger UI at root)
- Connection: Requires REW launched with `-api` flag or API enabled in Preferences

## Data Storage

**In-Memory Store:**
- Type: In-process Map-based cache
- Location: `src/store/measurement.ts`
- Purpose: Stores parsed measurements during analysis session
- Persistence: None (ephemeral - lost when MCP server terminates)
- Implementation: Map<string, StoredMeasurement>
- Key structure: `{speaker_id}_{condition}` sanitized to lowercase alphanumeric

**File Input (No Database):**
- REW text export files - parsed on-demand
- Formats supported:
  - Frequency response text exports (SPL vs frequency)
  - Impulse response text exports (time-domain samples)
  - Waterfall data files (spectrogram format)
- Parser: `src/parser/rew-text.ts` detects format and parses text data
- Base64 decoding: `src/api/base64-decoder.ts` for REW's encoded float arrays

**No External File Storage:**
- No S3, cloud storage, or persistent database
- All analysis is stateless except for in-memory session data

## Authentication & Identity

**Auth Provider:** None

**Implementation approach:**
- Analysis-only, no user authentication
- REW API is localhost-only (no remote access)
- No credentials, tokens, or API keys needed
- No session management required

## Monitoring & Observability

**Error Tracking:** None

**Logging:**
- Approach: Console-based (stderr for MCP protocol, stdout for tool output)
- Tools: `console.error()` for errors, `console.warn()` for warnings
- MCP server logs via: `server.onerror` handler in `src/index.ts`
- No external log aggregation

**No external integrations for:**
- APM (Application Performance Monitoring)
- Error tracking (Sentry, etc.)
- Metrics collection

## CI/CD & Deployment

**Hosting:**
- npm registry - Published as public package `rew-mcp`
- GitHub Releases - Source repository at github.com/koltonjacobs/rew-mcp
- No cloud deployment (client-side only)

**CI Pipeline:**
- GitHub Actions configured (based on prepublishOnly hook)
- Workflow includes: build, test, lint validation before publish
- No deployment pipeline to external services

**Installation Delivery:**
- npm install (global or local)
- npx direct execution (no installation)
- Integrated into MCP server registries (Smithery, GitHub)

## Environment Configuration

**Required environment variables:**
- None - all configuration is runtime parameters

**Runtime Configuration (via tool parameters):**
- `rew_api_host` - REW API host address (default: 127.0.0.1)
- `rew_api_port` - REW API port (default: 4735, range: 1025-65535)
- `timeout_ms` - Connection timeout in milliseconds (default: 10000, range: 1000-60000)

**Configuration methods:**
1. Tool input parameters - Set per-call in `rew.api_connect` tool
2. Hardcoded defaults - In tool schemas at tool definition time
3. No config files or environment variables used

**Secrets location:**
- No secrets required (no databases, no external APIs)
- REW API runs locally (no credentials)
- If using firewall: ensure port 4735 accessible on localhost

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

**Note:** REW MCP is analysis-only. It does not:
- Register webhooks with REW API
- Trigger callbacks or events
- Subscribe to real-time data streams
- Support bidirectional communication with other services

## Integration Patterns Used

**Pull-Based (On-Demand):**
- REW API calls made only when tool invoked
- No polling or background sync
- Tools: `rew.api_connect`, `rew.api_list_measurements`, `rew.api_get_measurement`

**Data Transformation:**
- REW export text → Parsed data structures (in `src/parser/rew-text.ts`)
- Zod schemas validate all inputs from LLM → tool parameters
- JSON responses to LLM via MCP protocol

**Local-Only Architecture:**
- All external integrations are localhost HTTP
- No internet connectivity required
- No API rate limits or throttling needed
- No authentication/authorization to manage

## Known Constraints & Limitations

**REW API Version Dependency:**
- Requires REW v5.30+ (API introduced in v5.30)
- Older versions will not have `/doc.json` endpoint (returns 404)
- Some API endpoints are REW Pro features (pro_features flag in response)

**Single Active Connection:**
- Only one REW instance per MCP server session
- `activeClient` singleton in `src/tools/api-connect.ts`
- Subsequent api_connect calls replace previous connection

**No Async Job Submission:**
- Measurement operations are synchronous
- Long-running measurements block tool response
- No background task queuing

---

*Integration audit: 2026-01-21*
