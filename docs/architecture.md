# Architecture

## Overview

`rew-mcp` is a stdio-based Model Context Protocol server for Room EQ Wizard workflows. The server exposes REW measurement and analysis capabilities as MCP tools, prompts, and resources so an MCP client can guide a user through calibration, measurement, interpretation, and optimization.

## Runtime Flow

1. `src/index.ts` creates the MCP server and registers tools, prompts, and resources.
2. `src/api/rew-client.ts` talks to the local REW HTTP API on `localhost:4735`.
3. Tool handlers in `src/tools/` validate input, call REW or internal analysis modules, and return structured results.
4. Domain logic in `src/analysis/`, `src/interpretation/`, and `src/optimization/` converts raw measurements into findings and recommendations.
5. Session and measurement state is tracked in `src/session/`, `src/store/`, and `src/resources/` so MCP clients can continue multi-step workflows.

## Module Layout

### `src/api/`

HTTP client, schemas, and REW-specific request and response validation.

### `src/tools/`

MCP tool registrations and handlers for measurement control, data ingestion, acoustic analysis, and optimization workflows.

### `src/analysis/`

Signal-processing and acoustics algorithms for averaging, decay, peaks and nulls, room modes, reflections, sub integration, and target comparisons.

### `src/interpretation/`

Plain-language interpretation and prioritization layers that convert raw metrics into user-facing guidance.

### `src/optimization/`

Recommendation generation, validation logic, and success criteria for iterative room and speaker-placement changes.

### `src/prompts/`

Reusable MCP prompts for common workflows such as gain staging, measurement sessions, and optimization loops.

### `src/resources/`

MCP resources that expose session state, measurement payloads, recommendation state, and history over URI-based access.

### `src/session/` and `src/store/`

Session orchestration and in-memory data storage used by multi-step calibration and measurement flows.

## External Dependencies

- Node.js 18+
- Room EQ Wizard with the REW API enabled
- `@modelcontextprotocol/sdk` for MCP transport and server APIs
- `zod` for runtime validation

## Release Model

- Source is authored in TypeScript under `src/`
- `npm run build` compiles output to `dist/`
- `npm publish` ships the compiled server plus project documentation and governance files
