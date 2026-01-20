# REW MCP Server

An MCP (Model Context Protocol) server that exposes Room EQ Wizard (REW) measurement data and analysis tools to LLMs, enabling AI-assisted speaker placement decisions and validation of Genelec GLM calibration.

## What This Is

The MCP server **does not control REW in real time**. It:

- Ingests, parses, compares, and analyzes REW exports
- Provides structured insights to an LLM (Claude/Copilot)
- Enables AI-assisted decision support for room acoustics

## Primary Use Cases

1. **Speaker placement optimization** - Compare measurements from different speaker positions
2. **Pre- vs post-GLM calibration comparison** - Validate what Genelec GLM addressed
3. **Room mode and null identification** - Detect problematic frequencies
4. **Decision support** - Move speaker vs trust GLM vs treat room

## Non-Goals

| ❌ Not Supported | Reason |
|-----------------|--------|
| Real-time audio control | System is analysis-only |
| DSP or EQ application | Human executes all changes |
| Replace Genelec GLM | Complements, doesn't replace |
| Automatic "magic fixes" | Advises only, human decides |

## Documentation

| Document | Purpose |
|----------|---------|
| [Architecture](docs/architecture.md) | System design and data flow |
| [File Formats](docs/file-formats.md) | REW export format specifications |
| [Analysis Rules](docs/analysis-rules.md) | Deterministic analysis algorithms |
| [GLM Context](docs/glm-context.md) | Genelec GLM behavior reference |
| [Guardrails](docs/guardrails.md) | Safety constraints and quality rules |
| [Examples](docs/examples.md) | Usage patterns and workflows |

### Tool Specifications

| Tool | Purpose |
|------|---------|
| [rew.ingest_measurement](docs/tools/ingest-measurement.md) | Parse and normalize REW exports |
| [rew.compare_measurements](docs/tools/compare-measurements.md) | Compare two or more measurements |
| [rew.analyze_room_modes](docs/tools/analyze-room-modes.md) | Detect peaks, nulls, and modes |
| [rew.analyze_decay](docs/tools/analyze-decay.md) | Waterfall and decay interpretation |
| [rew.analyze_impulse](docs/tools/analyze-impulse.md) | Impulse response and ETC analysis |
| [rew.interpret_with_glm_context](docs/tools/interpret-with-glm-context.md) | GLM-aware result interpretation |

## Quick Start Workflow

```
1. User measures with REW → exports data files
2. MCP server ingests measurement files
3. LLM calls analysis tools
4. LLM explains results to user
5. User makes physical changes
6. Repeat until satisfied
```

## Implementation Deliverables

When implementing this MCP server, produce:

1. MCP server scaffold (TypeScript/Python)
2. Tool schemas (JSON Schema)
3. REW parser module
4. Analysis engine (deterministic rules, not ML)
5. Test suite with sample REW exports
6. User-facing documentation

## Success Criteria

The system is successful if it can:

- Clearly state "Placement B is objectively better than Placement A"
- Explain why GLM did or did not fix an issue
- Reduce guesswork without pretending certainty
- Respect Genelec GLM's design philosophy

## Core Principle

**Epistemic honesty over false confidence.**

The system must:
- Never hallucinate causes
- Always mark uncertainty
- Prefer "likely" over "certain"
- Defer final judgment to humans
