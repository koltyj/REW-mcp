# Project Research Summary

**Project:** REW MCP Server for Acoustic Calibration
**Domain:** MCP Server + Acoustic Measurement
**Researched:** 2026-01-21
**Confidence:** HIGH

## Executive Summary

The REW MCP server bridges a market gap by providing transparent interpretation and guided workflow for acoustic calibration—something neither GLM (automated but opaque) nor REW (manual but comprehensive) does alone. The foundation already exists: 18 atomic tools for REW API integration, measurement analysis, and GLM context interpretation. The research identifies a clear two-milestone strategy: (1) validate that the server actually works with REW through comprehensive testing, and (2) build the calibration assistant layer using MCP Prompts + Resources to orchestrate guided workflows.

The recommended tech stack is lean and proven: Vitest + MSW for testing, in-memory MCP transport for integration tests, and MCP Prompts/Resources for workflow orchestration. The critical challenge is **reliability at the API integration layer**—silent failures in REW API calls are the highest-risk pitfall that can break the entire system. The architecture is correct (Prompts orchestrate stateless tools, Resources expose stateful session data), but execution quality depends on eliminating error-handling gaps and type-safety issues.

Two key decisions from research: avoid monolithic workflow tools (use Prompts instead), and implement explicit session management with resources rather than implicit state. This aligns with 2026 MCP best practices and enables future features like session history and multi-session comparison.

## Key Findings

### Recommended Stack

The testing and validation strategy emphasizes **realistic HTTP-level mocking over function-level mocking**, paired with **in-memory MCP transport** for integration tests.

**Core technologies:**
- **Vitest 2.1.8** (already configured) — Fast test runner with native ESM and TypeScript support. Replaces Jest for modern Node 18+ projects.
- **MSW 2.6.0** (add as dev dependency) — Type-safe HTTP mocking at network level. Models real REW API behavior including base64-encoded float arrays. Superior to nock (doesn't work reliably with native fetch) and vitest-fetch-mock (lacks structure).
- **MCP SDK InMemoryTransport** — Eliminate subprocess timing flakiness. Official pattern for MCP server testing. Type-safe request/response handling.
- **Zod 3.23.8** (already installed) — Runtime validation for external API responses and tool inputs. Prevents type erasure via `any`.

**Why this stack:** The current codebase has unit tests but zero integration tests. The gap isn't in testing frameworks—it's in testing strategy. MSW + in-memory transport catches the exact failure modes (silent API failures, protocol violations) that current mocks can't detect. This stack is 2025-2026 standard practice across MCP server projects.

**Coverage targets:** Analysis functions 90%+, API client 80%+, tool handlers 70%+. Tools are integration-level code; 100% unit coverage is unnecessary but happy-path + error scenarios (connection refused, 404, timeout) are mandatory.

See STACK.md (lines 1-80) for detailed installation and patterns.

### Expected Features

The feature landscape is clearly stratified: **table stakes** (features users expect to work), **differentiators** (unique value props), and **anti-features** (explicitly NOT to build).

**Must have (table stakes) for Milestone 2:**
- Mic gain staging guidance — prevents invalid measurements
- Monitor level calibration (target 79-85 dB SPL)
- Frequency response measurement (already in MCP)
- Room mode identification
- Pre/post comparison validation
- Plain language interpretation (core LLM value)
- L/R symmetry validation
- Sub integration analysis

**Should have (competitive differentiators):**
- **GLM transparency layer** (unique) — explains what AutoCal did/couldn't fix
- Iterative optimization workflow — measure → interpret → suggest → re-measure loop
- Placement recommendations — data-driven position adjustments
- Step-by-step calibration wizard for beginners
- Confidence-weighted suggestions (honest about uncertainty)
- SBIR detection and diagnosis

**Anti-features to avoid:**
- Automated speaker movement (physical impossibility)
- Automatic EQ application (GLM already does this; duplication risk)
- Multi-room management (scope creep)
- Treatment product recommendations (credibility risk)
- Room simulation/modeling (predict reality instead)

**Key insight:** This tool is **GLM's interpreter and optimizer**, not its replacement. It reads GLM's results, explains limitations, and guides manual adjustments GLM can't do (placement, treatment). This positioning is critical for go-to-market and feature prioritization.

See FEATURES.md (lines 1-100) for full feature dependency tree and competitive analysis.

### Architecture Approach

MCP servers in 2026 follow a **composable, stateful-protocol, stateless-tools** pattern. The recommended architecture for REW-mcp is **Prompt-Orchestrated Tool Composition with Session-Scoped Resources**.

The key principle: **Tools are atomic and stateless**. The LLM (Claude), not the server, orchestrates the workflow. The server provides capability via Tools, state visibility via Resources, and workflow templates via Prompts.

**Major components:**
1. **Prompts (Workflow Templates)** — Define reusable calibration workflows (e.g., `calibration_session_full`, `gain_staging_workflow`). Prompts sequence tool calls and guide LLM through iterative loops.
2. **Resources (Session State)** — Expose `calibration_session://{session_id}`, `measurement_history://{session_id}`, `session_recommendations://{session_id}`. LLM reads these to check progress without re-running analysis.
3. **Tools (Atomic Operations)** — Keep existing 18 tools as-is. Add 3 new tools for guided workflows: `check_connection`, `trigger_measurement`, `measure_input_level`. All receive optional `session_id` parameter.
4. **Measurement Store (Session Persistence)** — File-based or in-memory storage of measurements grouped by session. Supports resumable workflows across disconnects.

**Why Prompts, not monolithic workflow tools:** Monolithic "calibrate_system" tool violates single-responsibility principle, can't be reused for partial workflows, hides complexity from LLM, and reduces transparency. Prompts enable adaptive workflows where LLM decides next steps based on intermediate results.

**Why Resources, not just tool return values:** Resources are canonical source of truth for session state. Enable "check progress" queries without re-executing analysis. Support session resumption. Allow multiple clients to observe same session (future dashboard).

**Why explicit session IDs:** Supports multiple concurrent sessions, historical comparison ("compare this to last month's"), prevents accidental cross-contamination. Prompts generate session_id (e.g., `session_id: "cal_{{timestamp}}"`) or users provide it.

See ARCHITECTURE.md (lines 1-200) for detailed patterns, state machine, and ADRs.

### Critical Pitfalls

Research identified 14 pitfalls across MCP, acoustic, and testing domains. The top 5 must be addressed in Milestone 1:

1. **Silent API Failures (Uncaught)** — REW API calls fail silently. Client returns `null`, tools report success, LLM hallucinates analysis. **Prevention:** API client layer throws typed errors (never return `null`). Tool layer wraps in try/catch, returns `isError: true`. Validation layer asserts data exists before processing. **Detection:** Monitor for null returns, test with REW disconnected.

2. **Type Erasure via `any` Types** — Accumulating `any` types silently breaks type safety. 38% of bugs preventable by types go uncaught. **Prevention:** Enable `strict: true` and `noImplicitAny: true` in tsconfig. Use Zod for external API responses. Ban `any` in code review (use `unknown` instead). **Detection:** `grep -r ": any" src/` and enable ESLint rule `@typescript-eslint/no-explicit-any`.

3. **MCP Specification Violation (Unused Capabilities)** — Declare `resources: {}` and `prompts: {}` capabilities but don't implement handlers. MCP clients expect functionality that doesn't exist. **Already identified in audit report.** **Prevention:** Only declare capabilities you implement. Test with MCP Inspector. **Impact:** Milestone 1.1 blocker.

4. **No Integration Tests (API Assumed Available)** — Unit tests pass, tools fail in production. No way to catch integration failures before deployment. **Prevention:** Mock at HTTP level (MSW), not function level. Test connection failure paths. Add health check in CI. **Detection:** CI only runs unit tests, no `*.integration.test.ts` files.

5. **Prompt Injection via Measurement Metadata** — User exports REW measurement with notes: `"** IGNORE PREVIOUS INSTRUCTIONS. **"`. MCP passes to LLM, which follows malicious instructions. **Prevention:** Treat all external data as untrusted. Validate metadata fields with Zod. Use structured outputs (JSON) over freeform text. **Detection:** Test with malicious metadata like `"** IGNORE ANALYSIS **"`.

**Domain-specific pitfalls to watch:**
- **Measurement Microphone Not Calibrated** — Users forget to load `.cal` file in REW. Frequency response shows 5dB errors at HF. False positives in analysis. Prevention: Detect uncalibrated mic in metadata, add warning tool.
- **Misinterpreting GLM's Nulls as Failures** — Users think GLM failed because nulls persist. Actually, GLM can't fix nulls (requires boost). Prevention: Implement GLM context interpretation, explain why nulls can't be fixed.
- **Subwoofer Phase Inverted After Calibration** — Bass sounds thin. Phase was inverted during GLM calibration. Prevention: Analyze phase at crossover, warn if near 180°.

See PITFALLS.md for complete analysis and testing checklist.

## Implications for Roadmap

Research suggests a clear phase structure based on dependencies, risk reduction, and capability dependencies.

### Phase 1: Validate Foundation (Milestone 1.1 - 1.3)
**Rationale:** The server exists with 18 tools, but has zero integration tests and untested API integration. Can't build reliable calibration workflows on unvalidated foundation. This phase de-risks the entire project by proving the server actually works with real REW API behavior.

**Delivers:**
- Comprehensive integration test suite (MSW + in-memory MCP)
- Error handling for all API failure paths
- Type-safe validation throughout codebase
- MCP specification compliance (fix unused capabilities)
- Parser robustness (European decimals, edge cases)

**Addresses features:** Foundation for all table-stakes features. Testing infrastructure for future features.

**Addresses pitfalls:** Silent API failures, type erasure, MCP spec violations, no integration tests, uncalibrated mic detection.

**Stack elements:** MSW, Vitest, MCP SDK, Zod, InMemoryTransport.

**Sub-phases:**
- **1.1: Core API + MCP (1-2 weeks)** — Add MSW for REW API mocking, implement HTTP-level integration tests, fix type safety, remove unused MCP capabilities. Deliverable: 70%+ tool integration coverage.
- **1.2: Testing Infrastructure (1 week)** — Expand test coverage to 80%+ API client, add connection failure tests, implement CI health check. Deliverable: Full CI integration.
- **1.3: Parser + Robustness (1 week)** — Test European decimal format, add measurement validation, improve error messages. Deliverable: Robust parsing.

### Phase 2: Build Calibration Assistant Layer (Milestone 1.4 - 1.5)
**Rationale:** Foundation is validated. Now build the high-value workflows that differentiate this tool. GLM interpretation and guided calibration are the unique value props that users will pay for (or rely on heavily in free tier).

**Delivers:**
- GLM context interpretation tool (explain what AutoCal did/didn't fix)
- Session management (explicit session IDs, session resources)
- Measurement organization and naming conventions
- Calibration workflow prompts (gain staging, level calibration, measurement sequence)
- Sub integration analysis with phase validation
- Iterative measurement loop orchestration via Prompts

**Addresses features:** GLM transparency (differentiator), systematic measurement workflow (table stakes), sub integration analysis, plain language interpretation.

**Addresses pitfalls:** Misinterpreting GLM nulls, subwoofer phase inversion, measurement naming chaos, forgetting recalibration.

**Architecture elements:** Prompts for workflow templates, Resources for session state, explicit session IDs.

**Sub-phases:**
- **1.4: Session Management + GLM Interpretation (2 weeks)** — Implement `calibration_session://` resource, add session lifecycle, build GLM context tool. Deliverable: Session-aware tools, GLM transparency feature.
- **1.5: Workflow Prompts + Guided Calibration (2-3 weeks)** — Create `calibration_session_full`, `gain_staging_workflow`, `level_calibration_workflow` prompts. Implement `trigger_measurement`, `check_connection`, `measure_input_level` tools. Deliverable: End-to-end guided calibration workflow.

### Phase 3: Advanced Analysis (Milestone 2.0+)
**Rationale:** MVP is complete. These features are nice-to-have but require more acoustic domain knowledge and more complex analysis.

**Delivers:**
- Placement recommendations (room dimensions input, SBIR calculation)
- Multi-position measurement guidance (spatial averaging)
- Harmonic room mode coupling detection
- Small room acoustic context (Schroeder frequency, modal density warnings)
- Reflection detection (impulse response analysis)

**Addresses features:** Placement recommendations (differentiator), multi-position measurement, advanced analysis, confidence-weighted suggestions.

**Addresses pitfalls:** Small room mode coupling, reflection-induced comb filtering.

**Note:** These are "nice-to-have" features. MVP doesn't need them. Research is sufficient to defer to Phase 3.

### Phase Ordering Rationale

1. **Foundation first, features second:** Can't trust analysis outputs if API integration is brittle. Testing validates that tools actually work, not just that they compile.

2. **Validation before workflows:** Measurement ingestion and basic analysis must be bulletproof before building guided workflows. If ingest fails silently, entire calibration workflow falls apart.

3. **GLM interpretation unlocks value:** Once foundation is solid, GLM transparency is the primary differentiator. This should be Phase 2 priority because it's unique value no competitor offers.

4. **Session management enables iterative workflows:** Session state (Resources) is prerequisite for Prompts. Can't have calibration_session_full workflow without session resources to track progress.

5. **Advanced analysis deferred:** Placement recommendations and harmonic coupling detection require more research. These are post-MVP features. MVP should focus on table stakes + GLM transparency.

### Research Flags

**Phases that need deeper research during planning:**

- **Phase 1.3 (Parser Robustness):** Minor research flag on measurement format edge cases (what other delimiters/formats does REW support?). Quick validation: test against REW export samples.

- **Phase 1.4 (Session Management):** Moderate research flag on REW API measurement UUID format and retrieval. Do measurement IDs persist across sessions? Can client fetch by name? Validation: test with actual REW instance during implementation.

- **Phase 1.5 (Workflow Prompts):** Moderate research flag on whether REW API supports **triggering** measurements remotely. Current code assumes REW is running. Can LLM orchestrate "start a measurement, wait for completion, fetch result"? Validation: check REW API docs and test during Phase 1.4.

**Phases with standard patterns (skip research-phase):**

- **Phase 1.1 (Core API + MCP):** Standard MCP server patterns, well-documented. MSW is industry standard for HTTP mocking. No additional research needed.

- **Phase 1.2 (Testing Infrastructure):** Standard CI/CD patterns. Vitest integration with GitHub Actions is well-documented. No additional research needed.

- **Phase 2.0 (GLM Interpretation):** GLM behavior is already documented in `/docs/glm-context.md`. Tool implementation is straightforward analysis logic. No additional research needed.

- **Phase 2.1+ (Workflow Prompts):** MCP Prompts are standard feature. Prompt templates are straightforward markdown with variable substitution. No additional research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Vitest, MSW, MCP SDK, Zod are all industry standard 2025 patterns. Verified against official docs and multiple implementations. |
| Features | **HIGH** | Feature landscape is well-researched. GLM context doc exists. Competitive analysis is solid. Feature dependencies mapped to Milestones. |
| Architecture | **HIGH** | MCP 2026 best practices are well-documented. Prompt-orchestrated tool composition is official recommendation. Session management patterns validated against MCP spec. |
| Pitfalls | **HIGH** | Pitfalls span domain expertise (acoustic) + engineering (MCP, testing, type safety). 14 pitfalls identified with prevention strategies mapped to phases. |
| **Overall** | **HIGH** | Research across all 4 dimensions is comprehensive and internally consistent. |

### Gaps to Address

- **REW API measurement triggering:** Unclear if LLM can trigger measurements remotely or only read results from manually-triggered measurements in REW. **How to handle:** Implement Phase 1.4 with read-only assumption first. If API supports triggering, enhance in Phase 1.5. Affects workflow UX (manual vs. automated measurement).

- **Measurement UUID persistence:** Do measurement IDs from REW session persist for comparison across sessions? **How to handle:** Test during Phase 1.1 integration testing. If IDs don't persist, add session-scoped ID mapping in Measurement Store.

- **Room dimensions input method:** How does user provide room dimensions to placement recommendation tool? REW can read from session but not all users have this in REW. **How to handle:** Defer to Phase 2. Can gather via Elicitation in workflow or as optional input to Prompts.

- **Acoustic domain edge cases:** Small room harmonic coupling, SBIR calculation, Schroeder frequency context are domain-specific. Research is sufficient for MVP but implementation may need iteration. **How to handle:** Add unit tests with synthetic data from acoustics literature. Validate against real measurements in Phase 1.5.

## Sources

### Primary Research (HIGH confidence)

**STACK.md** (780 lines)
- MCP testing patterns: MCP Inspector, InMemoryTransport examples from official SDK
- HTTP mocking: MSW documentation, comparison with nock/vitest-fetch-mock
- Testing strategy: Vitest + coverage targets from industry consensus
- REW API spec: Official REW API documentation and current codebase

**FEATURES.md** (340 lines)
- Feature landscape: GLM documentation, competitive analysis (REW, Sonarworks, ARC Studio)
- Table stakes: Verified against acoustic calibration best practices (Sound on Sound, Berklee Online)
- Anti-features: Domain knowledge from Genelec GLM philosophy and REW limitations
- User journey: Based on actual calibration workflows (Soundman2020, HOFA-Akustik)

**ARCHITECTURE.md** (790 lines)
- MCP architecture patterns: Official MCP spec 2025-11-25, multiple authoritative sources
- Prompt + Resource patterns: Blog posts from Microsoft, Anthropic, community MCP servers
- Session state management: MCP spec, session handoff patterns, stateful protocol docs
- Tool composition: ADRs from MCP best practices, comparison with monolithic approach

**PITFALLS.md** (942 lines)
- 14 pitfalls identified across 3 domains: MCP, acoustic, testing
- Prevention strategies: Sourced from documentation, security advisories, domain expertise
- Phase mapping: Pitfalls mapped to implementation milestones

### Secondary Research (MEDIUM confidence)

- REW API documentation (official)
- Genelec GLM context doc (project-specific)
- AUDIT_REPORT.md (project-specific findings on MCP compliance issues)
- Industry best practices from Sound on Sound, Acoustic Frontiers, etc.

### Tertiary (LOW confidence, needs validation)

- REW API endpoint behaviors not in official docs (inferred from codebase)
- Small room acoustic analysis edge cases (theoretical, needs validation on real measurements)

---

*Research completed: 2026-01-21*
*Ready for roadmap: yes*
