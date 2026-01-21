# Architecture Patterns for Guided Multi-Step Workflows in MCP Servers

**Domain:** Audio calibration MCP server with iterative measure-adjust-measure workflow
**Researched:** 2026-01-21
**Confidence:** HIGH

## Executive Summary

MCP servers in 2026 follow a **composable, stateful architecture** where individual tools remain atomic but workflows are orchestrated through three primary mechanisms: **Prompts** (workflow templates), **Resources** (stateful session data), and **Elicitation** (human-in-the-loop interactions). For calibration workflows requiring iterative measurement cycles with physical adjustments, the architecture follows a **stateful session model** where the LLM maintains workflow context while the MCP server provides stateless tools and stateful resources.

The REW-mcp brownfield project already has atomic tools (connect, measure, analyze). The guided calibration workflow should be orchestrated via **MCP Prompts** that sequence tool calls, with session state maintained through **MCP Resources** rather than adding monolithic workflow tools.

## Recommended Architecture for Guided Calibration Workflow

### High-Level Pattern: Prompt-Orchestrated Tool Composition

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude (LLM Client)                      │
│  - Maintains workflow context across turns                  │
│  - Sequences tool calls based on prompt guidance            │
│  - Interprets results and guides user through steps         │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
        ┌──────────────────────────────────────┐
        │   MCP Protocol (Stateful Session)    │
        └──────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                     REW MCP Server                          │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │              PROMPTS (Workflow Templates)         │     │
│  │  - calibration_session_full                      │     │
│  │  - gain_staging_workflow                         │     │
│  │  - level_calibration_workflow                    │     │
│  │  - systematic_measurement_workflow               │     │
│  └───────────────────────────────────────────────────┘     │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────┐     │
│  │         RESOURCES (Stateful Session Data)         │     │
│  │  - calibration_session:{session_id}              │     │
│  │  - measurement_history:{session_id}              │     │
│  │  - session_recommendations:{session_id}          │     │
│  └───────────────────────────────────────────────────┘     │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────┐     │
│  │           TOOLS (Atomic Operations)               │     │
│  │  - ingest_measurement                            │     │
│  │  - analyze_room_modes                            │     │
│  │  - compare_measurements                          │     │
│  │  - interpret_with_glm_context                    │     │
│  │  - analyze_decay                                 │     │
│  │  - analyze_impulse                               │     │
│  └───────────────────────────────────────────────────┘     │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────┐     │
│  │         Measurement Store (Session State)         │     │
│  │  - Persists measurements by session_id           │     │
│  │  - Tracks workflow progress                      │     │
│  │  - Stores intermediate analysis results          │     │
│  └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
                    ┌───────────────┐
                    │  REW Software │
                    └───────────────┘
                            ↓ ↑
                    ┌───────────────┐
                    │  Audio System │
                    └───────────────┘
                            ↓ ↑
                    ┌───────────────┐
                    │  Human User   │
                    └───────────────┘
```

### Why This Pattern?

Based on 2026 MCP best practices:

1. **Tool Composition Over Monolithic Tools**: Each MCP server handles one specific capability. Individual tools remain atomic and composable. Adding a monolithic "calibrate_system" tool violates the single-responsibility principle and reduces reusability.

2. **Prompts for Workflow Orchestration**: MCP Prompts are designed exactly for this use case—providing reusable workflow templates that guide LLMs through multi-step processes. Prompts can reference tools and resources to build context-aware operations.

3. **Resources for State Persistence**: MCP Resources provide read-only access to server-side state. For calibration sessions, resources expose current session state, measurement history, and progress tracking—allowing the LLM to maintain context across the iterative workflow.

4. **Stateful Protocol, Stateless Tools**: MCP maintains stateful sessions (via session IDs), but individual tools should remain stateless. Session state lives in the measurement store and is accessed via Resources.

5. **Human-in-the-Loop via Elicitation**: For interactive steps (e.g., "Please move the SPL meter to ear level and press Enter"), use MCP Elicitation (2026 feature) to pause execution and request user input with validation.

## Component Boundaries for Calibration Workflow

### 1. Prompts (Workflow Templates)

**Purpose**: Define step-by-step calibration workflows as reusable templates.

**Location**: MCP Server Prompts API

**Example Prompts**:

```typescript
{
  name: "calibration_session_full",
  description: "Complete system calibration: gain staging → level calibration → systematic measurement → analysis → recommendations",
  arguments: [
    {
      name: "session_id",
      description: "Unique calibration session identifier (generated by client or server)",
      required: true
    },
    {
      name: "target_level_db",
      description: "Target calibration level in dB SPL (typically 75-85 dB)",
      required: false,
      default: 80
    },
    {
      name: "speaker_configuration",
      description: "Speaker setup (e.g., '2.1', '5.1', 'stereo')",
      required: true
    }
  ]
}
```

**Prompt Template Structure**:

```markdown
# Full System Calibration Workflow

Session ID: {{session_id}}
Target Level: {{target_level_db}} dB SPL
Configuration: {{speaker_configuration}}

## Phase 1: Gain Staging (Set Input Levels)

1. **Check connection**: Call `rew.check_connection`
   - Verify REW is running and responsive

2. **Initialize session resource**: Access `calibration_session://{{session_id}}`
   - Creates new session tracking resource

3. **Guide user to set gain**:
   - Use elicitation to prompt: "Please play pink noise through all speakers and adjust interface input gain until REW shows -18dB to -12dB RMS. Type 'ready' when complete."

4. **Verify gain levels**: Call `rew.measure_input_level`
   - Confirm levels are in optimal range

## Phase 2: Level Calibration (Set Output Levels)

5. **Measure reference channel**: Call `rew.trigger_measurement`
   - Channel: Left main speaker
   - Save as: "{{session_id}}_left_reference"

6. **Ingest and analyze**: Call `rew.ingest_measurement` → `rew.analyze_frequency_response`
   - Extract average SPL level

7. **Compare to target**: If measured ≠ target_level_db
   - Calculate delta: adjustment_db = target_level_db - measured_level
   - Use elicitation: "Adjust left speaker output by {{adjustment_db}} dB. Type 'ready' when complete."
   - Re-measure until within ±0.5 dB

8. **Repeat for all channels**: (Right, Center, Sub, etc.)
   - Use left channel as reference
   - Match levels across channels

## Phase 3: Systematic Measurement (Capture Full System)

9. **For each speaker position**:
   - Call `rew.trigger_measurement` with full sweep
   - Call `rew.ingest_measurement` with metadata: {session_id, speaker_id, condition: "calibrated"}

10. **Update session resource**:
    - Resource `calibration_session://{{session_id}}` now includes all measurements
    - Shows progress: "Measured 3/5 speakers"

## Phase 4: Analysis

11. **Run comprehensive analysis**: Call `rew.analyze_room_modes` for each measurement
12. **Compare channels**: Call `rew.compare_measurements` for L/R symmetry
13. **GLM context interpretation**: If using Genelec system, call `rew.interpret_with_glm_context`

## Phase 5: Recommendations

14. **Access results resource**: `session_recommendations://{{session_id}}`
15. **Synthesize findings**: Present:
    - Issues resolved by calibration
    - Issues requiring EQ/DSP correction
    - Issues requiring physical treatment (absorption, diffusion)
    - Prioritized action items

Remember: This is an iterative process. User may need to make physical adjustments and re-run phases.
```

### 2. Resources (Session State Access)

**Purpose**: Expose calibration session state and measurement history for read-only access.

**Resource URIs**:

```typescript
// Session metadata and progress tracking
calibration_session://{session_id}
// Returns:
{
  session_id: string;
  created_at: ISO8601;
  status: "in_progress" | "completed" | "abandoned";
  current_phase: "gain_staging" | "level_calibration" | "measurement" | "analysis" | "complete";
  target_level_db: number;
  speaker_configuration: string;
  measurements_completed: string[];  // List of measurement IDs
  measurements_pending: string[];    // Channels not yet measured
  progress_percentage: number;
}

// Full measurement history for session
measurement_history://{session_id}
// Returns array of StoredMeasurement objects for this session

// Analysis results and recommendations
session_recommendations://{session_id}
// Returns:
{
  session_id: string;
  timestamp: ISO8601;
  level_calibration_status: {
    channels: {[key: string]: {measured_db: number, delta_from_target: number}};
    overall_variance_db: number;
  };
  acoustic_issues: {
    severity: "critical" | "moderate" | "minor";
    category: "room_modes" | "decay" | "reflections" | "level_matching";
    description: string;
    addressable_by: "eq" | "dsp" | "physical_treatment" | "speaker_placement";
  }[];
  next_steps: string[];
}
```

**Implementation Notes**:

- Resources are **read-only** and updated automatically when tools modify session state
- Resource URIs follow the pattern: `{resource_type}://{identifier}`
- Resources return structured JSON matching published schemas
- Resources enable the LLM to "check progress" without re-executing analysis

### 3. Tools (Atomic Operations)

**Existing tools remain unchanged**:
- `ingest_measurement` - Parse and store measurement files
- `analyze_room_modes` - Detect peaks/nulls in frequency response
- `compare_measurements` - Compare before/after or placement variations
- `interpret_with_glm_context` - Apply Genelec GLM knowledge
- `analyze_decay` - Waterfall/decay analysis
- `analyze_impulse` - Impulse response analysis

**New tools needed for calibration workflow**:

```typescript
{
  name: "check_connection",
  title: "Check REW Connection",
  description: "Verify REW is running and responsive",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      status: {type: "string", enum: ["connected", "disconnected"]},
      rew_version: {type: "string"},
      timestamp: {type: "string", format: "date-time"}
    }
  }
}

{
  name: "trigger_measurement",
  title: "Trigger REW Measurement",
  description: "Start a measurement sweep in REW and return the result",
  inputSchema: {
    type: "object",
    properties: {
      session_id: {type: "string"},
      speaker_id: {type: "string"},
      measurement_type: {
        type: "string",
        enum: ["quick_level", "full_sweep", "impulse_response"]
      }
    },
    required: ["session_id", "speaker_id", "measurement_type"]
  },
  outputSchema: {
    type: "object",
    properties: {
      measurement_id: {type: "string"},
      status: {type: "string", enum: ["success", "failed"]},
      data_summary: {
        type: "object",
        properties: {
          avg_spl_db: {type: "number"},
          peak_spl_db: {type: "number"},
          frequency_range_hz: {
            type: "object",
            properties: {
              min: {type: "number"},
              max: {type: "number"}
            }
          }
        }
      }
    }
  }
}

{
  name: "measure_input_level",
  title: "Measure REW Input Level",
  description: "Check current input level in REW (for gain staging)",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      rms_level_dbfs: {type: "number"},
      peak_level_dbfs: {type: "number"},
      status: {
        type: "string",
        enum: ["optimal", "too_low", "too_high", "clipping"]
      },
      recommendation: {type: "string"}
    }
  }
}
```

### 4. Elicitation (Human-in-the-Loop)

**Purpose**: Pause workflow execution to request user input or confirmation.

**When to Use**:
- After displaying a measurement result, wait for user to make physical adjustments
- Request confirmation before proceeding to next phase
- Gather contextual information (e.g., room dimensions) during workflow

**Example Elicitation Flow**:

```typescript
// Server sends elicitation request to client
{
  type: "elicitation",
  prompt: "Adjust the left speaker output volume by +2.3 dB. When complete, type 'ready'.",
  schema: {
    type: "object",
    properties: {
      user_response: {
        type: "string",
        enum: ["ready", "skip", "abort"]
      }
    }
  }
}

// Client collects user input and returns
{
  user_response: "ready"
}

// Server continues workflow execution
```

**Implementation in 2026**:

MCP Elicitation is a core feature as of 2026. It allows servers to pause tool execution until the client provides missing data from the user. For calibration workflows, this enables:

1. **Progressive disclosure**: Start with high-level questions, drill down based on responses
2. **Validation**: Use JSON Schema to validate user input before continuing
3. **Context gathering**: Collect room dimensions, speaker positions during workflow rather than upfront

## State Management Patterns

### Session-Scoped State

**Problem**: Calibration workflows span multiple tool calls and require tracking progress, measurements, and intermediate results.

**Solution**: Session-scoped state stored in the Measurement Store, exposed via Resources.

**State Lifecycle**:

```
1. Session Creation (explicit or implicit)
   - Client generates session_id or prompts server to create one
   - Server initializes session resource with metadata
   - Session status: "in_progress"

2. Workflow Execution
   - Tools receive session_id as parameter
   - Tools update session state atomically
   - Resources reflect updated state immediately
   - LLM polls resources to check progress

3. Session Completion
   - Final analysis generates recommendations resource
   - Session status: "completed"
   - Session data persists for historical comparison

4. Session Persistence
   - Sessions stored in measurement store (file-based or DB)
   - Can be resumed across MCP connection restarts
   - Enables "continue calibration from last session" workflows
```

**State Schema**:

```typescript
interface CalibrationSession {
  session_id: string;
  created_at: ISO8601;
  updated_at: ISO8601;
  status: SessionStatus;

  // Workflow configuration
  config: {
    target_level_db: number;
    speaker_configuration: string;
    room_dimensions_m?: {length: number, width: number, height: number};
  };

  // Progress tracking
  progress: {
    current_phase: WorkflowPhase;
    phases_completed: WorkflowPhase[];
    steps_completed: string[];
    total_steps: number;
  };

  // Measurement tracking
  measurements: {
    [speaker_id: string]: {
      measurement_ids: string[];
      latest_level_db?: number;
      calibration_status: "pending" | "in_progress" | "calibrated" | "failed";
    };
  };

  // Analysis results (cached)
  analysis_cache?: {
    room_modes?: any;
    decay?: any;
    symmetry?: any;
  };
}

type SessionStatus = "in_progress" | "completed" | "abandoned" | "error";
type WorkflowPhase = "gain_staging" | "level_calibration" | "measurement" | "analysis" | "recommendations";
```

### Iterative Measurement Loop Pattern

**Challenge**: User needs to make physical adjustments between measurements (move speaker, adjust volume, add treatment).

**Architecture Pattern**: **Measure → Analyze → Guide → Wait → Re-measure**

```typescript
// Phase: Level Calibration for Left Speaker

Step 1: Trigger initial measurement
  Tool: trigger_measurement({session_id, speaker_id: "L", type: "quick_level"})
  Returns: {measurement_id: "m1", avg_spl_db: 77.8}

Step 2: Analyze against target
  Compute delta: 80.0 - 77.8 = +2.2 dB

Step 3: Guide user
  LLM composes message: "The left speaker is currently 2.2 dB below target. Please increase the output level by approximately 2.2 dB."

Step 4: Elicit user confirmation
  Elicitation: "When you've adjusted the level, type 'ready' to re-measure."
  User input: "ready"

Step 5: Re-measure
  Tool: trigger_measurement({session_id, speaker_id: "L", type: "quick_level"})
  Returns: {measurement_id: "m2", avg_spl_db: 79.9}

Step 6: Verify convergence
  New delta: 80.0 - 79.9 = +0.1 dB (within tolerance)
  Update session resource: measurements.L.calibration_status = "calibrated"

Step 7: Proceed to next speaker
  Move to right speaker calibration
```

**Key Architecture Decisions**:
- **LLM maintains loop control**: Server tools are stateless; LLM sequences the loop iterations
- **Session resource tracks iteration count**: Prevents infinite loops (max 5 iterations per speaker)
- **Explicit convergence criteria**: Delta threshold (±0.5 dB) defined in prompt template
- **Resource updates provide feedback**: LLM can check `calibration_session://{id}` to see current status

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Workflow Tool

**What**: Creating a single `calibrate_system` tool that orchestrates the entire workflow internally.

```typescript
// BAD: Monolithic tool
{
  name: "calibrate_system",
  description: "Runs complete calibration workflow",
  inputSchema: {
    type: "object",
    properties: {
      speaker_configuration: {type: "string"},
      target_level_db: {type: "number"}
    }
  }
}
```

**Why Bad**:
- Violates single-responsibility principle
- Cannot be reused for partial workflows (e.g., just gain staging)
- Hard to interrupt or modify mid-workflow
- Hides complexity from the LLM, reducing transparency
- Cannot leverage LLM's reasoning for dynamic decisions

**Instead**: Use Prompts to orchestrate atomic tools.

### Anti-Pattern 2: Storing Workflow Logic in Server State

**What**: Server maintains a state machine for workflow progression and auto-advances steps.

**Why Bad**:
- Reduces LLM agency—LLM should decide next steps based on results
- Makes workflows rigid and non-adaptive
- Harder to handle edge cases (user needs to skip a step, re-run a phase)
- Violates MCP principle: "LLM is the orchestrator, server provides capabilities"

**Instead**: Server exposes current state via Resources; LLM decides progression based on Prompt guidance.

### Anti-Pattern 3: Long-Running Tool Execution

**What**: A tool that runs for minutes, blocking the MCP connection.

```typescript
// BAD: Blocking calibration
async function calibrate_all_speakers() {
  for (const speaker of speakers) {
    await measure(speaker);
    await analyze(speaker);
    await waitForUserAdjustment(); // BLOCKS for unknown duration
  }
}
```

**Why Bad**:
- MCP connections can timeout during long operations
- No visibility into progress
- Cannot cancel or interrupt
- User has no control over pacing

**Instead**: Break into atomic tools; use Elicitation for user-paced operations.

### Anti-Pattern 4: Implicit Session Management

**What**: Server auto-creates sessions and tries to infer which session a tool call belongs to.

**Why Bad**:
- Ambiguous when multiple calibration sessions exist
- No way to resume a previous session
- Harder to implement multi-session comparison ("compare today's calibration to last week's")

**Instead**: Explicit session IDs passed to all tools. Client or Prompt generates session ID.

## Comparison: Tool Composition vs Monolithic Workflow

| Aspect | Tool Composition (Recommended) | Monolithic Workflow |
|--------|-------------------------------|---------------------|
| **Modularity** | Each tool does one thing well | Single tool does everything |
| **Reusability** | Tools usable in multiple workflows | Workflow logic tightly coupled |
| **Transparency** | LLM sees each step, can explain to user | Workflow execution is opaque |
| **Flexibility** | LLM can adapt workflow based on results | Fixed workflow sequence |
| **Error Recovery** | Can retry individual steps | Must restart entire workflow |
| **Testing** | Test each tool independently | Must test full workflow |
| **Maintenance** | Change one tool without affecting others | Changes ripple through workflow |
| **MCP Alignment** | Follows 2026 best practices | Violates composability principle |
| **Session State** | Stored in Resources, read-only | Stored internally, hidden |
| **Human-in-the-Loop** | Natural with Elicitation | Requires polling or callbacks |

## Scalability Considerations

| Concern | At 1 Session | At 10 Concurrent Sessions | At 100+ Historical Sessions |
|---------|--------------|---------------------------|----------------------------|
| **State Storage** | In-memory map | In-memory with session cleanup | File-based or SQLite storage |
| **Resource URIs** | Simple hash map | Indexed by session_id | Database queries with indexes |
| **Session Cleanup** | Manual or timeout-based | Auto-expire after 24h inactive | Archive completed sessions to cold storage |
| **Measurement History** | Full history in memory | Per-session history in memory | On-demand loading from storage |
| **Resource Polling** | No concern | Rate limiting on resource access | Caching layer for frequently accessed resources |

**Recommended Implementation**:
- Start with **in-memory session store** with 24-hour TTL
- Use **file-based persistence** (JSON files per session) for durability across server restarts
- Implement **lazy loading** for measurement data (load full data only when tool requests it)
- Add **session archiving** after 30 days for historical comparison

## Implementation Roadmap for REW-mcp

Based on brownfield context (existing atomic tools), add guided workflow in phases:

### Phase 1: Session Management (Foundation)

**Goal**: Add session-scoped state tracking.

**Tasks**:
1. Extend Measurement Store to support session_id grouping
2. Add `session_id` parameter to all existing tools (optional, defaults to "default")
3. Implement session lifecycle (create, update, complete)
4. Add session metadata storage

**Outcome**: Tools can associate measurements with calibration sessions.

### Phase 2: Resources (State Exposure)

**Goal**: Expose session state for LLM access.

**Tasks**:
1. Implement `calibration_session://{session_id}` resource
2. Implement `measurement_history://{session_id}` resource
3. Implement `session_recommendations://{session_id}` resource
4. Add resource schemas to server capabilities

**Outcome**: LLM can query session progress without re-running analysis.

### Phase 3: Calibration Tools (New Operations)

**Goal**: Add tools needed for guided calibration.

**Tasks**:
1. Implement `check_connection` tool
2. Implement `trigger_measurement` tool (if REW API allows automation)
3. Implement `measure_input_level` tool
4. Add tools to server capabilities

**Outcome**: LLM can drive full calibration workflow using available tools.

### Phase 4: Prompts (Workflow Templates)

**Goal**: Provide guided workflows for common calibration tasks.

**Tasks**:
1. Create `calibration_session_full` prompt
2. Create `gain_staging_workflow` prompt
3. Create `level_calibration_workflow` prompt
4. Create `systematic_measurement_workflow` prompt
5. Document workflow usage in README

**Outcome**: Users can invoke `claude: use prompt calibration_session_full` to start guided calibration.

### Phase 5: Elicitation (Human-in-the-Loop)

**Goal**: Enable interactive pauses for physical adjustments.

**Tasks**:
1. Implement MCP Elicitation support in tools that need user input
2. Add elicitation points in workflow prompts (via LLM interpretation)
3. Document elicitation patterns for users

**Outcome**: Workflows pause naturally for user actions, then resume.

## Architectural Decision Records

### ADR-1: Use Prompts for Workflow Orchestration (Not Monolithic Tools)

**Context**: Need to guide users through multi-step calibration workflow.

**Decision**: Implement workflows as MCP Prompts that sequence existing atomic tools, rather than creating monolithic "calibrate_system" tool.

**Rationale**:
- Aligns with MCP 2026 best practice of tool composition
- Maintains tool reusability and modularity
- Allows LLM to adapt workflow based on intermediate results
- Enables transparent step-by-step explanation to user
- Supports partial workflow execution (e.g., just gain staging)

**Consequences**:
- More prompts to maintain (but each is simpler)
- LLM has more context to manage (but MCP protocol handles this)
- Workflow execution visible to user (transparency benefit)

### ADR-2: Use Resources for Session State (Not Tool Return Values Only)

**Context**: Need to track calibration session progress across multiple tool calls.

**Decision**: Store session state in Measurement Store and expose via MCP Resources, rather than requiring LLM to parse and cache tool outputs.

**Rationale**:
- Resources provide canonical source of truth for session state
- Enables "check progress" queries without re-executing tools
- Supports session resumption after disconnect
- Allows multiple clients to observe same session (future: web dashboard)
- Follows MCP pattern: Tools mutate state, Resources expose state

**Consequences**:
- More resource implementations to maintain
- Requires session-scoped storage (added complexity)
- Better user experience (can check status anytime)

### ADR-3: Explicit Session IDs (Not Implicit)

**Context**: Need to support multiple calibration sessions and historical comparison.

**Decision**: Require explicit `session_id` parameter on all tools, generated by client or prompt.

**Rationale**:
- Unambiguous session association
- Enables resumable workflows
- Supports historical comparison ("compare this calibration to last month's")
- Prevents accidental cross-contamination of session data

**Consequences**:
- All tool calls must include session_id (more parameter burden)
- Prompt templates generate session_id (e.g., `session_id: "cal_{{timestamp}}"`)
- Better data integrity and workflow control

### ADR-4: Stateless Tools, Stateful Protocol

**Context**: MCP protocol is stateful (maintains connections), but need to decide where workflow state lives.

**Decision**: Keep tools stateless (pure functions); store state in Measurement Store; expose state via Resources.

**Rationale**:
- Tools remain testable and predictable
- State management centralized in one component
- Follows MCP architecture pattern
- Enables horizontal scaling (multiple server instances could share state store)

**Consequences**:
- Measurement Store becomes more complex (session management logic)
- Tools must be given session_id to associate data correctly
- Cleaner separation of concerns

## References and Sources

### MCP Architecture and Workflow Patterns
- [Orchestrating Multi-Agent Intelligence: MCP-Driven Patterns](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/orchestrating-multi-agent-intelligence-mcp-driven-patterns-in-agent-framework/4462150)
- [Orchestrating Multiple MCP Servers in a Single AI Workflow](https://portkey.ai/blog/orchestrating-multiple-mcp-servers-in-a-single-ai-workflow/)
- [MCP Server Architecture: State Management, Security & Tool Orchestration](https://zeo.org/resources/blog/mcp-server-architecture-state-management-security-tool-orchestration)
- [Workflows MCP Server GitHub](https://github.com/cyanheads/workflows-mcp-server)
- [Advanced MCP: Agent Orchestration, Chaining, and Handoffs](https://www.getknit.dev/blog/advanced-mcp-agent-orchestration-chaining-and-handoffs)

### MCP State Management and Sessions
- [Building Effective AI Agents with MCP](https://developers.redhat.com/articles/2026/01/08/building-effective-ai-agents-mcp)
- [Model Context Protocol Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [Code Execution with MCP: Building More Efficient AI Agents](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Claude Code Internals, Part 6: Session State Management](https://kotrotsos.medium.com/claude-code-internals-part-6-session-state-management-e729f49c8bb9)
- [Session Handoff for Claude Code | Context & State Manager](https://mcpmarket.com/tools/skills/session-handoff-context-manager)

### MCP Prompts and Resources
- [Getting the Most Out of MCP with Prompts, Resources, and Sampling](https://devblogs.microsoft.com/visualstudio/mcp-prompts-resources-sampling/)
- [Understanding MCP Features: Tools, Resources, Prompts, Sampling](https://workos.com/blog/mcp-features-guide)
- [MCP Prompts: Building Workflow Automation](http://blog.modelcontextprotocol.io/posts/2025-07-29-prompts-for-automation/)
- [How to Effectively Use Prompts, Resources, and Tools in MCP](https://composio.dev/blog/how-to-effectively-use-prompts-resources-and-tools-in-mcp)

### Tool Composition vs Monolithic Architecture
- [Scaling AI Capabilities: Using Multiple MCP Servers with One Agent](https://www.getknit.dev/blog/scaling-ai-capabilities-using-multiple-mcp-servers-with-one-agent)
- [MCP Server Architecture: How Modular Protocols Power Scalable AI Integrations](https://www.theninjastudio.com/blog/mcp-server-architecture-how-modular-protocols-power-scalable-ai-integrations)
- [Model Context Protocol: Architecture, Components & Workflow](https://www.kubiya.ai/blog/model-context-protocol-mcp-architecture-components-and-workflow)

### Human-in-the-Loop Patterns
- [Human-In-the-Loop MCP Server GitHub](https://github.com/GongRzhe/Human-In-the-Loop-MCP-Server)
- [MCP Elicitation: Human-in-the-Loop for MCP Servers](https://dev.to/kachurun/mcp-elicitation-human-in-the-loop-for-mcp-servers-m6a)
- [How Elicitation in MCP Brings Human-in-the-Loop to AI Tools](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/)
- [Building Long-Running Interactive MCP Tools with Temporal](https://temporal.io/blog/building-long-running-interactive-mcp-tools-temporal)

### Audio Calibration Domain Patterns
- [Calibrating Your Mixing Setup](https://www.soundonsound.com/techniques/calibrating-your-mixing-setup)
- [How to Use Sound Calibration Software Effectively](https://www.sonarworks.com/blog/learn/how-to-use-sound-calibration-software-effectively)
- [REW AutoEQ Step by Step](https://www.minidsp.com/applications/rew/rew-autoeq-step-by-step)

### Iterative Measurement and Control Loop Patterns
- [Loop Calibration Basics](https://blog.beamex.com/loop-calibration-basics)
- [Build-Measure-Learn Loop in Product Development](https://userpilot.com/blog/build-measure-learn/)

---

**Confidence Assessment**:
- MCP Architecture Patterns: **HIGH** (official sources, 2026 best practices documented)
- Session State Management: **HIGH** (MCP spec and implementation guides)
- Human-in-the-Loop (Elicitation): **HIGH** (2026 feature, documented with examples)
- Tool Composition Best Practices: **HIGH** (multiple authoritative sources agree)
- Audio Calibration Workflows: **MEDIUM** (domain practices well documented, but integration with MCP is novel)
