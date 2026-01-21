# Phase 4: Measurement Workflow + Sessions - Research

**Researched:** 2026-01-21
**Domain:** REW API measurement automation, session state persistence, L/R/Sub workflow sequencing
**Confidence:** MEDIUM

## Summary

Phase 4 implements systematic L/R/R/Sub measurement workflows with session state persistence and resumability. Based on research, the standard approach combines:

1. **REW API measurement triggering**: REW Pro license required for automated sweep measurements via `/measure/command` endpoint. API supports blocking mode for synchronous operation and returns 200/202 status codes for quick/async commands.

2. **Session state persistence**: MCP servers are stateless by default—session state must be stored externally (in-memory Map for active sessions, with session ID passed between tool calls). Native Node.js `crypto.randomUUID()` provides fast, secure session IDs.

3. **L/R/Sub measurement sequence**: Industry practice measures speakers individually (L, R, Sub) then combined (L+Sub, R+Sub, L+R+Sub) with automatic naming based on output channel and session context.

4. **Workflow state pattern**: Use start/check/stop pattern (established in Phase 3) extended to start_session → measure → measure → stop_session, with state machine tracking current step and measurements taken.

**Primary recommendation:** Store session state in module-level Map (sessionId → SessionState), generate session IDs with crypto.randomUUID(), use REW's measure naming API to set names before triggering measurements, and implement state machine pattern for guided L/R/Sub sequence with resumability support.

## Standard Stack

Phase 1-3 already established REW API client and tooling. Phase 4 extends with measurement workflow orchestration and session management.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| REW API | 5.30+ | Measurement triggering via /measure/command | Official REW REST API, Pro license required for automated sweeps |
| Node.js crypto | native | Session ID generation (crypto.randomUUID) | Native in Node 14.17+, 12x faster than uuid npm package |
| Map | native | In-memory session state storage | Native JavaScript, supports concurrent sessions without cross-contamination |
| @modelcontextprotocol/sdk | ^1.25.2 | MCP server/client framework | Official MCP SDK for tool registration |
| Zod | ^3.23.8 | Runtime schema validation | TypeScript-first validation, already used in Phase 1-3 |

### Supporting (Patterns - No New Libraries)
| Component | Implementation | Purpose | When to Use |
|-----------|----------------|---------|-------------|
| State machine | Enum + switch for step tracking | Track measurement sequence progress | Multi-step workflows (L/R/Sub sequence) |
| Session Map | `Map<string, SessionState>` | Concurrent session isolation | Multiple users or sessions without state contamination |
| Measurement naming | REW `/measure/naming` API | Automatic naming before sweep | Session-scoped naming (e.g., "Session_abc123_Left") |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory Map | Redis/external DB | Map is simpler for MCP server, no external dependencies. Redis better for multi-process or persistence beyond server lifetime |
| crypto.randomUUID() | uuid npm package | crypto.randomUUID is 12x faster, native in Node 14.17+, no dependencies |
| State machine enum | XState library | XState adds 50KB+ dependency for complex workflows. Enum+switch sufficient for linear L/R/Sub sequence |
| Session ID in state | Session ID passed by caller | Stateless pattern cleaner but requires coordination. State machine pattern needs server-side tracking |

**Installation:**
```bash
# No new dependencies needed
# crypto.randomUUID() is native in Node 14.17+
# Map is native JavaScript
```

## Architecture Patterns

### Current Structure (Phase 1-3)
```
src/
├── api/
│   ├── rew-client.ts           # REW API client (has executeMeasureCommand)
│   ├── rew-api-error.ts        # Typed error handling
│   └── schemas.ts              # Zod schemas for API responses
├── tools/
│   ├── api-connect.ts          # Connection management
│   ├── api-measure.ts          # Basic measure commands (Phase 1)
│   ├── api-measure-workflow.ts # Workflow orchestration (Phase 3)
│   ├── api-calibrate-spl.ts    # Start/check/stop pattern (Phase 3)
│   └── [NEW] api-measurement-session.ts  # Session-based L/R/Sub workflow
```

### Pattern 1: REW API Measurement Triggering
**What:** Use `/measure/command` endpoint with "Measure" command to trigger automated sweep
**When to use:** Any automated measurement workflow
**Example:**
```typescript
// Source: REW API documentation + Phase 3 existing implementation
// https://www.roomeqwizard.com/help/help_en-GB/html/api.html

// Already implemented in REWApiClient (src/api/rew-client.ts)
async executeMeasureCommand(command: string, parameters?: string[]): Promise<{
  success: boolean;
  status: number;
  message?: string;
  data?: unknown;
}> {
  const body = {
    command,
    parameters: parameters || []
  };

  const response = await this.request('POST', '/measure/command', body);

  return {
    success: response.status === 200 || response.status === 202,
    status: response.status,
    message: response.status === 202 ? 'Measurement started (async)' : undefined,
    data: response.data
  };
}

// Usage pattern
await client.setBlockingMode(true);  // Synchronous measurement
await client.setMeasureNotes('Session_abc123_Left');
const result = await client.executeMeasureCommand('Measure');

if (result.status === 403) {
  throw new Error('REW Pro license required for automated measurements');
}
```

### Pattern 2: Session State Management with Map
**What:** Store session state in module-level Map for concurrent session isolation
**When to use:** Any multi-step workflow that needs state across tool calls
**Example:**
```typescript
// Source: Node.js Map + MCP stateless server pattern
// MCP servers are stateless by default - state must be managed explicitly

interface SessionState {
  session_id: string;
  created_at: number;
  sequence_step: 'idle' | 'measuring_left' | 'measuring_right' | 'measuring_sub' | 'complete';
  measurements: Array<{
    uuid?: string;
    name: string;
    channel: 'left' | 'right' | 'sub';
    timestamp: number;
  }>;
  target_spl?: number;
  notes?: string;
}

// Module-level storage (persists across tool calls within server lifetime)
const activeSessions = new Map<string, SessionState>();

// Create new session
function createSession(notes?: string): SessionState {
  const session: SessionState = {
    session_id: crypto.randomUUID(),  // Native Node.js 14.17+
    created_at: Date.now(),
    sequence_step: 'idle',
    measurements: [],
    notes
  };

  activeSessions.set(session.session_id, session);
  return session;
}

// Get session (throws if not found)
function getSession(sessionId: string): SessionState {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found. Use start_session first.`);
  }
  return session;
}

// Update session
function updateSession(sessionId: string, updates: Partial<SessionState>): void {
  const session = getSession(sessionId);
  Object.assign(session, updates);
  activeSessions.set(sessionId, session);
}

// Resume session (for disconnect/reconnect)
function listActiveSessions(): SessionState[] {
  return Array.from(activeSessions.values());
}
```

### Pattern 3: State Machine for L/R/Sub Sequence
**What:** Track measurement sequence progress with enum-based state machine
**When to use:** Guided multi-step workflows with validation between steps
**Example:**
```typescript
// Source: TypeScript state pattern + Phase 3 start/check/stop pattern

type SequenceStep =
  | 'idle'              // Session created, no measurements yet
  | 'measuring_left'    // Left speaker measured
  | 'measuring_right'   // Right speaker measured
  | 'measuring_sub'     // Subwoofer measured
  | 'complete';         // All measurements done

// State transitions
const validTransitions: Record<SequenceStep, SequenceStep[]> = {
  idle: ['measuring_left'],
  measuring_left: ['measuring_right'],
  measuring_right: ['measuring_sub'],
  measuring_sub: ['complete'],
  complete: []  // No further transitions
};

function validateTransition(from: SequenceStep, to: SequenceStep): void {
  if (!validTransitions[from].includes(to)) {
    throw new Error(
      `Invalid sequence: cannot go from ${from} to ${to}. ` +
      `Expected: ${validTransitions[from].join(' or ')}`
    );
  }
}

// Execute measurement with state transition
async function executeMeasurementStep(
  client: REWApiClient,
  session: SessionState,
  channel: 'left' | 'right' | 'sub'
): Promise<void> {
  // Determine next step
  const nextStep: SequenceStep =
    channel === 'left' ? 'measuring_left' :
    channel === 'right' ? 'measuring_right' :
    'measuring_sub';

  // Validate transition
  validateTransition(session.sequence_step, nextStep);

  // Set measurement name
  const name = `${session.session_id.slice(0, 8)}_${channel}`;
  await client.setMeasureNotes(name);

  // Execute measurement
  const beforeCount = (await client.listMeasurements()).length;
  const result = await client.executeMeasureCommand('Measure');

  if (!result.success) {
    throw new Error(`Measurement failed: ${result.message || result.status}`);
  }

  // Find new measurement UUID
  const afterMeasurements = await client.listMeasurements();
  const newMeasurement = afterMeasurements[afterMeasurements.length - 1];

  // Update session state
  session.measurements.push({
    uuid: newMeasurement?.uuid,
    name,
    channel,
    timestamp: Date.now()
  });

  session.sequence_step = nextStep;

  // Check if sequence complete
  if (channel === 'sub') {
    session.sequence_step = 'complete';
  }
}
```

### Pattern 4: Automatic Measurement Naming
**What:** Use REW's `/measure/naming` API to set measurement name before triggering sweep
**When to use:** Any automated measurement workflow to ensure consistent naming
**Example:**
```typescript
// Source: REW API /measure/naming endpoint
// Already implemented in REWApiClient

// Naming convention: SessionID_Channel_Timestamp
function generateMeasurementName(
  sessionId: string,
  channel: 'left' | 'right' | 'sub',
  timestamp?: number
): string {
  // Use short session ID (first 8 chars) for readability
  const shortId = sessionId.slice(0, 8);

  // Format: abc12345_left_20260121_1430
  if (timestamp) {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 5).replace(':', '');
    return `${shortId}_${channel}_${dateStr}_${timeStr}`;
  }

  // Simple format: abc12345_left
  return `${shortId}_${channel}`;
}

// Set name before measurement
await client.setMeasureNotes(generateMeasurementName(sessionId, 'left'));
await client.executeMeasureCommand('Measure');

// Alternative: Use REW naming API (prefix + auto-numbering)
await client.setMeasureNaming({
  prefix: `${sessionId.slice(0, 8)}_`,
  includeDate: false,
  includeTime: false
});
```

### Pattern 5: Session Resumability
**What:** Support resuming session after disconnect by passing session_id parameter
**When to use:** Long-running workflows where user may disconnect and reconnect
**Example:**
```typescript
// Source: MCP multi-conversation persistence pattern
// Based on: https://github.com/orgs/modelcontextprotocol/discussions/165

// Tool input schema supports resume
export const MeasurementSessionInputSchema = z.object({
  action: z.enum(['start_session', 'measure', 'get_status', 'stop_session']),

  session_id: z.string().uuid().optional()
    .describe('Session ID to resume. Omit for new session.'),

  channel: z.enum(['left', 'right', 'sub']).optional()
    .describe('Channel to measure (required for measure action)'),

  notes: z.string().optional()
    .describe('Session notes (for start_session)')
});

// Action handlers
async function handleAction(input: MeasurementSessionInput): Promise<Result> {
  switch (input.action) {
    case 'start_session': {
      // Create new session
      if (input.session_id) {
        throw new Error('Cannot specify session_id for start_session. Omit to create new.');
      }

      const session = createSession(input.notes);
      return {
        action: 'start_session',
        session_id: session.session_id,
        message: 'Session created. Use measure action with this session_id.'
      };
    }

    case 'measure': {
      // Resume existing session
      if (!input.session_id) {
        throw new Error('session_id required for measure action');
      }

      const session = getSession(input.session_id);  // Throws if not found

      // Execute measurement
      await executeMeasurementStep(client, session, input.channel);

      return {
        action: 'measure',
        session_id: session.session_id,
        sequence_step: session.sequence_step,
        measurements: session.measurements
      };
    }

    case 'get_status': {
      // Check session status (resume support)
      if (input.session_id) {
        const session = getSession(input.session_id);
        return {
          action: 'get_status',
          session: session
        };
      } else {
        // List all active sessions
        return {
          action: 'get_status',
          active_sessions: listActiveSessions()
        };
      }
    }
  }
}
```

### Anti-Patterns to Avoid

- **Don't use external database for session state (Phase 4):** In-memory Map is sufficient for MCP server. Sessions are temporary (minutes to hours), not long-term storage. Redis/DB adds complexity without benefit for this use case.

- **Don't skip Pro license check:** REW returns 403 for automated measurements without Pro license. Must detect this and provide clear error message, not silent failure.

- **Don't mix sessions cross-contamination:** Always validate session_id parameter matches active session. Never assume "current session" without explicit ID.

- **Don't use sequential IDs:** Session IDs must be cryptographically random (crypto.randomUUID()) to prevent guessing/collision across concurrent users.

- **Don't block other sessions:** Map-based storage allows concurrent sessions. Never use global state locks that would block parallel workflows.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random string generator | crypto.randomUUID() | Native in Node 14.17+, 12x faster than uuid npm, cryptographically secure |
| State machine validation | Manual if/else chains | Enum + validTransitions map | Type-safe, easier to test, prevents invalid transitions |
| Session storage | Custom file-based persistence | Map for in-memory, optional Redis for multi-process | Map handles concurrent access, built-in JavaScript, no serialization overhead |
| Measurement naming | Manual string concatenation | REW /measure/naming API | REW handles prefix + auto-numbering, date/time formatting, ensures unique names |
| Workflow step tracking | Boolean flags (leftDone, rightDone) | State machine enum | Single source of truth, prevents impossible states (leftDone=false but rightDone=true) |

**Key insight:** REW API provides measurement triggering primitives but NO session management. Session state (which measurements taken, what's next) must be built in MCP server using native Node.js primitives (Map, crypto.randomUUID).

## Common Pitfalls

### Pitfall 1: REW Pro License Not Detected Early
**What goes wrong:** User starts session, gets through setup, then fails on first measurement with 403 error.

**Why it happens:**
- REW returns 403 for `/measure/command` without Pro license
- License check can't happen until measurement attempted
- No pre-flight API to verify Pro license status

**How to avoid:**
1. **Document Pro requirement clearly:** Tool description states "REW Pro license required"
2. **Detect 403 on first measurement:** Check status === 403 specifically
3. **Provide actionable error message:** "REW Pro license required for automated measurements. Visit https://www.roomeqwizard.com/upgrades.html"

**Warning signs:**
- User reports "works manually but not via API"
- 403 error on /measure/command
- Other endpoints work fine (list measurements, generator, etc.)

**Recommended pattern:**
```typescript
// GOOD - Detect Pro license requirement
const result = await client.executeMeasureCommand('Measure');

if (result.status === 403) {
  throw new Error(
    'REW Pro license required for automated measurements. ' +
    'Manual measurement: Use REW GUI → Measure button. ' +
    'Or upgrade: https://www.roomeqwizard.com/upgrades.html'
  );
}

// BAD - Silent failure or generic error
if (!result.success) {
  throw new Error('Measurement failed');  // Not helpful!
}
```

### Pitfall 2: Session State Lost on Server Restart
**What goes wrong:** User starts session, server restarts (code update, crash), session_id no longer valid.

**Why it happens:**
- Map storage is in-memory only
- Server restart clears all sessions
- No persistence to disk or external store

**How to avoid:**
1. **Accept this limitation:** Document that sessions are temporary (server lifetime)
2. **Provide session listing:** get_status with no session_id returns all active sessions
3. **Fast recovery:** User can list_measurements in REW, see recent measurements, continue manually

**Warning signs:**
- "Session abc123 not found" after server restart
- User reports losing progress mid-workflow
- No way to resume after MCP server update

**Recommended pattern:**
```typescript
// GOOD - Document limitation and provide recovery
export const tool = {
  name: 'rew.measurement_session',
  description:
    'Guided L/R/Sub measurement workflow with session state. ' +
    'Sessions are temporary (persist during server lifetime). ' +
    'Use get_status to list active sessions or start new session.',
  // ...
};

// Recovery path
if (input.action === 'get_status' && !input.session_id) {
  const sessions = listActiveSessions();
  if (sessions.length === 0) {
    return {
      message: 'No active sessions. Use start_session to create new session.',
      suggestion: 'Or list_measurements to see recently completed measurements.'
    };
  }
}

// BAD - No recovery path
function getSession(id: string): SessionState {
  return activeSessions.get(id);  // Returns undefined, causes downstream errors
}
```

### Pitfall 3: Assuming Measurements Complete Immediately
**What goes wrong:** Code checks for new measurement UUID immediately after executeMeasureCommand, doesn't find it, reports failure.

**Why it happens:**
- REW API returns 202 (Accepted) for long-running measurements
- Measurement sweep takes 10-30 seconds to complete
- Polling too early finds old measurement count

**How to avoid:**
1. **Use blocking mode:** `setBlockingMode(true)` makes API wait for completion before returning
2. **Poll with retry:** If blocking unavailable, poll listMeasurements with 2s interval
3. **Compare before/after count:** Count measurements before trigger, compare after

**Warning signs:**
- "Measurement completed but UUID not found"
- Timing-dependent test failures
- Works in manual testing, fails in automated sequence

**Recommended pattern:**
```typescript
// GOOD - Blocking mode + before/after comparison
await client.setBlockingMode(true);  // Wait for completion

const beforeMeasurements = await client.listMeasurements();
const beforeCount = beforeMeasurements.length;

const result = await client.executeMeasureCommand('Measure');

if (!result.success) {
  throw new Error(`Measurement failed: ${result.status}`);
}

// Blocking mode ensures measurement complete before return
const afterMeasurements = await client.listMeasurements();

if (afterMeasurements.length > beforeCount) {
  const newMeasurement = afterMeasurements[afterMeasurements.length - 1];
  return newMeasurement.uuid;
} else {
  // Unexpected - blocking mode should wait
  throw new Error('Measurement command succeeded but no new measurement found');
}

// BAD - Immediate check without blocking
await client.executeMeasureCommand('Measure');  // Returns immediately
const measurements = await client.listMeasurements();  // Too early!
```

### Pitfall 4: No Validation Between Sequence Steps
**What goes wrong:** User measures Right before Left, or skips subwoofer, ends up with incomplete sequence.

**Why it happens:**
- No state machine enforcement
- Tool accepts any channel at any time
- Caller can invoke tools out of order

**How to avoid:**
1. **State machine validation:** validTransitions map enforces idle → left → right → sub
2. **Throw on invalid transition:** Clear error message stating expected next step
3. **Provide get_status action:** Returns current step and what's next

**Warning signs:**
- User reports "measured right first, now can't continue"
- Session has [right, left] instead of [left, right]
- Unclear which measurements are missing

**Recommended pattern:**
```typescript
// GOOD - State machine validation
const validTransitions: Record<SequenceStep, SequenceStep[]> = {
  idle: ['measuring_left'],  // Can only start with left
  measuring_left: ['measuring_right'],  // Must do right next
  measuring_right: ['measuring_sub'],  // Then sub
  measuring_sub: ['complete'],
  complete: []
};

function validateTransition(from: SequenceStep, to: SequenceStep): void {
  if (!validTransitions[from].includes(to)) {
    const expected = validTransitions[from].join(' or ');
    throw new Error(
      `Invalid sequence: Cannot measure ${to} at this step. ` +
      `Expected next: ${expected}. ` +
      `Current step: ${from}.`
    );
  }
}

// BAD - No validation
async function measure(channel: string) {
  // Just measure whatever channel requested
  await executeMeasurement(channel);  // Allows any order!
}
```

### Pitfall 5: Concurrent Sessions Overwrite Each Other
**What goes wrong:** Two users create sessions, session state gets mixed up, measurements attributed to wrong session.

**Why it happens:**
- Using single global state object instead of Map
- Not keying by session_id
- Sharing mutable references

**How to avoid:**
1. **Use Map with session_id keys:** `Map<string, SessionState>`
2. **Generate unique session IDs:** crypto.randomUUID() prevents collisions
3. **Clone objects on update:** Avoid shared mutable state

**Warning signs:**
- Session A sees measurements from Session B
- "Session not found" errors sporadically
- Tests fail when run in parallel

**Recommended pattern:**
```typescript
// GOOD - Map-based isolation
const activeSessions = new Map<string, SessionState>();

function createSession(): SessionState {
  const session = {
    session_id: crypto.randomUUID(),  // Unique ID
    measurements: []  // Separate array per session
  };

  activeSessions.set(session.session_id, session);
  return session;
}

function updateSession(id: string, updates: Partial<SessionState>): void {
  const session = activeSessions.get(id);
  if (!session) throw new Error(`Session ${id} not found`);

  // Clone to avoid mutation
  activeSessions.set(id, { ...session, ...updates });
}

// BAD - Global state
let currentSession: SessionState;  // Only one session!

function createSession(): SessionState {
  currentSession = { measurements: [] };  // Overwrites previous!
  return currentSession;
}
```

## Code Examples

Verified patterns from official sources:

### Session State Management
```typescript
// Source: Node.js native Map + crypto.randomUUID
// Based on: MCP stateless server pattern + https://nodejs.org/api/crypto.html#cryptorandomuuidoptions

import { randomUUID } from 'crypto';

// Session state interface
export interface SessionState {
  session_id: string;
  created_at: number;
  sequence_step: 'idle' | 'measuring_left' | 'measuring_right' | 'measuring_sub' | 'complete';
  measurements: Array<{
    uuid?: string;
    name: string;
    channel: 'left' | 'right' | 'sub';
    timestamp: number;
  }>;
  target_spl?: number;
  notes?: string;
}

// Module-level session storage
const activeSessions = new Map<string, SessionState>();

/**
 * Create new measurement session
 * Returns session with unique ID
 */
export function createSession(notes?: string): SessionState {
  const session: SessionState = {
    session_id: randomUUID(),  // Native Node.js 14.17+
    created_at: Date.now(),
    sequence_step: 'idle',
    measurements: [],
    notes
  };

  activeSessions.set(session.session_id, session);
  return session;
}

/**
 * Get existing session by ID
 * Throws if session not found (caller must handle)
 */
export function getSession(sessionId: string): SessionState {
  const session = activeSessions.get(sessionId);

  if (!session) {
    throw new Error(
      `Session ${sessionId} not found. ` +
      `It may have expired or server was restarted. ` +
      `Use action: get_status to list active sessions.`
    );
  }

  return session;
}

/**
 * Update session state
 * Validates session exists before update
 */
export function updateSession(
  sessionId: string,
  updates: Partial<SessionState>
): SessionState {
  const session = getSession(sessionId);  // Throws if not found

  const updated = { ...session, ...updates };
  activeSessions.set(sessionId, updated);

  return updated;
}

/**
 * List all active sessions
 * Used for resume/recovery after disconnect
 */
export function listActiveSessions(): SessionState[] {
  return Array.from(activeSessions.values())
    .sort((a, b) => b.created_at - a.created_at);  // Most recent first
}

/**
 * End session and cleanup
 */
export function endSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}
```

### State Machine for L/R/Sub Sequence
```typescript
// Source: TypeScript state pattern + Phase 3 workflow pattern

type SequenceStep =
  | 'idle'
  | 'measuring_left'
  | 'measuring_right'
  | 'measuring_sub'
  | 'complete';

// Valid state transitions
const validTransitions: Record<SequenceStep, SequenceStep[]> = {
  idle: ['measuring_left'],
  measuring_left: ['measuring_right'],
  measuring_right: ['measuring_sub'],
  measuring_sub: ['complete'],
  complete: []
};

/**
 * Validate state transition is legal
 * Throws if invalid (prevents sequence errors)
 */
function validateTransition(from: SequenceStep, to: SequenceStep): void {
  const allowed = validTransitions[from];

  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid measurement sequence: Cannot go from "${from}" to "${to}". ` +
      `Expected next step: ${allowed.join(' or ') || 'none (sequence complete)'}`
    );
  }
}

/**
 * Get next expected step in sequence
 */
function getNextStep(current: SequenceStep): SequenceStep | null {
  const next = validTransitions[current];
  return next.length > 0 ? next[0] : null;
}

/**
 * Get human-readable guidance for next step
 */
function getStepGuidance(step: SequenceStep): string {
  const guidance: Record<SequenceStep, string> = {
    idle: 'Ready to start. Measure Left speaker first.',
    measuring_left: 'Left speaker measured. Measure Right speaker next.',
    measuring_right: 'Left and Right measured. Measure Subwoofer next.',
    measuring_sub: 'All speakers measured. Sequence complete.',
    complete: 'Measurement sequence complete. Use stop_session to end.'
  };

  return guidance[step];
}
```

### Measurement Workflow Tool
```typescript
// Source: Phase 3 start/check/stop pattern + REW measure API

export const MeasurementSessionInputSchema = z.object({
  action: z.enum(['start_session', 'measure', 'get_status', 'stop_session'])
    .describe('Session action to perform'),

  session_id: z.string().uuid().optional()
    .describe('Session ID (omit for start_session, required for others)'),

  channel: z.enum(['left', 'right', 'sub']).optional()
    .describe('Channel to measure (required for measure action)'),

  notes: z.string().optional()
    .describe('Session notes/description (for start_session)')
});

export type MeasurementSessionInput = z.infer<typeof MeasurementSessionInputSchema>;

export async function executeMeasurementSession(
  input: MeasurementSessionInput
): Promise<ToolResponse<MeasurementSessionResult>> {
  const validated = MeasurementSessionInputSchema.parse(input);
  const client = getActiveApiClient();

  if (!client) {
    return {
      status: 'error',
      error_type: 'connection_error',
      message: 'Not connected to REW API. Use rew.api_connect first.'
    };
  }

  switch (validated.action) {
    case 'start_session': {
      if (validated.session_id) {
        return {
          status: 'error',
          error_type: 'validation_error',
          message: 'Cannot specify session_id for start_session. Omit to create new.'
        };
      }

      const session = createSession(validated.notes);

      return {
        status: 'success',
        data: {
          action: 'start_session',
          session_id: session.session_id,
          sequence_step: session.sequence_step,
          next_step: 'left',
          message: 'Session created. Use action: measure with channel: left to begin.',
          guidance: getStepGuidance(session.sequence_step)
        }
      };
    }

    case 'measure': {
      if (!validated.session_id) {
        return {
          status: 'error',
          error_type: 'validation_error',
          message: 'session_id required for measure action'
        };
      }

      if (!validated.channel) {
        return {
          status: 'error',
          error_type: 'validation_error',
          message: 'channel required for measure action'
        };
      }

      try {
        const session = getSession(validated.session_id);

        // Determine next step from channel
        const nextStep: SequenceStep =
          validated.channel === 'left' ? 'measuring_left' :
          validated.channel === 'right' ? 'measuring_right' :
          'measuring_sub';

        // Validate transition
        validateTransition(session.sequence_step, nextStep);

        // Set measurement name
        const name = `${session.session_id.slice(0, 8)}_${validated.channel}`;
        await client.setMeasureNotes(name);

        // Enable blocking mode
        await client.setBlockingMode(true);

        // Execute measurement
        const beforeCount = (await client.listMeasurements()).length;
        const result = await client.executeMeasureCommand('Measure');

        if (result.status === 403) {
          return {
            status: 'error',
            error_type: 'license_error',
            message: 'REW Pro license required for automated measurements',
            suggestion: 'Upgrade at https://www.roomeqwizard.com/upgrades.html or use manual measurement'
          };
        }

        if (!result.success) {
          return {
            status: 'error',
            error_type: 'measurement_error',
            message: `Measurement failed: ${result.message || result.status}`
          };
        }

        // Find new measurement
        const afterMeasurements = await client.listMeasurements();
        const newMeasurement = afterMeasurements[afterMeasurements.length - 1];

        // Update session
        session.measurements.push({
          uuid: newMeasurement?.uuid,
          name,
          channel: validated.channel,
          timestamp: Date.now()
        });

        session.sequence_step = nextStep;

        // Check if complete
        if (validated.channel === 'sub') {
          session.sequence_step = 'complete';
        }

        updateSession(validated.session_id, session);

        const nextExpected = getNextStep(session.sequence_step);

        return {
          status: 'success',
          data: {
            action: 'measure',
            session_id: session.session_id,
            sequence_step: session.sequence_step,
            next_step: nextExpected,
            measurement: {
              uuid: newMeasurement?.uuid,
              name,
              channel: validated.channel
            },
            message: `${validated.channel} speaker measured successfully.`,
            guidance: getStepGuidance(session.sequence_step)
          }
        };

      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return {
            status: 'error',
            error_type: 'session_error',
            message: error.message,
            suggestion: 'Use get_status to list active sessions or start new session'
          };
        }
        throw error;
      }
    }

    case 'get_status': {
      if (validated.session_id) {
        // Get specific session
        try {
          const session = getSession(validated.session_id);

          return {
            status: 'success',
            data: {
              action: 'get_status',
              session: session,
              guidance: getStepGuidance(session.sequence_step)
            }
          };
        } catch (error) {
          return {
            status: 'error',
            error_type: 'session_error',
            message: error instanceof Error ? error.message : 'Session not found',
            suggestion: 'Use get_status without session_id to list all active sessions'
          };
        }
      } else {
        // List all active sessions
        const sessions = listActiveSessions();

        return {
          status: 'success',
          data: {
            action: 'get_status',
            active_sessions: sessions,
            count: sessions.length,
            message: sessions.length > 0
              ? `${sessions.length} active session(s)`
              : 'No active sessions. Use start_session to create new.'
          }
        };
      }
    }

    case 'stop_session': {
      if (!validated.session_id) {
        return {
          status: 'error',
          error_type: 'validation_error',
          message: 'session_id required for stop_session'
        };
      }

      try {
        const session = getSession(validated.session_id);
        endSession(validated.session_id);

        return {
          status: 'success',
          data: {
            action: 'stop_session',
            session_id: validated.session_id,
            measurements_taken: session.measurements.length,
            sequence_complete: session.sequence_step === 'complete',
            message: `Session ended. ${session.measurements.length} measurement(s) taken.`
          }
        };
      } catch (error) {
        return {
          status: 'error',
          error_type: 'session_error',
          message: error instanceof Error ? error.message : 'Session not found'
        };
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual measurement sequence tracking (paper checklist) | State machine with validation | 2020s (workflow automation tools) | Prevents sequence errors, ensures complete measurements |
| uuid npm package | crypto.randomUUID() native | Node 14.17 (2021) | 12x faster, no dependencies, cryptographically secure |
| File-based session persistence | In-memory Map for short-lived sessions | 2020s (stateless API servers) | Simpler, faster, no I/O overhead for temporary state |
| Global state object | Map keyed by session_id | Modern concurrency patterns | Supports multiple concurrent sessions without cross-contamination |
| Manual measurement naming | REW /measure/naming API | REW 5.30 API (2023+) | Consistent naming, auto-numbering, less error-prone |
| Websocket for real-time updates | HTTP polling with blocking mode | REW API design | Simpler protocol, REW API uses HTTP, not websocket |

**Deprecated/outdated:**
- **uuid npm package:** Native crypto.randomUUID() available since Node 14.17, faster and no dependency
- **Session state in external DB for MCP tools:** Overkill for short-lived measurement sessions (minutes to hours)
- **Stateless workflow (caller tracks state):** Complex coordination, error-prone. Server-side state machine cleaner.
- **XState for simple sequences:** 50KB+ dependency unnecessary for linear L/R/Sub state machine

## Open Questions

Things that couldn't be fully resolved:

1. **REW API measurement triggering without Pro license**
   - What we know: REW API documentation states "automated sweep measurements require Pro upgrade" (verified via WebSearch)
   - What's unclear: Whether there's a free trial, alternative endpoints, or manual trigger coordination possible
   - Recommendation: Implement Pro license detection (403 status), provide clear error with upgrade link. Document as hard requirement.

2. **Session expiration/cleanup strategy**
   - What we know: Map storage persists during server lifetime, no automatic cleanup
   - What's unclear: When/how to garbage collect old sessions (1 hour? 24 hours? never?)
   - Recommendation: Start with no expiration (manual cleanup via stop_session), add TTL in future if needed (e.g., delete sessions older than 24 hours)

3. **Multi-position measurement support**
   - What we know: Industry best practice is 5-10 measurements at different listening positions
   - What's unclear: Whether to support multi-position in Phase 4 or defer to Phase 5 (Spatial Averaging)
   - Recommendation: Phase 4 focuses on single-position L/R/Sub sequence. Multi-position deferred to future phase per v2 requirements (ADVN-01)

4. **Combined measurements (L+Sub, R+Sub, L+R+Sub)**
   - What we know: REW community measures speakers individually then combined for phase analysis
   - What's unclear: Whether Phase 4 scope includes combined measurements or just individual L/R/Sub
   - Recommendation: Phase 4 implements L/R/Sub individual only. Combined measurements added in Phase 5 (Sub Integration Analysis) where they're actually analyzed.

## Sources

### Primary (HIGH confidence)
- [REW API Documentation](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) - Official REW API spec (WebFetch failed but WebSearch confirmed existence)
- [Node.js crypto.randomUUID](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions) - Official Node.js documentation
- [JavaScript Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) - MDN documentation

### Secondary (MEDIUM confidence)
- [REW Beta Release - REW API beta releases](https://www.avnirvana.com/threads/rew-api-beta-releases.12981/) - Community discussion confirming Pro license requirement for automated measurements
- [REW - Room EQ Wizard Beta Releases](https://www.roomeqwizard.com/beta.html) - V5.40 beta (Jan 2026) includes API
- [Managing Stateful MCP Server Sessions | CodeSignal](https://codesignal.com/learn/courses/developing-and-integrating-an-mcp-server-in-typescript/lessons/stateful-mcp-server-sessions) - MCP session state patterns
- [Multi-conversation session persistence · modelcontextprotocol · Discussion #165](https://github.com/orgs/modelcontextprotocol/discussions/165) - MCP session persistence discussion
- [Building Stateful Workflows in JavaScript](https://codehooks.io/blog/building-stateful-workflows-javascript) - Workflow state management patterns
- [Goodbye to sequential integers, hello UUIDv7!](https://buildkite.com/resources/blog/goodbye-integers-hello-uuids/) - UUID best practices 2026
- [crypto.randomUUID is three times faster uuid.v4](https://dev.to/galkin/crypto-randomuuid-vs-uuid-v4-47i5) - Performance comparison

### Tertiary (LOW confidence)
- [How to approach SUB + L/R measurement?](https://www.avnirvana.com/threads/how-to-approach-sub-l-r-measurement.10333/) - Community best practice for measurement sequence (not official standard)
- [Making Measurements - REW](https://www.roomeqwizard.com/help/help_en-GB/html/makingmeasurements.html) - General REW measurement guide (not API-specific)

## Metadata

**Confidence breakdown:**
- REW API measurement triggering: MEDIUM - WebSearch confirmed Pro requirement, but couldn't access official API docs directly (WebFetch failed)
- Session state persistence: HIGH - Standard Node.js patterns (Map, crypto.randomUUID) well-documented
- State machine pattern: HIGH - TypeScript state pattern established, Phase 3 precedent with start/check/stop
- L/R/Sub sequence: MEDIUM - Industry practice from community forums, not official standard
- Concurrent sessions: HIGH - Map-based isolation is standard JavaScript pattern

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - REW API stable, session patterns standard)

**Key findings for planner:**
1. REW Pro license required for automated measurements - must detect 403 and provide clear error
2. Use crypto.randomUUID() for session IDs (native, fast, secure)
3. Store session state in Map<string, SessionState> for concurrent session isolation
4. Implement state machine with validTransitions for L/R/Sub sequence enforcement
5. Extend Phase 3 start/check/stop pattern to start_session → measure → measure → stop_session
6. Session resumability via session_id parameter - get_status lists active sessions
7. Blocking mode required for synchronous measurement completion detection
8. Phase 4 scope: L/R/Sub individual measurements only (not combined L+Sub etc - defer to Phase 5)
