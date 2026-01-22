# Phase 8: Workflow Orchestration - Research

**Researched:** 2026-01-21
**Domain:** MCP Prompts and Resources, workflow orchestration patterns
**Confidence:** HIGH

## Summary

MCP Prompts and Resources are the established primitives for workflow orchestration in the Model Context Protocol (MCP). Prompts provide user-controlled workflow templates that guide LLMs through multi-step processes, while Resources expose read-only state data through URI-based access. The specification (version 2025-11-25) defines precise JSON-RPC protocols for both features.

Key findings:
- **Prompts are user-controlled**: Explicitly selected by users through UI affordances (slash commands, menus), never auto-executed
- **Goal-oriented design**: Prompts describe workflow objectives and provide context; Claude orchestrates tool sequences autonomously between checkpoints
- **Resources are application-controlled**: Client applications decide when/how to use resources; supports real-time subscriptions for state changes
- **Embedded resources in prompts**: Prompts can include server-managed content (documentation, session state) directly in message flow
- **Hierarchical workflows**: Master prompts for full workflows, sub-prompts for standalone operations; both can reference resources

**Primary recommendation:** Implement prompts for calibration workflows (full session, gain staging, measurement, optimization) with embedded session state resources. Use URI templates for dynamic resource access (session by ID, measurement data). Follow MCP capability declaration patterns for listChanged notifications.

## Standard Stack

### Core Specifications

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| MCP Specification | 2025-11-25 | Official protocol definition | Latest stable specification from Model Context Protocol |
| TypeScript SDK | v1.x (production) | Server/client implementation | Official SDK from modelcontextprotocol/typescript-sdk, v2 anticipated Q1 2026 |
| JSON-RPC 2.0 | - | Message protocol | MCP transport layer standard |

### Supporting Types

| Schema | From Package | Purpose | When to Use |
|--------|--------------|---------|-------------|
| ListPromptsRequestSchema | @modelcontextprotocol/sdk/types | Declare prompts/list handler | Always for prompt support |
| GetPromptRequestSchema | @modelcontextprotocol/sdk/types | Declare prompts/get handler | Always for prompt support |
| ListResourcesRequestSchema | @modelcontextprotocol/sdk/types | Declare resources/list handler | Always for resource support |
| ReadResourceRequestSchema | @modelcontextprotocol/sdk/types | Declare resources/read handler | Always for resource support |
| ListResourceTemplatesRequestSchema | @modelcontextprotocol/sdk/types | Declare resource templates | For parameterized resources (sessions, measurements) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MCP Prompts | Tool-only orchestration (Claude chains tools manually) | Prompts standardize workflows and reduce cognitive load; tool-only requires Claude to infer entire flow each time |
| MCP Resources | Tools that return state (e.g., get_session_state tool) | Resources are read-only by design (cleaner separation); tools for reads pollute tool list and conflate actions with queries |
| URI templates | Fixed URIs with IDs as arguments | Templates enable path-style resource access (session://abc123) matching RESTful patterns; fixed URIs require extra parsing |

**Installation:**
```bash
# Already installed in this project
npm install @modelcontextprotocol/sdk
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── prompts/
│   ├── index.ts                    # Prompt registration
│   ├── calibration-full.ts          # Master calibration workflow
│   ├── gain-staging.ts              # Standalone gain staging
│   ├── measurement-workflow.ts      # Session-aware measurement
│   └── optimization-workflow.ts     # Session-aware optimization
├── resources/
│   ├── index.ts                    # Resource registration
│   ├── session-state.ts             # Session state resource
│   ├── measurement-history.ts       # Measurement data resource
│   └── recommendations.ts           # Active recommendations resource
├── index.ts                        # Server setup (add capabilities)
```

### Pattern 1: Capability Declaration
**What:** Declare prompt and resource capabilities during server initialization
**When to use:** Always required for MCP prompts/resources support
**Example:**
```typescript
// Source: MCP Specification 2025-11-25 + existing src/index.ts pattern
const server = new Server(
  {
    name: 'rew-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {
        listChanged: true
      },
      prompts: {
        listChanged: true  // NEW: Enable prompt list change notifications
      },
      resources: {
        subscribe: true,    // NEW: Enable resource subscriptions
        listChanged: true   // NEW: Enable resource list change notifications
      },
      logging: {}
    }
  }
);
```

### Pattern 2: Goal-Oriented Prompt Structure
**What:** Prompts describe objectives and provide context for autonomous execution
**When to use:** All calibration workflows (full session, gain staging, measurement, optimization)
**Example:**
```typescript
// Source: MCP Specification + phase context decisions
interface PromptDefinition {
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// Master calibration workflow prompt
const calibrationFullPrompt: PromptDefinition = {
  name: 'rew_calibration_full',
  title: 'Full Calibration Workflow',
  description: 'Complete studio calibration: gain staging → L/R/Sub measurement → room analysis → optimization guidance',
  arguments: [
    {
      name: 'target_spl_db',
      description: 'Target SPL for monitor calibration (default: 85 dB)',
      required: false
    },
    {
      name: 'room_dimensions',
      description: 'Room dimensions in feet (format: "length x width x height")',
      required: false
    }
  ]
};

// Return goal-oriented message when prompt is invoked
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'rew_calibration_full') {
    const targetSPL = request.params.arguments?.target_spl_db || 85;

    return {
      description: 'Full studio calibration workflow',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Guide me through complete studio calibration targeting ${targetSPL} dB SPL.

OBJECTIVES:
1. Gain staging: Set monitor levels to target SPL
2. Measurement: Capture L/R/Sub frequency responses
3. Analysis: Detect room modes, peaks, nulls, SBIR issues
4. Optimization: Provide placement recommendations, validate adjustments

WORKFLOW:
- Pause for physical actions (adjusting volume, moving monitors)
- Pause for critical decisions (target curve selection, stopping criteria)
- Execute measurements and analysis autonomously between checkpoints
- Track session state throughout process

IMPORTANT:
- Use rew.api_measurement_session to track workflow state
- One recommendation at a time (scientific method)
- Validate each adjustment before next recommendation
- Use session resources (session://, recommendations://) to maintain context

Begin with gain staging using rew.api_calibrate_spl.`
          }
        }
      ]
    };
  }
  // ... other prompts
});
```

### Pattern 3: Embedded Resources in Prompts
**What:** Include server-managed state (session, recommendations) directly in prompt messages
**When to use:** When prompts need current state context (session-aware workflows)
**Example:**
```typescript
// Source: MCP Specification (embedded resources section)
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'rew_optimization_continue') {
    const sessionId = request.params.arguments?.session_id;
    if (!sessionId) {
      throw new Error('session_id required for optimization workflow');
    }

    // Fetch current session state
    const session = getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      description: 'Continue optimization workflow',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Continue room optimization workflow. Check current session state and recommendations.'
          }
        },
        {
          role: 'assistant',
          content: {
            type: 'resource',
            resource: {
              uri: `session://${sessionId}`,
              mimeType: 'application/json',
              text: JSON.stringify(session, null, 2)
            }
          }
        }
      ]
    };
  }
});
```

### Pattern 4: Resource URI Schemes
**What:** Custom URI schemes for REW calibration domain
**When to use:** All resource definitions
**Example:**
```typescript
// Source: MCP Specification (URI schemes section) + phase context
// Recommended URI schemes:

// Session state: session://[session-id]
// Example: session://abc123-def456
{
  uri: `session://${sessionId}`,
  name: `Session ${sessionId}`,
  title: `Calibration Session State`,
  description: 'Current session progress, measurements, next step',
  mimeType: 'application/json'
}

// Measurement data: measurement://[measurement-id]
// Example: measurement://abc123-def456
{
  uri: `measurement://${measurementId}`,
  name: `Measurement ${measurementId}`,
  title: `Frequency Response Data`,
  description: 'Full frequency response with metadata',
  mimeType: 'application/json'
}

// Active recommendations: recommendations://[session-id]
// Example: recommendations://abc123-def456
{
  uri: `recommendations://${sessionId}`,
  name: `Recommendations for ${sessionId}`,
  title: `Active Optimization Recommendations`,
  description: 'Current placement recommendation and validation status',
  mimeType: 'application/json'
}

// Measurement history for session: history://[session-id]
// Example: history://abc123-def456
{
  uri: `history://${sessionId}`,
  name: `Measurement History`,
  title: `Session Measurement History`,
  description: 'List of measurements with IDs and timestamps',
  mimeType: 'application/json'
}
```

### Pattern 5: Resource Templates for Dynamic URIs
**What:** RFC 6570 URI templates for parameterized resource access
**When to use:** When resources are identified by dynamic parameters (session ID, measurement ID)
**Example:**
```typescript
// Source: MCP Specification (resource templates section)
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: 'session://{session_id}',
        name: 'Session State',
        title: 'Calibration Session',
        description: 'Current session state including measurements and progress',
        mimeType: 'application/json'
      },
      {
        uriTemplate: 'measurement://{measurement_id}',
        name: 'Measurement Data',
        title: 'Frequency Response',
        description: 'Full frequency response data for specific measurement',
        mimeType: 'application/json'
      },
      {
        uriTemplate: 'recommendations://{session_id}',
        name: 'Recommendations',
        title: 'Optimization Recommendations',
        description: 'Active placement recommendations for session',
        mimeType: 'application/json'
      }
    ]
  };
});
```

### Pattern 6: Resource Read Handler
**What:** Handle resources/read requests by parsing URI and returning state
**When to use:** Always for resource support
**Example:**
```typescript
// Source: MCP Specification + existing session state patterns
import { ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getSession, listActiveSessions } from '../session/index.js';

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  // Parse URI scheme
  const match = uri.match(/^(\w+):\/\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const [, scheme, path] = match;

  switch (scheme) {
    case 'session': {
      const sessionId = path;
      const session = getSession(sessionId);
      if (!session) {
        // Per MCP spec: Use -32002 for resource not found
        const error = new Error(`Session not found: ${sessionId}`);
        (error as any).code = -32002;
        throw error;
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(session, null, 2)
          }
        ]
      };
    }

    case 'recommendations': {
      const sessionId = path;
      const session = getSession(sessionId);
      if (!session) {
        const error = new Error(`Session not found: ${sessionId}`);
        (error as any).code = -32002;
        throw error;
      }

      // Fetch active recommendations for session
      // (Implementation in Phase 8 will add recommendation tracking)
      const recommendations = {
        session_id: sessionId,
        current_recommendation: null, // To be implemented
        tried_recommendations: [], // Session-only tracking
        validation_status: null
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(recommendations, null, 2)
          }
        ]
      };
    }

    // ... other schemes (measurement, history)

    default:
      throw new Error(`Unknown resource scheme: ${scheme}`);
  }
});
```

### Pattern 7: Hierarchical Workflow Structure
**What:** Master prompt for full flow, standalone prompts for sub-workflows
**When to use:** When workflows have both full-session and partial-session use cases
**Example:**
```typescript
// Source: Phase context decisions (hierarchical structure)
const PROMPTS = {
  // Master workflow
  calibration_full: {
    name: 'rew_calibration_full',
    title: 'Full Calibration Workflow',
    description: 'Complete calibration: gain staging → measurement → analysis → optimization',
    arguments: [
      { name: 'target_spl_db', required: false },
      { name: 'room_dimensions', required: false }
    ]
  },

  // Standalone sub-workflows (session-agnostic)
  gain_staging: {
    name: 'rew_gain_staging',
    title: 'Gain Staging Only',
    description: 'Set monitor levels to target SPL using pink noise and SPL meter',
    arguments: [
      { name: 'target_spl_db', required: false }
    ]
  },

  // Session-aware sub-workflows
  measurement_workflow: {
    name: 'rew_measurement_workflow',
    title: 'Measurement Sequence',
    description: 'Guided L/R/Sub measurement with session tracking',
    arguments: [
      { name: 'session_id', required: true }
    ]
  },

  optimization_workflow: {
    name: 'rew_optimization_workflow',
    title: 'Room Optimization',
    description: 'Iterative placement optimization with validation',
    arguments: [
      { name: 'session_id', required: true }
    ]
  }
};
```

### Anti-Patterns to Avoid
- **Auto-executing prompts:** Prompts must be user-triggered, never auto-invoked by server
- **Tools for read-only state:** Use resources for state queries, tools for actions only
- **Missing capability declarations:** Clients won't discover prompts/resources without proper capabilities
- **Hardcoded resource lists:** Use templates for dynamic resources (sessions, measurements)
- **Mutable resources:** Resources are read-only; state changes happen via tools, not resource writes
- **Missing error codes:** Use standard JSON-RPC error codes (-32602 for invalid params, -32002 for not found)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom workflow format | YAML/JSON workflow definitions | MCP Prompts with goal-oriented messages | MCP prompts are standardized, client-agnostic, and officially supported |
| State polling | Custom state query tools | MCP Resources with subscriptions | Resources support real-time subscriptions (notifications/resources/updated) for efficient state updates |
| Template URI parsing | Custom URI parsers | RFC 6570 URI Template spec | MCP specification mandates RFC 6570; clients auto-complete template variables |
| Session state serialization | Custom JSON format | Existing SessionState type from Phase 4 | Already implemented, tested, and used by tools |
| Pagination for resources | Custom cursor logic | MCP cursor-based pagination | Built into specification (cursor param, nextCursor response field) |

**Key insight:** MCP Prompts and Resources are mature specifications with official SDK support. Custom workflow formats or state-query mechanisms duplicate existing functionality and break client compatibility. Use the standard primitives.

## Common Pitfalls

### Pitfall 1: Prompts That Execute Actions
**What goes wrong:** Prompt returns messages that trigger tool calls directly
**Why it happens:** Misunderstanding prompts as "tool macros"
**How to avoid:** Prompts provide context and objectives; Claude decides tool sequence. Prompts describe "what to do and why", not "call these tools in this order"
**Warning signs:** Prompt messages include specific tool names or exact tool call sequences
**Example:**
```typescript
// ❌ BAD: Prescriptive tool sequence
messages: [{
  role: 'user',
  content: {
    type: 'text',
    text: 'Call rew.api_connect, then rew.api_audio with action=status, then rew.api_calibrate_spl'
  }
}]

// ✅ GOOD: Goal-oriented with context
messages: [{
  role: 'user',
  content: {
    type: 'text',
    text: 'Set monitor levels to 85 dB SPL. Connect to REW API, verify audio devices, then use SPL calibration workflow.'
  }
}]
```

### Pitfall 2: Missing listChanged Capability
**What goes wrong:** Clients don't receive notifications when prompt/resource lists change
**Why it happens:** Forgetting to declare listChanged: true in capabilities
**How to avoid:** Always set listChanged: true for both prompts and resources capabilities if lists can change (e.g., sessions created/ended)
**Warning signs:** Resources appear/disappear but clients don't refresh lists
**Source:** MCP Specification 2025-11-25, Capabilities Declaration section

### Pitfall 3: Tools Instead of Resources for State
**What goes wrong:** Creating tools like get_session_state, get_recommendations that only return data
**Why it happens:** Not understanding resource vs tool separation
**How to avoid:** Resources = read-only data, Tools = actions. If it doesn't modify state, it's a resource
**Warning signs:** Tool with no side effects, purely returns JSON state
**Source:** MCP documentation: "Resources are application-controlled context/data, Tools are functions the AI executes"

### Pitfall 4: Embedding Full Measurement Data in Resources
**What goes wrong:** Session resource includes full frequency response arrays (thousands of points)
**Why it happens:** Not understanding resource size implications for context window
**How to avoid:** Session resource includes measurement IDs/summaries only; separate measurement:// resource for full FR data (accessed only when needed)
**Warning signs:** Session resource >10KB, contains full arrays instead of references
**Source:** Phase context decisions (hybrid measurement approach)

### Pitfall 5: Forgetting Resource Error Codes
**What goes wrong:** Throwing generic Error for missing resources instead of proper JSON-RPC error
**Why it happens:** Not following MCP error handling specification
**How to avoid:** Set error.code = -32002 for "not found", -32602 for "invalid params"
**Warning signs:** Client receives generic error instead of specific MCP error code
**Example:**
```typescript
// ❌ BAD: Generic error
if (!session) {
  throw new Error('Session not found');
}

// ✅ GOOD: Proper JSON-RPC error code
if (!session) {
  const error = new Error(`Session not found: ${sessionId}`);
  (error as any).code = -32002; // Resource not found
  throw error;
}
```
**Source:** MCP Specification 2025-11-25, Error Handling section

### Pitfall 6: Unclear Prompt Descriptions
**What goes wrong:** Users don't understand when to use which prompt
**Why it happens:** Vague or overly technical descriptions
**How to avoid:** Clear, concise descriptions with use case context. "Complete calibration: gain staging → measurement → analysis → optimization" not "Orchestrates REW workflows"
**Warning signs:** Users select wrong prompt, descriptions don't explain differences between hierarchical prompts
**Source:** WebSearch findings: "primary point of failure is how tools/prompts are described"

### Pitfall 7: Prompts Without Arguments
**What goes wrong:** Hardcoding defaults (85 dB SPL) instead of allowing user customization
**Why it happens:** Not realizing prompts support arguments with client-provided auto-completion
**How to avoid:** Use arguments for user preferences (target SPL, room dimensions); clients can auto-complete from history or suggest defaults
**Warning signs:** Prompt requires manual editing of workflow text to change parameters
**Source:** MCP Specification 2025-11-25, Prompts Arguments section

## Code Examples

Verified patterns from MCP specification and existing codebase:

### Prompt Registration Pattern
```typescript
// Source: MCP Specification + modelcontextprotocol.info examples
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const PROMPTS = {
  calibration_full: {
    name: 'rew_calibration_full',
    title: 'Full Calibration Workflow',
    description: 'Complete calibration: gain staging → measurement → analysis → optimization',
    arguments: [
      {
        name: 'target_spl_db',
        description: 'Target SPL for monitor calibration (default: 85 dB)',
        required: false
      }
    ]
  },
  // ... other prompts
};

// List prompts handler
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: Object.values(PROMPTS)
  };
});

// Get prompt handler
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'rew_calibration_full') {
    const targetSPL = args?.target_spl_db || 85;

    return {
      description: 'Full studio calibration workflow',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Guide me through complete studio calibration targeting ${targetSPL} dB SPL...`
          }
        }
      ]
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});
```

### Resource Registration Pattern
```typescript
// Source: MCP Specification + modelcontextprotocol.info examples
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListResourceTemplatesRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { listActiveSessions, getSession } from '../session/index.js';

// List active resources (dynamic session list)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const sessions = listActiveSessions();

  return {
    resources: sessions.map(session => ({
      uri: `session://${session.session_id}`,
      name: `Session ${session.session_id}`,
      title: `Calibration Session`,
      description: `Session started ${new Date(session.started_at).toLocaleString()}`,
      mimeType: 'application/json'
    }))
  };
});

// List resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: 'session://{session_id}',
        name: 'Session State',
        title: 'Calibration Session',
        description: 'Current session state including measurements and progress',
        mimeType: 'application/json'
      },
      {
        uriTemplate: 'recommendations://{session_id}',
        name: 'Recommendations',
        title: 'Optimization Recommendations',
        description: 'Active placement recommendations for session',
        mimeType: 'application/json'
      }
    ]
  };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^(\w+):\/\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const [, scheme, path] = match;

  if (scheme === 'session') {
    const session = getSession(path);
    if (!session) {
      const error = new Error(`Session not found: ${path}`);
      (error as any).code = -32002;
      throw error;
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(session, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown resource scheme: ${scheme}`);
});
```

### Session State Resource Structure (Hybrid Approach)
```typescript
// Source: Phase context decisions + existing session-state.ts
// Session resource includes measurement IDs/summary, not full FR data
interface SessionStateResource {
  session_id: string;
  started_at: string;
  current_step: string;
  measurements: Array<{
    measurement_id: string;
    channel: string;
    timestamp: string;
    summary: {
      variance_40_200hz: number;
      peak_spl_db: number;
      frequency_range: [number, number];
    };
    // NO full frequency/SPL arrays here
  }>;
  next_step: {
    step: string;
    guidance: string;
  };
}

// Separate measurement resource for full data
interface MeasurementResource {
  measurement_id: string;
  channel: string;
  timestamp: string;
  frequency_response: {
    frequencies_hz: number[];
    spl_db: number[];
  };
  metadata: object;
}
```

### Prompt with Embedded Resource
```typescript
// Source: MCP Specification (embedded resources section)
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'rew_optimization_continue') {
    const sessionId = request.params.arguments?.session_id;
    const session = getSession(sessionId);

    return {
      description: 'Continue optimization workflow',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Continue room optimization. Current session state:'
          }
        },
        {
          role: 'assistant',
          content: {
            type: 'resource',
            resource: {
              uri: `session://${sessionId}`,
              mimeType: 'application/json',
              text: JSON.stringify({
                session_id: session.session_id,
                current_step: session.current_step,
                measurements_count: session.measurements.length,
                next_step: session.next_step
              }, null, 2)
            }
          }
        }
      ]
    };
  }
});
```

## Integration Points with Existing Tools

### Session Management (Phase 4)
**Connection:** Resources expose session state; tools modify state
- `session://[id]` resource reads from existing SessionState (session/session-state.ts)
- Tools continue to use createSession, updateSession, endSession
- Resources provide Claude read-only access to track workflow progress

### Measurement Store (Phase 1-3)
**Connection:** Resources expose measurement summaries; tools store full data
- `measurement://[id]` resource reads from StoredMeasurement (store/measurement.ts)
- Session resource includes measurement IDs/summaries only
- Full frequency response accessed on-demand via measurement resource

### Analysis Tools (Phase 5)
**Connection:** Prompts guide analysis workflow; tools perform calculations
- Calibration prompts reference rew.analyze_room for comprehensive analysis
- Prompts describe when to analyze (after measurements complete)
- Tools return analysis results; prompts interpret in workflow context

### Optimization Tools (Phase 7)
**Connection:** Prompts orchestrate optimization; tools track recommendations
- `recommendations://[session-id]` resource exposes active recommendation
- rew.optimize_room tool generates/validates recommendations
- Prompts manage one-at-a-time workflow and checkpoint after each validation

### Workflow Pattern
```
1. User selects prompt (rew_calibration_full)
2. Prompt creates session (via rew.api_measurement_session start_session)
3. Claude follows goal-oriented workflow:
   - Gain staging (rew.api_calibrate_spl)
   - Measurements (rew.api_measure_workflow)
   - Analysis (rew.analyze_room)
   - Optimization loop:
     * Get recommendation (rew.optimize_room get_recommendation)
     * [PAUSE] User makes physical adjustment
     * Measure (rew.api_measure_workflow)
     * Validate (rew.optimize_room validate_adjustment)
     * Check progress (rew.optimize_room check_progress)
     * Repeat until target achieved
4. Throughout: Claude can read session:// and recommendations:// resources
5. Session ends when optimization complete or user stops
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tool-only orchestration | MCP Prompts for workflows | MCP spec introduced Nov 2024 | Standardizes workflow templates, reduces Claude cognitive load for common patterns |
| Tools return state | MCP Resources for read-only data | MCP spec introduced Nov 2024 | Cleaner separation: resources = queries, tools = actions |
| Fixed URIs with IDs | URI templates (RFC 6570) | MCP spec 2025-11-25 | Client auto-completion, RESTful patterns, better DX |
| Polling for state updates | Resource subscriptions | MCP spec 2025-11-25 | Real-time notifications (notifications/resources/updated) reduce latency |
| Custom workflow formats | Standardized MCP Prompts | Ecosystem convergence 2025 | Cross-client compatibility (58 MCP clients, 20 support prompts as of 2026) |

**Deprecated/outdated:**
- Pre-MCP workflow formats (YAML orchestration files, custom JSON): MCP Prompts are now standard
- State-query tools (get_session_state, get_recommendations): Use MCP Resources instead
- Hardcoded resource lists: Use resource templates for dynamic resources

## Open Questions

Things that couldn't be fully resolved:

1. **Prompt hierarchy depth**
   - What we know: Master prompt (full calibration) + standalone sub-prompts (gain staging, measurement, optimization)
   - What's unclear: Should there be intermediate prompts (e.g., "measurement + analysis only" without optimization)?
   - Recommendation: Start with master + 3 sub-prompts (gain staging, measurement, optimization). Add intermediate prompts only if user demand emerges. **Defer to planning phase.**

2. **Resource subscription granularity**
   - What we know: MCP supports resources/subscribe for real-time updates
   - What's unclear: Does Claude Desktop/other clients actively use subscriptions? Should we implement notifications/resources/updated?
   - Recommendation: Declare subscribe: true capability, implement basic notifications. Monitor usage to decide if full subscription logic needed. **LOW confidence** - client support unclear.

3. **Argument auto-completion**
   - What we know: MCP supports completion API for prompt arguments
   - What's unclear: Which clients implement completion? What values should be suggested for target_spl_db, room_dimensions?
   - Recommendation: Implement completion support but don't rely on it. Provide sensible defaults (85 dB SPL) if arguments missing. **Defer completion implementation to post-MVP.**

4. **Partial workflow resumption**
   - What we know: Session state persists, Claude can read session:// resource
   - What's unclear: Should there be a dedicated "resume calibration" prompt? Or should full calibration prompt detect existing session and offer resume?
   - Recommendation: Full calibration prompt checks for active sessions, offers resume via embedded session resource. No separate resume prompt needed. **Defer to planning for validation.**

5. **Error escalation in prompts**
   - What we know: Phase context specifies "tool error first, then prompt-level guidance if retry fails"
   - What's unclear: How does prompt provide error guidance? Via embedded resource with error context? Or via assistant message in prompt response?
   - Recommendation: Tools return structured errors; prompts reference error handling in goal description ("If tool errors, troubleshoot before retrying"). **Defer detailed error guidance to planning.**

## Sources

### Primary (HIGH confidence)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) - Official protocol specification
- [MCP Prompts Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) - Complete prompts protocol definition
- [MCP Resources Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) - Complete resources protocol definition
- [MCP Prompts Concepts](https://modelcontextprotocol.io/docs/concepts/prompts) - Official best practices and implementation guide
- [MCP Resources Concepts](https://modelcontextprotocol.io/docs/concepts/resources) - Official resource patterns and anti-patterns
- Existing codebase:
  - `/src/index.ts` - Server initialization pattern
  - `/src/tools/index.ts` - Tool registration pattern (will mirror for prompts/resources)
  - `/src/session/session-state.ts` - SessionState type for session:// resource
  - `/src/store/measurement.ts` - StoredMeasurement type for measurement:// resource

### Secondary (MEDIUM confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK documentation
- [Understanding MCP Features (WorkOS)](https://workos.com/blog/mcp-features-guide) - Tools, Resources, Prompts interaction patterns
- [MCP Architecture Deep Dive](https://www.getknit.dev/blog/mcp-architecture-deep-dive-tools-resources-and-prompts-explained) - Real-world implementation patterns
- [Building Full MCP Workflow](https://www.dailydoseofds.com/model-context-protocol-crash-course-part-4/) - Workflow orchestration examples
- [MCP Prompts Explained (Medium)](https://medium.com/@laurentkubaski/mcp-prompts-explained-including-how-to-actually-use-them-9db13d69d7e2) - Practical usage patterns
- [Effective Use of Prompts/Resources/Tools (Composio)](https://composio.dev/blog/how-to-effectively-use-prompts-resources-and-tools-in-mcp) - Integration best practices

### Tertiary (LOW confidence)
- [MCP Workflow Orchestration (AgentDesk)](https://skywork.ai/skypage/en/ai-workflow-orchestration/1977898943515136000) - Workflow patterns (vendor-specific)
- [MCP Clients Orchestration Patterns (Medium)](https://medium.com/@christoph.j.weisser28/%EF%B8%8F-mcp-clients-llms-orchestrator-agents-full-plan-and-step-by-step-orchestation-patterns-07af7dc0bce0) - Orchestration strategies (theoretical)
- Client support for prompts: "58 MCP Clients, 20 support Prompts" (2026 survey) - exact client list not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official MCP specification (2025-11-25), TypeScript SDK is production-ready
- Architecture: HIGH - Patterns directly from specification examples and official documentation
- Pitfalls: MEDIUM - Based on specification error handling and best practices; some from WebSearch findings about common mistakes
- Integration points: HIGH - Existing codebase provides all state types (SessionState, StoredMeasurement); integration is straightforward read-only access
- Client support: LOW - "20 of 58 clients support prompts" from WebSearch, but specific client behavior unclear

**Research date:** 2026-01-21
**Valid until:** 30 days (specification stable, but v2 anticipated Q1 2026 may introduce changes)
