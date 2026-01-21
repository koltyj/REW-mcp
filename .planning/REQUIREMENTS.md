# Requirements: REW MCP Server

**Defined:** 2026-01-21
**Core Value:** Claude can autonomously measure, interpret, and guide fixes for room acoustics — turning raw frequency response data into actionable placement and treatment recommendations.

## v1 Requirements

### Foundation (Milestone 1)

Server must actually work with REW before building calibration features.

- [ ] **FNDN-01**: MCP server starts and registers all declared tools
- [ ] **FNDN-02**: MCP server does not declare unused capabilities (resources, prompts)
- [ ] **FNDN-03**: REW API connection succeeds when REW is running with -api flag
- [ ] **FNDN-04**: REW API connection failure returns typed error (not null/silent)
- [ ] **FNDN-05**: Measurement listing returns actual data from REW instance
- [ ] **FNDN-06**: Single measurement retrieval returns frequency response data
- [ ] **FNDN-07**: Single measurement retrieval returns impulse response data
- [ ] **FNDN-08**: Analysis tools produce valid output with real REW data
- [ ] **FNDN-09**: API errors propagate as structured errors (not silent nulls)
- [ ] **FNDN-10**: Integration test suite exists using MSW for HTTP mocking
- [ ] **FNDN-11**: Integration test suite exists using InMemoryTransport for MCP
- [ ] **FNDN-12**: Parser handles European decimal format (comma separator)
- [ ] **FNDN-13**: No explicit `any` types in tool handlers
- [ ] **FNDN-14**: Zod validation on all REW API responses

### Calibration Setup (Milestone 2)

Guided mic and monitor setup before measurement.

- [ ] **SETV-01**: Check REW input level (RMS and peak dBFS)
- [ ] **SETV-02**: Detect input clipping condition (> -3 dBFS peak)
- [ ] **SETV-03**: Detect low signal condition (< -40 dBFS RMS)
- [ ] **SETV-04**: Provide mic gain adjustment guidance based on level
- [ ] **SETV-05**: Target monitor level calibration (79-85 dB SPL)
- [ ] **SETV-06**: Verify target SPL achieved within tolerance

### Measurement Workflow (Milestone 2)

Systematic measurement sequence with organization.

- [ ] **MEAS-01**: Trigger measurement via REW API (or guide manual trigger)
- [ ] **MEAS-02**: Guided L/R/Sub measurement sequence
- [ ] **MEAS-03**: Measurement naming convention applied automatically
- [ ] **MEAS-04**: Organize measurements by session/condition
- [ ] **MEAS-05**: Session state persists across tool calls
- [ ] **MEAS-06**: Session can be resumed after disconnect
- [ ] **MEAS-07**: Multiple concurrent sessions supported

### Analysis & Interpretation (Milestone 2)

Plain language room analysis.

- [ ] **ANLZ-01**: Room mode identification with frequency and severity
- [ ] **ANLZ-02**: Room mode correlation with room dimensions (if provided)
- [ ] **ANLZ-03**: L/R symmetry analysis with deviation percentage
- [ ] **ANLZ-04**: Sub integration analysis (phase, level, timing)
- [ ] **ANLZ-05**: Detect sub phase inversion (near 180 degrees at crossover)
- [ ] **ANLZ-06**: Plain language interpretation of frequency response issues
- [ ] **ANLZ-07**: Problem prioritization (what to fix first)
- [ ] **ANLZ-08**: SBIR detection with position-based explanation

### GLM Transparency (Milestone 2)

Explain what GLM did and couldn't do.

- [ ] **GLM-01**: Interpret GLM calibration results vs pre-calibration baseline
- [ ] **GLM-02**: Identify what GLM successfully corrected
- [ ] **GLM-03**: Identify issues GLM couldn't fix (deep nulls, SBIR)
- [ ] **GLM-04**: Explain why GLM can cut but not boost (physics limitation)
- [ ] **GLM-05**: Detect potential GLM overcorrection artifacts

### Optimization Guidance (Milestone 2)

Actionable recommendations for improvement.

- [ ] **OPTM-01**: Placement recommendations based on measurements
- [ ] **OPTM-02**: Sub position optimization suggestions
- [ ] **OPTM-03**: Listening position adjustment recommendations
- [ ] **OPTM-04**: Pre/post comparison showing improvement quantification
- [ ] **OPTM-05**: Validation that adjustments actually improved response
- [ ] **OPTM-06**: Success criteria evaluation (target: +-3dB 40-200Hz)

### Workflow Orchestration (Milestone 2)

Guided step-by-step calibration workflow.

- [ ] **WKFL-01**: Calibration session prompt template available
- [ ] **WKFL-02**: Gain staging workflow prompt available
- [ ] **WKFL-03**: Level calibration workflow prompt available
- [ ] **WKFL-04**: Systematic measurement workflow prompt available
- [ ] **WKFL-05**: Session state exposed as MCP resource
- [ ] **WKFL-06**: Measurement history exposed as MCP resource
- [ ] **WKFL-07**: Session recommendations exposed as MCP resource

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Analysis

- **ADVN-01**: Multi-position measurement guidance (spatial averaging)
- **ADVN-02**: Harmonic room mode coupling detection
- **ADVN-03**: Early reflection detection from impulse response
- **ADVN-04**: Reflection source identification (surface, distance)
- **ADVN-05**: Decay time interpretation (ringing/resonance)
- **ADVN-06**: Schroeder frequency context for small rooms
- **ADVN-07**: Mix translation prediction based on deviation

### Enhanced Workflow

- **EHNC-01**: Treatment category suggestions (not product recommendations)
- **EHNC-02**: Room dimension input via elicitation
- **EHNC-03**: Spatial averaging across multiple positions
- **EHNC-04**: Express mode for experienced users
- **EHNC-05**: Batch comparison across sessions
- **EHNC-06**: Historical session comparison

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automated speaker movement | Physical impossibility, safety liability |
| Automatic EQ application | GLM already does this; duplication + conflict risk |
| Treatment product recommendations | Credibility risk, affiliate marketing appearance |
| Multi-room management | Scope creep for rare use case |
| Real-time mixing monitoring | Different problem domain |
| Microphone calibration file generation | Requires anechoic chamber |
| Room simulation/modeling | Complex physics, rarely accurate for small rooms |
| GLM replacement | This tool interprets GLM, doesn't replace it |
| Continuous re-calibration | Calibration is occasional setup, not continuous |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDN-01 | Phase 1 | Complete |
| FNDN-02 | Phase 1 | Complete |
| FNDN-03 | Phase 1 | Complete |
| FNDN-04 | Phase 1 | Complete |
| FNDN-05 | Phase 1 | Complete |
| FNDN-06 | Phase 1 | Complete |
| FNDN-07 | Phase 1 | Complete |
| FNDN-08 | Phase 1 | Complete |
| FNDN-09 | Phase 1 | Complete |
| FNDN-10 | Phase 2 | Complete |
| FNDN-11 | Phase 2 | Complete |
| FNDN-12 | Phase 2 | Complete |
| FNDN-13 | Phase 2 | Complete |
| FNDN-14 | Phase 2 | Complete |
| SETV-01 | Phase 3 | Pending |
| SETV-02 | Phase 3 | Pending |
| SETV-03 | Phase 3 | Pending |
| SETV-04 | Phase 3 | Pending |
| SETV-05 | Phase 3 | Pending |
| SETV-06 | Phase 3 | Pending |
| MEAS-01 | Phase 4 | Pending |
| MEAS-02 | Phase 4 | Pending |
| MEAS-03 | Phase 4 | Pending |
| MEAS-04 | Phase 4 | Pending |
| MEAS-05 | Phase 4 | Pending |
| MEAS-06 | Phase 4 | Pending |
| MEAS-07 | Phase 4 | Pending |
| ANLZ-01 | Phase 5 | Pending |
| ANLZ-02 | Phase 5 | Pending |
| ANLZ-03 | Phase 5 | Pending |
| ANLZ-04 | Phase 5 | Pending |
| ANLZ-05 | Phase 5 | Pending |
| ANLZ-06 | Phase 5 | Pending |
| ANLZ-07 | Phase 5 | Pending |
| ANLZ-08 | Phase 5 | Pending |
| GLM-01 | Phase 6 | Pending |
| GLM-02 | Phase 6 | Pending |
| GLM-03 | Phase 6 | Pending |
| GLM-04 | Phase 6 | Pending |
| GLM-05 | Phase 6 | Pending |
| OPTM-01 | Phase 7 | Pending |
| OPTM-02 | Phase 7 | Pending |
| OPTM-03 | Phase 7 | Pending |
| OPTM-04 | Phase 7 | Pending |
| OPTM-05 | Phase 7 | Pending |
| OPTM-06 | Phase 7 | Pending |
| WKFL-01 | Phase 8 | Pending |
| WKFL-02 | Phase 8 | Pending |
| WKFL-03 | Phase 8 | Pending |
| WKFL-04 | Phase 8 | Pending |
| WKFL-05 | Phase 8 | Pending |
| WKFL-06 | Phase 8 | Pending |
| WKFL-07 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-21 after research synthesis*
