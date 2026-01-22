# Roadmap: REW MCP Server

## Overview

Transform an untested MCP server with 18 tools into a validated, intelligent acoustic calibration assistant. Milestone 1 validates the foundation through comprehensive testing and error handling. Milestone 2 builds the calibration assistant layer with guided workflows, session management, GLM transparency, and optimization guidance.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core API + MCP Validation** - Validate server works with real REW
- [x] **Phase 2: Testing Infrastructure** - Comprehensive test coverage and robustness
- [x] **Phase 3: Calibration Setup Tools** - Gain staging and level calibration
- [x] **Phase 4: Measurement Workflow + Sessions** - Systematic measurement with session state
- [x] **Phase 5: Analysis & Interpretation** - Plain language room analysis
- [x] **Phase 6: GLM Transparency Layer** - Explain what GLM did/couldn't fix
- [x] **Phase 7: Optimization Guidance** - Placement and validation recommendations
- [ ] **Phase 8: Workflow Orchestration** - Prompts and resources for guided workflows

## Phase Details

### Phase 1: Core API + MCP Validation
**Goal**: Server starts, connects to REW, and core tools work with real data
**Depends on**: Nothing (first phase)
**Requirements**: FNDN-01, FNDN-02, FNDN-03, FNDN-04, FNDN-05, FNDN-06, FNDN-07, FNDN-08, FNDN-09
**Success Criteria** (what must be TRUE):
  1. MCP server registers all 18 tools without declaring unused capabilities
  2. REW API connection succeeds when REW is running and fails with typed error when unavailable
  3. Measurement listing and retrieval return actual data from REW instance
  4. At least one analysis tool processes real REW data without silent failures
  5. All API errors propagate as structured errors (no null returns)
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Refactor API client error handling (null returns to typed errors)
- [x] 01-02-PLAN.md — API client integration tests with MSW (core methods + FNDN-07)
- [x] 01-03-PLAN.md — MCP end-to-end integration tests (FNDN-08 analysis tools)
- [x] 01-04-PLAN.md — Base64 data format validation tests

**Notes:**
- Addresses research pitfall: Silent API failures (highest risk)
- Addresses research pitfall: MCP specification violation (unused capabilities)
- Uses MSW for HTTP-level mocking (research recommendation)

### Phase 2: Testing Infrastructure
**Goal**: Comprehensive test coverage with integration tests and parser robustness
**Depends on**: Phase 1
**Requirements**: FNDN-10, FNDN-11, FNDN-12, FNDN-13, FNDN-14
**Success Criteria** (what must be TRUE):
  1. Integration test suite exists using MSW for REW API and InMemoryTransport for MCP
  2. Test coverage meets targets: API client 80%+, tool handlers 70%+
  3. Parser handles European decimal format (comma separators) correctly
  4. No explicit `any` types remain in tool handlers (replaced with Zod validation)
  5. CI runs integration tests and reports coverage
**Plans:** 5 plans (3 original + 2 gap closure)

Plans:
- [x] 02-01-PLAN.md — Configure coverage thresholds and European decimal tests
- [x] 02-02-PLAN.md — Replace any types with Zod schemas (FNDN-13, FNDN-14)
- [x] 02-03-PLAN.md — Extend test coverage to 80%/70% targets
- [x] 02-04-PLAN.md — [GAP CLOSURE] Unit tests for api-audio and api-generator tools
- [x] 02-05-PLAN.md — [GAP CLOSURE] Unit tests for api-measure, api-spl-meter, api-measure-workflow tools

**Notes:**
- Addresses research pitfall: Type erasure via `any` types
- FNDN-10 and FNDN-11 partially satisfied by Phase 1 (extends coverage, not rebuilds)
- Implements Zod validation for all REW API responses (research recommendation)
- Gap closure plans added after verification found tool handlers at 25.12% (target: 70%)

### Phase 3: Calibration Setup Tools
**Goal**: Users can calibrate mic gain and monitor levels before measurement
**Depends on**: Phase 2
**Requirements**: SETV-01, SETV-02, SETV-03, SETV-04, SETV-05, SETV-06
**Success Criteria** (what must be TRUE):
  1. User can check REW input level and detect clipping/low signal conditions
  2. User receives clear mic gain adjustment guidance based on measured level
  3. User can calibrate monitor level to target SPL (79-85 dB)
  4. System verifies target SPL achieved within tolerance
**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Extend REWApiClient with input level monitoring methods
- [x] 03-02-PLAN.md — Create api-check-levels MCP tool (SETV-01 through SETV-04)
- [x] 03-03-PLAN.md — Create api-calibrate-spl MCP tool (SETV-05, SETV-06)
- [x] 03-04-PLAN.md — Unit tests for Phase 3 calibration tools

**Notes:**
- Table stakes feature from research (prevents invalid measurements)
- Foundation for measurement workflow (Phase 4 dependency)
- Level zones: Clipping (>-3 dBFS), Hot (-3 to -10), Optimal (-10 to -20), Low (-20 to -40), Very Low (<-40)
- Default SPL target: 85 dB with +/-1 dB tolerance

### Phase 4: Measurement Workflow + Sessions
**Goal**: Systematic L/R/Sub measurement sequence with session state persistence
**Depends on**: Phase 3
**Requirements**: MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06, MEAS-07
**Success Criteria** (what must be TRUE):
  1. User can trigger measurements via REW API or receive clear manual guidance
  2. System guides user through L/R/Sub measurement sequence with automatic naming
  3. Measurements are organized by session with unique session IDs
  4. Session state persists across tool calls and can resume after disconnect
  5. Multiple concurrent sessions are supported without cross-contamination
**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md — Session state management module (Map-based storage, CRUD operations)
- [x] 04-02-PLAN.md — L/R/Sub sequence state machine (transition validation, guidance)
- [x] 04-03-PLAN.md — Measurement session MCP tool (start/measure/status/stop actions)
- [x] 04-04-PLAN.md — Unit tests for Phase 4 session and tool modules

**Notes:**
- Implements explicit session management (research recommendation)
- REW Pro license required for automated measurements (403 detection implemented)
- Foundation for workflow prompts (Phase 8 dependency)
- Uses crypto.randomUUID() for session IDs (native Node.js, no dependencies)
- State machine enforces L/R/Sub ordering (prevents out-of-sequence measurements)

### Phase 5: Analysis & Interpretation
**Goal**: Plain language room analysis with prioritized recommendations
**Depends on**: Phase 4
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04, ANLZ-05, ANLZ-06, ANLZ-07, ANLZ-08
**Success Criteria** (what must be TRUE):
  1. System identifies room modes with frequency, severity, and room dimension correlation
  2. L/R symmetry analysis shows deviation percentage with plain language interpretation
  3. Sub integration analysis detects phase issues, level mismatches, and timing problems
  4. SBIR detection explains position-based causes
  5. Problem prioritization tells user what to fix first
**Plans:** 4 plans

Plans:
- [x] 05-01-PLAN.md — Interpretation core types and prioritization engine
- [x] 05-02-PLAN.md — Room modes and peaks/nulls interpretation with SBIR classification
- [x] 05-03-PLAN.md — Sub integration and L/R symmetry interpretation
- [x] 05-04-PLAN.md — Unified room analysis tool and unit tests

**Notes:**
- Core LLM value: Plain language interpretation (differentiator)
- Analysis layer is most solid part of codebase (research finding)
- Fixability-first prioritization: placement > settings > treatment > unfixable
- SBIR classification: 60-300 Hz, Q>5, 1-4 ft boundary distance

### Phase 6: GLM Transparency Layer
**Goal**: Users understand what GLM calibration did and couldn't fix
**Depends on**: Phase 5
**Requirements**: GLM-01, GLM-02, GLM-03, GLM-04, GLM-05
**Success Criteria** (what must be TRUE):
  1. System interprets GLM calibration results vs pre-calibration baseline
  2. User sees what GLM successfully corrected (peaks, mild dips)
  3. User sees what GLM couldn't fix (deep nulls, SBIR) with physics explanation
  4. System explains why GLM can only cut, not boost
  5. System detects potential GLM overcorrection artifacts
**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md — GLM comparison module with proportional thresholds and post-only heuristics
- [x] 06-02-PLAN.md — Integrate GLM comparison into analyze-room tool
- [x] 06-03-PLAN.md — Unit tests for GLM comparison and integration

**Notes:**
- Primary differentiator (research: unique value no competitor offers)
- Addresses research pitfall: Misinterpreting GLM's nulls as failures
- GLM context already documented in /docs/glm-context.md
- Proportional thresholds: 50%+ reduction = success (per CONTEXT.md)
- Context-dependent unchanged thresholds: <1/2/3 dB by issue size
- Overcorrection detection: bass flatness <2 dB variance below 40 Hz

### Phase 7: Optimization Guidance
**Goal**: Data-driven placement recommendations with validation
**Depends on**: Phase 6
**Requirements**: OPTM-01, OPTM-02, OPTM-03, OPTM-04, OPTM-05, OPTM-06
**Success Criteria** (what must be TRUE):
  1. System provides placement recommendations for monitors based on measurements
  2. System provides sub position optimization suggestions
  3. System suggests listening position adjustments when appropriate
  4. Pre/post comparison quantifies improvement after adjustments
  5. System validates that adjustments actually improved response
  6. Success criteria evaluation shows progress toward target (+-3dB 40-200Hz)
**Plans:** 4 plans

Plans:
- [x] 07-01-PLAN.md — Recommendation generation module (monitors, sub, listening position)
- [x] 07-02-PLAN.md — Validation module (pre/post comparison, success criteria)
- [x] 07-03-PLAN.md — MCP optimization tool (rew.optimize_room with 3 actions)
- [x] 07-04-PLAN.md — Unit tests for Phase 7 optimization modules

**Notes:**
- Competitive differentiator (research: data-driven position adjustments)
- One recommendation at a time (scientific approach per CONTEXT.md)
- Directional guidance only (not exact distances)
- Sub gets more detailed recommendations (phase, corner loading, crossover)
- Zone-based progress: good (<=3dB), acceptable (<=5dB), needs_work (>5dB)
- Worsened adjustments suggest "try opposite direction"

### Phase 8: Workflow Orchestration
**Goal**: Guided step-by-step calibration via MCP Prompts and Resources
**Depends on**: Phase 7
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04, WKFL-05, WKFL-06, WKFL-07
**Success Criteria** (what must be TRUE):
  1. Calibration workflow prompts are available for full session, gain staging, and level calibration
  2. Systematic measurement workflow prompt guides complete L/R/Sub sequence
  3. Session state is exposed as MCP resource for progress checking
  4. Measurement history is exposed as MCP resource for comparison
  5. Session recommendations is exposed as MCP resource for review
**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md — MCP Resources infrastructure (session, measurement, recommendations, history)
- [ ] 08-02-PLAN.md — MCP Prompts for calibration workflows (full, gain staging, measurement, optimization)
- [ ] 08-03-PLAN.md — Unit tests for resources and prompts modules

**Notes:**
- Implements MCP Prompt-orchestrated tool composition (research recommendation)
- Resources enable stateful protocol with stateless tools (architecture pattern)
- Foundation for iterative measure -> interpret -> suggest -> re-measure loop
- Goal-oriented prompts (describe objectives, Claude orchestrates tools)
- URI schemes: session://, measurement://, recommendations://, history://

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core API + MCP Validation | 4/4 | Complete | 2026-01-21 |
| 2. Testing Infrastructure | 5/5 | Complete | 2026-01-21 |
| 3. Calibration Setup Tools | 4/4 | Complete | 2026-01-21 |
| 4. Measurement Workflow + Sessions | 4/4 | Complete | 2026-01-21 |
| 5. Analysis & Interpretation | 4/4 | Complete | 2026-01-22 |
| 6. GLM Transparency Layer | 3/3 | Complete | 2026-01-22 |
| 7. Optimization Guidance | 4/4 | Complete | 2026-01-22 |
| 8. Workflow Orchestration | 0/3 | Not started | - |

---
*Created: 2026-01-21*
*Last updated: 2026-01-22 (Phase 8 planned)*
