# REW MCP Server

## What This Is

An MCP server that enables Claude to control Room EQ Wizard (REW) for acoustic measurement and analysis, ultimately serving as an intelligent calibration assistant for studio monitoring. The server connects to REW's REST API to take measurements, analyze room acoustics, and guide users through speaker placement and calibration — replacing the "run GLM and hope for the best" workflow with data-driven, iterative optimization.

## Core Value

Claude can autonomously measure, interpret, and guide fixes for room acoustics — turning raw frequency response data into actionable placement and treatment recommendations that actually improve mix translation.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — existing code is untested end-to-end)

### Active

**Foundation (Milestone 1):**
- [ ] MCP server starts and registers all tools correctly
- [ ] Claude can discover and call tools via MCP protocol
- [ ] REW API connection works (connect, verify, disconnect)
- [ ] Measurement listing returns actual data from REW
- [ ] Single measurement retrieval works (frequency response + impulse response)
- [ ] At least one analysis tool produces valid output with real REW data
- [ ] Critical bugs blocking basic operation are fixed
- [ ] API error handling returns useful information (not silent nulls)

**Calibration Assistant (Milestone 2):**
- [ ] Guided mic preamp gain staging using SPL meter + test signal
- [ ] Monitor level calibration to reference SPL
- [ ] Systematic measurement workflow (L, R, Sub, Combined)
- [ ] Room interpretation in plain language (not just graphs)
- [ ] Placement recommendations based on measurements and room dimensions
- [ ] Step-by-step guided adjustment workflow (measure → interpret → suggest → re-measure)
- [ ] Validation that adjustments actually improved response
- [ ] Sub integration analysis and guidance (phase, timing, level)

### Out of Scope

- GLM direct integration — GLM doesn't expose an API; we work with REW measurements of the GLM-calibrated system
- Automated speaker movement — Claude suggests, human moves
- Treatment recommendations — Focus is placement first; treatment is future scope
- Multi-room support — Single room calibration for now
- Real-time monitoring during mixing — This is calibration workflow, not continuous monitoring

## Context

**User's Setup:**
- Genelec 8351A (pair) — 3-way coaxial SAM monitors
- Genelec 7350A — 8" SAM subwoofer
- Room: ~12x10 feet (small room with predictable modal issues around 47Hz, 56Hz, 94Hz)
- GLM-managed system (calibration, crossovers, level matching)
- REW for measurement and analysis

**Current Pain:**
- GLM calibration runs but doesn't explain what it did or couldn't fix
- Mixes don't translate to treated studios
- Bass issues (modes, SBIR) and occasional harsh mids
- No visibility into what's actually happening acoustically

**Technical Context:**
- MCP server exists with 18 tools but never validated end-to-end
- REW API integration implemented but untested with real REW instance
- Analysis algorithms implemented but not verified against known-good data
- Test coverage is sparse (analysis layer tested, API/tools layer untested)

**Codebase State:**
- See `.planning/codebase/` for detailed mapping
- Key concerns: `any` types in handlers, silent API failures, no API client tests
- Analysis layer is the most solid part of the codebase

## Constraints

- **REW API:** Requires REW running with `-api` flag on localhost:4735
- **GLM Limitations:** Can only cut, not boost — nulls from room modes/SBIR cannot be fixed by GLM
- **Small Room Physics:** 12x10 room will have unavoidable modal issues below 100Hz
- **Single Mic Position:** REW measures one spot; spatial variation requires multiple measurements
- **Manual Movement:** Speaker/sub placement adjustments are physical — Claude guides, human executes

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Validate foundation before features | Can't build calibration workflow on untested code | — Pending |
| Two-milestone structure | Clean separation: working server → intelligent assistant | — Pending |
| REW as measurement engine | REW is industry standard, has API, user already has it | — Pending |
| Plain language interpretation | Users need "what's wrong and why" not just graphs | — Pending |

---
*Last updated: 2026-01-21 after initialization*
