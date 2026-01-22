# REW MCP Server

## What This Is

An MCP server that enables Claude to control Room EQ Wizard (REW) for acoustic measurement and analysis, serving as an intelligent calibration assistant for studio monitoring. The server connects to REW's REST API to take measurements, analyze room acoustics, and guide users through speaker placement and calibration — replacing the "run GLM and hope for the best" workflow with data-driven, iterative optimization.

## Core Value

Claude can autonomously measure, interpret, and guide fixes for room acoustics — turning raw frequency response data into actionable placement and treatment recommendations that actually improve mix translation.

## Current State (v1.0 Shipped)

**Shipped:** 2026-01-22

**Capabilities:**
- 22 MCP tools for measurement, analysis, and optimization
- 4 MCP resources (session://, measurement://, recommendations://, history://)
- 4 MCP prompts for guided calibration workflows
- 864 tests passing (74.85% coverage)
- ~30,000 lines of TypeScript

**MCP Tools:**
- API: connect, disconnect, list_measurements, get_measurement, get_impulse_response
- Audio: play, stop, get_status
- Generator: start, stop
- SPL Meter: start, stop, get
- Measurement: measure, measure_sweep
- Calibration: check_levels, calibrate_spl, measurement_session
- Analysis: parse_text, analyze_room, optimize_room

**MCP Prompts:**
- rew_calibration_full — Complete calibration workflow
- rew_gain_staging — Standalone level calibration
- rew_measurement_workflow — Session-aware L/R/Sub sequence
- rew_optimization_workflow — Iterative placement optimization

## Requirements

### Validated

- ✓ MCP server starts and registers all tools correctly — v1.0
- ✓ Claude can discover and call tools via MCP protocol — v1.0
- ✓ REW API connection works (connect, verify, disconnect) — v1.0
- ✓ Measurement listing returns actual data from REW — v1.0
- ✓ Single measurement retrieval works (frequency response + impulse response) — v1.0
- ✓ Analysis tools produce valid output with real REW data — v1.0
- ✓ API error handling returns useful information (typed errors) — v1.0
- ✓ Guided mic preamp gain staging using SPL meter + test signal — v1.0
- ✓ Monitor level calibration to reference SPL — v1.0
- ✓ Systematic measurement workflow (L, R, Sub) — v1.0
- ✓ Room interpretation in plain language — v1.0
- ✓ Placement recommendations based on measurements — v1.0
- ✓ Step-by-step guided adjustment workflow — v1.0
- ✓ Validation that adjustments improved response — v1.0
- ✓ Sub integration analysis and guidance — v1.0
- ✓ GLM transparency (what it fixed, what it couldn't) — v1.0

### Active

(None — v1.0 complete, awaiting v2.0 planning)

### Out of Scope

- GLM direct integration — GLM doesn't expose an API
- Automated speaker movement — Claude suggests, human moves
- Treatment product recommendations — Credibility risk
- Multi-room support — Single room calibration for now
- Real-time monitoring during mixing — Calibration workflow only

## Context

**User's Setup:**
- Genelec 8351A (pair) — 3-way coaxial SAM monitors
- Genelec 7350A — 8" SAM subwoofer
- Room: ~12x10 feet
- GLM-managed system
- REW for measurement and analysis

**Technical Context:**
- TypeScript MCP server (~30k LOC)
- REW REST API integration (localhost:4735)
- Vitest test suite (864 tests)
- MSW for HTTP mocking, InMemoryTransport for MCP testing

## Constraints

- **REW API:** Requires REW running with `-api` flag on localhost:4735
- **GLM Limitations:** Can only cut, not boost — nulls from room modes/SBIR cannot be fixed by GLM
- **Small Room Physics:** 12x10 room will have unavoidable modal issues below 100Hz
- **Single Mic Position:** REW measures one spot; spatial variation requires multiple measurements
- **Manual Movement:** Speaker/sub placement adjustments are physical — Claude guides, human executes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Validate foundation before features | Can't build calibration workflow on untested code | ✓ Good |
| Two-milestone structure | Clean separation: working server → intelligent assistant | ✓ Good |
| REW as measurement engine | REW is industry standard, has API, user already has it | ✓ Good |
| Plain language interpretation | Users need "what's wrong and why" not just graphs | ✓ Good |
| Throw-based error handling | Type safety over null returns | ✓ Good |
| MSW for HTTP mocking | HTTP-level realism | ✓ Good |
| Zod for API validation | Forward-compatible schemas | ✓ Good |
| Map-based session storage | In-memory concurrent session isolation | ✓ Good |
| Fixability-first prioritization | Placement > settings > treatment > unfixable | ✓ Good |
| One recommendation at a time | Scientific approach | ✓ Good |
| Goal-oriented prompts | Claude orchestrates tools | ✓ Good |

---
*Last updated: 2026-01-22 after v1.0 milestone*
