# Codebase Structure

**Analysis Date:** 2026-01-21

## Directory Layout

```
rew-mcp/
├── src/                        # Source code
│   ├── index.ts               # MCP server entry point
│   ├── analysis/              # Acoustic analysis algorithms
│   ├── api/                   # REW API client and utilities
│   ├── parser/                # REW file format parsers
│   ├── store/                 # In-memory measurement storage
│   ├── tools/                 # MCP tool implementations
│   └── types/                 # Shared TypeScript interfaces
├── dist/                       # Compiled JavaScript (generated)
├── docs/                       # Documentation
├── .planning/                  # GSD planning artifacts
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vitest.config.ts           # Test runner configuration
├── .eslintrc.json             # Linting rules
└── README.md                  # Project documentation
```

## Directory Purposes

**src/:**
- Purpose: All TypeScript source code
- Contains: Seven subdirectories plus entry point
- Key files: `index.ts` (server initialization)

**src/analysis/:**
- Purpose: Acoustic measurement analysis algorithms
- Contains: Pure functions for signal processing and acoustic assessment
- Key files:
  - `peaks-nulls.ts` - Peak/null detection, Q factor estimation, severity classification
  - `room-modes.ts` - Theoretical mode calculation, mode correlation, distribution assessment
  - `decay.ts` - T20/T30/EDT calculations, decay character classification
  - `reflections.ts` - Early reflection identification, comb filter analysis
  - `averaging.ts` - RMS/vector/hybrid averaging methods for spatial measurements
  - `sub-integration.ts` - Phase alignment, polarity, crossover region analysis
  - `target-curves.ts` - Target curve generation and deviation calculation
  - `index.ts` - Barrel exports for all analysis modules
- Generated from: Original acoustics code plus test fixtures
- Note: All analysis functions are pure, accept FrequencyResponseData, return analysis results

**src/api/:**
- Purpose: HTTP communication with remote REW instances
- Contains: REW API client and binary data decoding
- Key files:
  - `rew-client.ts` - REWApiClient class, connection management, HTTP methods for all REW API endpoints
  - `base64-decoder.ts` - Decodes Base64-encoded float arrays from REW API responses
  - `index.ts` - Barrel exports
- Pattern: REWApiClient is stateful connection wrapper, maintains host/port/timeout config

**src/parser/:**
- Purpose: Convert REW text export files to structured data
- Contains: Format detection and parsing logic
- Key files:
  - `rew-text.ts` - Main parser with format detection, metadata extraction, numeric parsing for both period and comma decimal separators
  - `index.ts` - Barrel exports
- Note: Handles both frequency response (Hz ascending) and impulse response (time ascending) formats

**src/store/:**
- Purpose: In-memory persistence of measurements
- Contains: Single singleton store class
- Key files:
  - `measurement.ts` - MeasurementStore class with Map<string, StoredMeasurement>
- Capabilities: Get/has/store/delete/clear, filter by speaker_id/condition, list summaries
- Scope: Session-only, lost on server restart

**src/tools/:**
- Purpose: MCP tool implementations and orchestration
- Contains: 18 tool modules plus registration logic
- Core data flow tools:
  - `ingest.ts` - Parse and store REW exports (local file ingestion)
  - `compare.ts` - Compare two or more measurements (before/after, L/R symmetry, etc.)
  - `room-modes.ts` - Analyze room modes, peaks, nulls with optional theoretical mode correlation
  - `decay.ts` - Analyze impulse response decay characteristics
  - `impulse.ts` - Analyze early reflections and reflection paths
  - `glm-interpret.ts` - Interpret results with Genelec GLM capabilities/limitations context
  - `averaging.ts` - Spatial averaging (RMS/vector/hybrid methods)
  - `sub-integration.ts` - Subwoofer phase/polarity/timing analysis
  - `target-compare.ts` - Compare measurement to target curves (flat, REW room curve, Harman, custom)
- API integration tools:
  - `api-connect.ts` - Connection management, stores activeClient
  - `api-list-measurements.ts` - List available measurements from REW
  - `api-get-measurement.ts` - Fetch individual measurement by UUID
  - `api-measure.ts` - Control sweep/SPL measurements via API
  - `api-audio.ts` - Configure input/output devices, sample rate
  - `api-generator.ts` - Control signal generator (tones, noise, sweeps)
  - `api-spl-meter.ts` - Live SPL monitoring
  - `api-measure-workflow.ts` - Orchestration of complete measurement sequence
- Other:
  - `index.ts` - Tool registration, MCP request handler, tool schema definitions
- Pattern: Each tool has IngestInputSchema (Zod), executeXxx function, XxxResult interface

**src/types/:**
- Purpose: Shared type definitions
- Contains: Complete type system, enums, interfaces
- Key files:
  - `index.ts` - All type definitions (300+ lines)
- Key types:
  - SpeakerId enum: L, R, C, Sub, Combined, LFE, SL, SR, RL, RR
  - StoredMeasurement: Master container
  - FrequencyResponseData: Parallel arrays for FR
  - ImpulseResponseData: Samples + metadata
  - DetectedPeak/DetectedNull: Analysis results
  - ToolResponse<T>: Generic response wrapper
  - TheoreticalMode, ProblematicDecay, EarlyReflection: Domain objects

**dist/:**
- Purpose: Compiled JavaScript output (generated, committed)
- Contains: JavaScript + source maps + declaration files
- Generated by: `npm run build` (tsc + chmod +x)
- Entry point: `dist/index.js` (executable binary, see package.json bin field)

**docs/:**
- Purpose: User and developer documentation
- Contains: API reference, file formats, analysis methodology
- Key files: Referenced by comments but structure varies per convention

## Key File Locations

**Entry Points:**
- `src/index.ts` - MCP server initialization, connection setup
- `dist/index.js` - Compiled entry point (executable), created by build
- `package.json` - bin field points to `rew-mcp: dist/index.js`

**Configuration:**
- `tsconfig.json` - TypeScript compiler options (ES2022 target, strict mode, ES modules)
- `vitest.config.ts` - Test runner configuration (Node environment, global test functions)
- `.eslintrc.json` - Linting rules (@typescript-eslint, explicit function return types, no unused vars)
- `package.json` - Dependency versions, build/test/lint commands

**Core Logic:**
- `src/types/index.ts` - Type system (single source of truth for interfaces)
- `src/store/measurement.ts` - Measurement persistence (singleton store instance)
- `src/tools/index.ts` - Tool registration and request routing (switch statement for 18 tools)
- `src/analysis/*.ts` - Pure analysis functions (no side effects, only data transformation)

**Testing:**
- `src/**/*.test.ts` - Co-located test files (parallel structure to src/)
- `vitest.config.ts` - Coverage includes src/, excludes tests and types/
- Tests use: describe/it/expect from vitest

**API Integration:**
- `src/api/rew-client.ts` - HTTP client wrapping REW REST API
- `src/tools/api-connect.ts` - Connection management (getActiveApiClient function)

## Naming Conventions

**Files:**
- Tool files: `{feature}.ts` (e.g., `room-modes.ts`, `api-connect.ts`)
- Test files: `{name}.test.ts` (co-located with implementation)
- Utilities/modules: Descriptive names without prefix (e.g., `rew-client.ts`, `rew-text.ts`)
- Index files: `index.ts` (barrel exports for directory)

**Functions:**
- Tool executors: `execute{Feature}` (e.g., `executeIngest`, `executeRoomModes`)
- Input validators: `{Feature}InputSchema` (Zod object)
- Utilities: Descriptive verb phrases (e.g., `calculateBandAverage`, `detectPeaks`, `estimateQFactor`)
- Getters: `get{Item}` (e.g., `getActiveApiClient`)

**Variables:**
- Constants (Zod schemas): UPPERCASE_SNAKE (actually PascalCase + Suffix: `IngestInputSchema`)
- Measurement IDs: snake_case (e.g., `l_baseline_1`)
- Frequencies: Include unit in name (e.g., `frequency_hz`, `center_frequency_hz`)
- Time values: Include unit (e.g., `delay_ms`, `t60_seconds`, `duration_s`)
- Measurements: camelCase (e.g., `spl_db`, `phase_degrees`)

**Types:**
- Interfaces: PascalCase (e.g., `StoredMeasurement`, `DetectedPeak`)
- Types: PascalCase (e.g., `SpeakerId`, `Severity`, `DecayCharacter`)
- Enums: PascalCase values (e.g., 'significant' | 'moderate' | 'minor')

**Directories:**
- kebab-case for feature directories (e.g., `analysis/`, `api/`, `parser/`, `tools/`)
- lowercase for logical groupings

## Where to Add New Code

**New Analysis Feature:**
1. Create function in `src/analysis/{feature}.ts`
2. Export from `src/analysis/index.ts`
3. Add type definitions to `src/types/index.ts`
4. Create `src/analysis/{feature}.test.ts` with vitest tests
5. Import and use in tool at `src/tools/{feature}.ts`

**New Tool (MCP Endpoint):**
1. Create `src/tools/{tool-name}.ts` with:
   - `{Feature}InputSchema` (Zod object)
   - `{Feature}Result` interface
   - `execute{Feature}` async function
2. Import in `src/tools/index.ts`
3. Add tool definition to tools array in ListToolsRequestSchema handler
4. Add case statement to CallToolRequestSchema handler (switch on tool name)
5. Follow pattern: validate → analyze → format response

**New Analysis Type:**
- Add to `src/types/index.ts` with clear JSDoc comments
- Follow existing patterns: use literal unions for enums (e.g., 'high' | 'medium' | 'low')
- Include units in property names for numeric values

**Utilities:**
- Shared helpers across multiple tools: `src/analysis/` (pure functions)
- Store-related helpers: Methods on MeasurementStore class (`src/store/measurement.ts`)
- API-related helpers: Methods on REWApiClient class (`src/api/rew-client.ts`)

## Special Directories

**node_modules/:**
- Purpose: Package dependencies (excluded from git)
- Generated by: `npm install` (from package-lock.json)
- Do not commit: Managed by package manager

**dist/:**
- Purpose: Compiled JavaScript output
- Generated by: `npm run build` (TypeScript compilation + chmod)
- Committed: Yes, for npm package distribution
- Do not edit: Always regenerate from src/

**.git/:**
- Purpose: Version control
- Do not edit: Git internals

**.planning/:**
- Purpose: GSD (Generative Software Development) planning artifacts
- Generated by: GSD orchestrator tools
- Structure: .planning/codebase/ contains mapping documents (ARCHITECTURE.md, etc.)
- Committed: Yes, for team reference

---

*Structure analysis: 2026-01-21*
