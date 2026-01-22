# Phase 8: Workflow Orchestration - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Guided step-by-step calibration via MCP Prompts and Resources. Exposes workflow orchestration that ties together the tools built in Phases 1-7. Users can invoke calibration workflows through MCP prompts, and session state is accessible through MCP resources.

</domain>

<decisions>
## Implementation Decisions

### Prompt Structure
- Goal-oriented prompts (describe objectives and context, Claude orchestrates tool sequence)
- Follow GSD principles: context sufficient for execution, not excessive
- Pause only for decisions and physical actions that require human intervention
- Autonomous execution between checkpoints

### Resource Exposure
- Read-only resources (tools modify state, resources expose it)
- Session-scoped (recommendations cleared when session ends)
- Hybrid measurement approach: session includes measurement IDs/summary, separate resource for full FR data if needed
- Multiple levels: summary for quick status, detail for full state inspection

### Workflow Granularity
- Hierarchical structure: master prompt for full calibration flow, plus standalone prompts for sub-workflows
- Mixed session awareness: some standalone (gain staging), others session-aware (measurement, optimization)
- Sub-workflow boundaries determined by Claude based on natural workflow stages

### Error Recovery
- Escalation path: tool error first, then prompt-level guidance if retry fails
- Both levels for optimization worsening: tool suggests opposite direction, prompt tracks cumulative degradation
- Clear limitation message for REW Pro license restrictions (explain unavailable features, suggest upgrade)
- Retry with guidance for failed quality checks (troubleshoot mic position, noise, levels)

### Claude's Discretion
- Sub-workflow boundaries and which need standalone prompts
- Partial completion handling (resume from checkpoint vs start fresh with context)
- Resource structure details (URI schemes, nesting patterns)
- Context depth in prompts (sufficient for execution per GSD principles)

</decisions>

<specifics>
## Specific Ideas

- Follow GSD (Get Shit Done) workflow principles throughout
- Checkpoints at critical decision points and physical actions
- State persistence for resumability
- Goal-oriented prompts let Claude adapt tool sequence to current state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-workflow-orchestration*
*Context gathered: 2026-01-22*
