# Phase 1: Core API + MCP Validation - Research

**Researched:** 2026-01-21
**Domain:** MCP Server + REW API Integration
**Confidence:** HIGH

## Summary

Phase 1 validates the foundation of the REW MCP server: proper MCP registration, reliable REW API connectivity, and structured error propagation. Current analysis shows the server **mostly works correctly** but has critical gaps that block confident deployment.

**Current state:** Server registers 18 tools with clean MCP compliance (resources/prompts capabilities already removed per audit). API client has good error messages for connection failures. Tools check for null returns and convert to error responses. However, **zero integration tests** exist—all 157 passing tests are unit tests for analysis functions. API client has 21 methods that return `null` on any error, masking root causes. Tool handlers don't distinguish between "measurement not found" (404) vs "REW crashed" (connection error).

**Primary recommendation:** Add HTTP-level integration tests with MSW to verify the complete error propagation path (REW API → client → tool → MCP response). Fix API client to throw typed errors instead of returning null. Validate that `isError: true` reaches MCP clients for all failure modes.

## Standard Stack

The server already uses the correct testing stack. MSW is the missing piece for API integration testing.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 2.1.9 | Test runner | Native ESM, TypeScript-first, faster than Jest. Current 157 tests pass. |
| @modelcontextprotocol/sdk | 1.25.3 | MCP server + client | Official SDK. Provides both server (production) and Client+InMemoryTransport (testing). |
| Zod | 3.25.76 | Schema validation | Runtime validation for tool inputs. Already used throughout codebase. |
| zod-to-json-schema | 3.25.1 | MCP schema generation | Converts Zod schemas to JSON Schema for MCP tool registration. |

### Missing (Required for Phase 1)
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|-----------|
| MSW | ^2.6.0 | HTTP request mocking | Mock REW API at HTTP layer (not function layer). Type-safe, reusable handlers. **This is the standard for Node.js API mocking in 2026.** Replaces nock/undici mocks. |

### Installation

```bash
npm install -D msw@^2.6.0
```

No other dependencies needed. Vitest, SDK, and Zod already installed.

## Architecture Patterns

### Current MCP Registration (src/index.ts - 60 lines)

**Status: CORRECT**

```typescript
const server = new Server(
  {
    name: 'rew-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {
        listChanged: true  // Only declared capability
      },
      logging: {}
    }
  }
);
```

**Why correct:**
- No unused `resources: {}` or `prompts: {}` declarations (audit finding already fixed)
- `listChanged: true` indicates dynamic tool list (not needed but harmless)
- Follows MCP spec 2025-06-18 "only declare what you implement"

**No changes needed** for registration.

### Current Error Propagation Pattern

**Pattern in tools (src/tools/api-get-measurement.ts):**

```typescript
export async function executeApiGetMeasurement(input): Promise<ToolResponse<Result>> {
  try {
    const client = getActiveApiClient();
    if (!client || !client.isConnected()) {
      return {
        status: 'error',
        error_type: 'not_connected',
        message: 'Not connected to REW API',
        suggestion: 'Use rew.api_connect to establish a connection first'
      };
    }

    const measurementData = await client.getMeasurement(uuid);
    if (!measurementData) {  // ← Problem: can't distinguish 404 vs timeout
      return {
        status: 'error',
        error_type: 'measurement_not_found',
        message: `Measurement not found: ${uuid}`,
        suggestion: 'Use rew.api_list_measurements to see available measurements'
      };
    }

    const frequencyResponse = await client.getFrequencyResponse(uuid, options);
    if (!frequencyResponse || frequencyResponse.frequencies_hz.length === 0) {
      return {
        status: 'error',
        error_type: 'no_data',
        message: 'Could not retrieve frequency response data from REW',
        suggestion: 'Ensure the measurement contains frequency response data'
      };
    }

    // Success path
    return { status: 'success', data: { ... } };
  } catch (error) {
    // Unexpected errors
    return {
      status: 'error',
      error_type: 'internal_error',
      message: error.message
    };
  }
}
```

**Pattern in MCP handler (src/tools/index.ts:226-233):**

```typescript
return {
  content: [{
    type: 'text',
    text: JSON.stringify(result.status === 'success' ? result.data : result)
  }],
  isError: result.status === 'error'  // ← Converts tool error to MCP error flag
};
```

**Why mostly correct:**
- Tools return structured `ToolResponse<T>` with `status: 'error'` for failures
- MCP handler sets `isError: true` when `result.status === 'error'`
- Top-level try/catch prevents uncaught exceptions from crashing server

**Gap:** API client returns `null` on any error (21 locations). Tools check for null but can't distinguish:
- 404 (measurement doesn't exist)
- 0 (REW not running)
- 408 (timeout)
- 500 (REW internal error)

All become generic "measurement not found" or "could not retrieve data" errors.

### Recommended Error Propagation Pattern

**API client should throw typed errors:**

```typescript
// src/api/rew-client.ts
export class REWApiError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'CONNECTION_REFUSED' | 'TIMEOUT' | 'INTERNAL_ERROR',
    public httpStatus: number
  ) {
    super(message);
    this.name = 'REWApiError';
  }
}

async getMeasurement(uuid: string): Promise<MeasurementData> {
  const response = await this.request('GET', `/measurements/${uuid}`);

  if (response.status === 0) {
    throw new REWApiError('REW not running or API not enabled', 'CONNECTION_REFUSED', 0);
  }
  if (response.status === 404) {
    throw new REWApiError(`Measurement not found: ${uuid}`, 'NOT_FOUND', 404);
  }
  if (response.status === 408) {
    throw new REWApiError('Request timeout', 'TIMEOUT', 408);
  }
  if (response.status !== 200) {
    throw new REWApiError(
      `Unexpected status ${response.status}: ${response.error}`,
      'INTERNAL_ERROR',
      response.status
    );
  }

  // Never returns null - always throws or returns valid data
  return {
    uuid: response.data.uuid || uuid,
    name: response.data.name || 'Unknown',
    metadata: { ... }
  };
}
```

**Tools catch typed errors:**

```typescript
try {
  const measurementData = await client.getMeasurement(uuid);
  // measurementData is guaranteed valid - no null check needed
} catch (error) {
  if (error instanceof REWApiError) {
    return {
      status: 'error',
      error_type: error.code.toLowerCase(),  // 'not_found', 'connection_refused', etc.
      message: error.message,
      suggestion: getSuggestionForErrorCode(error.code)
    };
  }
  throw error;  // Re-throw unexpected errors
}
```

### Project Structure (Current - No Changes Needed)

```
src/
├── index.ts                  # MCP server entry point (60 lines)
├── api/
│   ├── rew-client.ts         # REW API HTTP client (1061 lines)
│   ├── rew-client.test.ts    # ← NEW - Integration tests with MSW
│   └── base64-decoder.ts     # Base64 float array decoder
├── tools/
│   ├── index.ts              # Tool registration (249 lines)
│   ├── api-connect.ts        # rew.api_connect
│   ├── api-get-measurement.ts
│   ├── api-list-measurements.ts
│   └── ... (15 more tool files, 18 total tools)
├── analysis/
│   ├── peaks-nulls.ts
│   ├── peaks-nulls.test.ts   # Unit tests (8 tests passing)
│   ├── decay.ts
│   ├── decay.test.ts         # Unit tests (24 tests passing)
│   └── ... (7 more analysis modules with tests)
├── parser/
│   ├── rew-text.ts
│   └── rew-text.test.ts      # Unit tests (9 tests passing)
├── store/
│   └── measurement.ts        # In-memory measurement storage
└── types/
    └── index.ts              # TypeScript type definitions
```

**Test coverage:**
- Analysis functions: 90%+ (157 tests passing)
- API client: 0% (no tests)
- Tool handlers: 0% (no tests)
- MCP registration: 0% (no tests)

## Don't Hand-Roll

Problems with existing solutions that shouldn't be reimplemented:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request mocking | Custom mock objects that replace client methods | MSW with http.get/http.post handlers | Function mocks hide HTTP errors. MSW mocks at network layer, catches URL construction bugs, header issues, response parsing. |
| MCP client for testing | Custom protocol implementation | `@modelcontextprotocol/sdk` Client + InMemoryTransport | SDK already provides Client for testing. InMemoryTransport pipes server to client in-process without sockets. |
| Error type discrimination | String parsing of error messages | TypeScript custom error classes | Client returns null, tools parse message to guess error type. Use Error subclasses with `instanceof` checks. |
| API schema validation | Manual type assertions | Zod runtime validation | Already used for tool inputs. Extend to API responses to catch REW version mismatches. |

**Key insight:** The gap isn't missing tools—it's missing **integration test coverage** and **typed error propagation**. Current code structure is sound, but untested error paths mean silent failures reach production.

## Common Pitfalls

### Pitfall 1: Silent API Failures (Already Identified, Needs Testing)

**What goes wrong:** REW API call fails (timeout, 404, connection refused), client returns `null`, tool checks null and reports generic error. LLM receives "measurement not found" when actual problem is "REW crashed."

**Current mitigation:** Connection errors get good messages from `connect()` method (lines 167-258 in rew-client.ts). But measurement retrieval silently returns null (line 353).

**How to validate:**
```typescript
// src/api/rew-client.test.ts
it('should throw NOT_FOUND error when measurement does not exist', async () => {
  server.use(
    http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
      return new HttpResponse(null, { status: 404 });
    })
  );

  await expect(client.getMeasurement('nonexistent')).rejects.toThrow(REWApiError);
  await expect(client.getMeasurement('nonexistent')).rejects.toMatchObject({
    code: 'NOT_FOUND',
    httpStatus: 404
  });
});

it('should throw CONNECTION_REFUSED when REW not running', async () => {
  server.use(
    http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
      return HttpResponse.error();  // Network error
    })
  );

  await expect(client.getMeasurement('any')).rejects.toMatchObject({
    code: 'CONNECTION_REFUSED',
    httpStatus: 0
  });
});
```

**Warning signs in Phase 1:**
- Tests pass but tools fail when manually testing with REW
- Generic "not found" errors for different failure types
- Debugging requires reading REW logs instead of MCP error messages

### Pitfall 2: MCP `isError` Flag Not Set

**What goes wrong:** Tool returns `status: 'error'` but MCP handler doesn't set `isError: true`. Claude treats response as success, hallucinates results.

**Current protection:** MCP handler (src/tools/index.ts:232) correctly maps `result.status === 'error'` to `isError: true`.

**How to validate:**
```typescript
// src/tools/api-get-measurement.integration.test.ts
it('should return isError: true when measurement not found', async () => {
  server.use(
    http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
      return new HttpResponse(null, { status: 404 });
    })
  );

  const response = await mcpClient.callTool({
    name: 'rew.api_get_measurement',
    arguments: { measurement_uuid: 'nonexistent' }
  });

  expect(response.isError).toBe(true);
  const result = JSON.parse(response.content[0].text);
  expect(result.status).toBe('error');
  expect(result.error_type).toBe('not_found');
});
```

**Warning signs in Phase 1:**
- Claude says "I analyzed the measurement" when fetch failed
- No error shown to user despite failure
- `isError: false` in MCP Inspector when tool should fail

### Pitfall 3: Testing with Function Mocks Instead of HTTP Mocks

**What goes wrong:** Unit tests mock `client.getMeasurement()` to return fake data. Tests pass. Production fails because real API returns different JSON structure or different HTTP headers.

**Prevention:** Mock at HTTP layer with MSW, not function layer:

```typescript
// BAD: Function-level mock
vi.mock('./api/rew-client.js');
client.getMeasurement.mockResolvedValue({ uuid: '123', name: 'Test' });

// GOOD: HTTP-level mock
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('http://127.0.0.1:4735/measurements/:uuid', ({ params }) => {
    return HttpResponse.json({
      uuid: params.uuid,
      name: 'Test Measurement',
      sampleRate: 48000
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Why HTTP mocking catches more bugs:**
- URL construction errors (wrong path, missing query params)
- Header issues (missing Accept, wrong Content-Type)
- Response parsing bugs (expecting field that doesn't exist)
- Timeout handling (MSW can delay responses)
- Network errors (MSW can return `HttpResponse.error()`)

### Pitfall 4: No MCP End-to-End Integration Test

**What goes wrong:** API client tests pass, tool handler tests pass, but MCP protocol integration fails (wrong JSON structure, missing fields).

**Prevention:** Test full MCP protocol flow:

```typescript
// src/tools/index.integration.test.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../index.js';

it('should handle complete tool call flow', async () => {
  // Set up in-memory transport (no sockets/stdio)
  const [clientTransport, serverTransport] = InMemoryTransport.create();

  const server = createServer();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' }, {});
  await client.connect(clientTransport);

  // List tools
  const tools = await client.listTools();
  expect(tools.tools).toHaveLength(18);
  expect(tools.tools.find(t => t.name === 'rew.api_connect')).toBeDefined();

  // Call tool (with MSW mocking REW API)
  server.use(
    http.get('http://127.0.0.1:4735/doc.json', () => {
      return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
    })
  );

  const response = await client.callTool({
    name: 'rew.api_connect',
    arguments: {}
  });

  expect(response.isError).toBe(false);
  const result = JSON.parse(response.content[0].text);
  expect(result.status).toBe('success');
  expect(result.data.connected).toBe(true);
});
```

### Pitfall 5: Type Erasure with `any` (Already Identified)

**Current state:** 38 instances of `any` type across codebase (per CONCERNS.md). Concentrated in:
- `src/tools/index.ts` (lines 153-217): Every tool handler casts `args as any`
- `src/api/rew-client.ts` (8 instances): Response data typed as `any`

**Impact on Phase 1:** TypeScript can't catch:
- Wrong argument passed to tool handler (e.g., passing `api-get-measurement` args to `api-list-measurements`)
- Missing required field in tool result
- API response field renamed (REW version update)

**Phase 1 fix:** Replace `args as any` with proper typing:

```typescript
// Current (unsafe)
case 'rew.api_get_measurement':
  result = await executeApiGetMeasurement(args as any);
  break;

// Phase 1 (type-safe)
case 'rew.api_get_measurement': {
  const validated = ApiGetMeasurementInputSchema.parse(args);
  result = await executeApiGetMeasurement(validated);
  break;
}
```

Zod already validates at runtime. This adds compile-time checking.

## Code Examples

### Pattern 1: API Client Integration Test with MSW

```typescript
// src/api/rew-client.test.ts (NEW FILE)
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { REWApiClient, REWApiError } from './rew-client.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('REWApiClient', () => {
  describe('connect()', () => {
    it('should connect successfully when REW is running', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.json({
            info: { version: '5.30.9' },
            openapi: '3.0.0',
            paths: {}
          });
        }),
        http.get('http://127.0.0.1:4735/measurements', () => {
          return HttpResponse.json([
            { uuid: 'test-1', name: 'Left', type: 'SPL' }
          ]);
        }),
        http.get('http://127.0.0.1:4735/application', () => {
          return HttpResponse.json({ version: '5.30.9', proFeatures: true });
        }),
        http.get('http://127.0.0.1:4735/application/blocking', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(true);
      expect(status.rew_version).toBe('5.30.9');
      expect(status.measurements_available).toBe(1);
      expect(status.api_capabilities.pro_features).toBe(true);
    });

    it('should return error when REW not running', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return HttpResponse.error();
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(false);
      expect(status.error_message).toContain('Cannot connect to REW');
      expect(status.error_message).toContain('Ensure REW is running');
    });

    it('should handle 404 from old REW version', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/doc.json', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();
      const status = await client.connect();

      expect(status.connected).toBe(false);
      expect(status.error_message).toContain('HTTP 404');
      expect(status.error_message).toContain('REW version is too old');
    });
  });

  describe('getMeasurement()', () => {
    it('should throw NOT_FOUND when measurement does not exist', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const client = new REWApiClient();

      await expect(client.getMeasurement('nonexistent'))
        .rejects.toThrow(REWApiError);

      try {
        await client.getMeasurement('nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(REWApiError);
        expect((error as REWApiError).code).toBe('NOT_FOUND');
        expect((error as REWApiError).httpStatus).toBe(404);
      }
    });

    it('should return measurement data when found', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid', ({ params }) => {
          return HttpResponse.json({
            uuid: params.uuid,
            name: 'Left Main',
            sampleRate: 48000,
            startTime: '2026-01-21T10:00:00Z',
            notes: 'Test measurement'
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getMeasurement('test-uuid-1');

      expect(data.uuid).toBe('test-uuid-1');
      expect(data.name).toBe('Left Main');
      expect(data.metadata.sample_rate_hz).toBe(48000);
    });
  });

  describe('getFrequencyResponse()', () => {
    it('should throw CONNECTION_REFUSED on network error', async () => {
      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.error();
        })
      );

      const client = new REWApiClient();

      await expect(client.getFrequencyResponse('any'))
        .rejects.toMatchObject({
          code: 'CONNECTION_REFUSED',
          httpStatus: 0
        });
    });

    it('should decode base64 arrays from REW API', async () => {
      // Base64-encoded float32 arrays (REW API format)
      const freqBase64 = 'AAAAQAAAgEAAAKBA';  // [2.0, 4.0, 5.0]
      const splBase64 = 'AABIQgAASkIAAEpC';   // [50.0, 50.5, 50.5]

      server.use(
        http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
          return HttpResponse.json({
            frequencies: freqBase64,
            magnitude: splBase64,
            phase: freqBase64
          });
        })
      );

      const client = new REWApiClient();
      const data = await client.getFrequencyResponse('test');

      expect(data.frequencies_hz.length).toBe(3);
      expect(data.spl_db.length).toBe(3);
      expect(data.phase_degrees.length).toBe(3);
    });
  });
});
```

### Pattern 2: Tool Handler Integration Test

```typescript
// src/tools/api-get-measurement.integration.test.ts (NEW FILE)
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { executeApiGetMeasurement } from './api-get-measurement.js';
import { REWApiClient } from '../api/rew-client.js';
import { setActiveApiClient } from './api-connect.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('executeApiGetMeasurement', () => {
  it('should return error when not connected', async () => {
    setActiveApiClient(null);

    const result = await executeApiGetMeasurement({
      measurement_uuid: 'test',
      smoothing: 'none'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('not_connected');
    expect(result.message).toContain('Not connected to REW API');
  });

  it('should return error when measurement not found', async () => {
    server.use(
      http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const client = new REWApiClient();
    setActiveApiClient(client);

    const result = await executeApiGetMeasurement({
      measurement_uuid: 'nonexistent',
      smoothing: 'none'
    });

    expect(result.status).toBe('error');
    expect(result.error_type).toBe('not_found');
    expect(result.message).toContain('Measurement not found');
  });

  it('should successfully fetch and store measurement', async () => {
    server.use(
      http.get('http://127.0.0.1:4735/measurements/:uuid', () => {
        return HttpResponse.json({
          uuid: 'test-uuid',
          name: 'Left Main',
          sampleRate: 48000
        });
      }),
      http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', () => {
        const freq = Buffer.from(new Float32Array([20, 50, 100]).buffer).toString('base64');
        const spl = Buffer.from(new Float32Array([75, 80, 78]).buffer).toString('base64');
        return HttpResponse.json({
          frequencies: freq,
          magnitude: spl,
          phase: freq
        });
      })
    );

    const client = new REWApiClient();
    setActiveApiClient(client);

    const result = await executeApiGetMeasurement({
      measurement_uuid: 'test-uuid',
      smoothing: 'none',
      store_measurement: true
    });

    expect(result.status).toBe('success');
    expect(result.data?.measurement_uuid).toBe('test-uuid');
    expect(result.data?.measurement_name).toBe('Left Main');
    expect(result.data?.summary.data_points).toBeGreaterThan(0);
    expect(result.data?.stored).toBe(true);
  });
});
```

### Pattern 3: Full MCP Protocol Test

```typescript
// src/index.integration.test.ts (NEW FILE)
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerTools } from './tools/index.js';

const mswServer = setupServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('MCP Server Integration', () => {
  it('should register and list all 18 tools', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.create();

    const server = new Server(
      { name: 'rew-mcp', version: '1.0.0' },
      { capabilities: { tools: { listChanged: true }, logging: {} } }
    );
    registerTools(server);
    await server.connect(serverTransport);

    const client = new Client({ name: 'test', version: '1.0.0' }, {});
    await client.connect(clientTransport);

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(18);
    expect(tools.map(t => t.name)).toContain('rew.api_connect');
    expect(tools.map(t => t.name)).toContain('rew.api_get_measurement');
    expect(tools.map(t => t.name)).toContain('rew.ingest_measurement');
    expect(tools.map(t => t.name)).toContain('rew.analyze_room_modes');
  });

  it('should set isError: true when API call fails', async () => {
    mswServer.use(
      http.get('http://127.0.0.1:4735/doc.json', () => {
        return HttpResponse.error();
      })
    );

    const [clientTransport, serverTransport] = InMemoryTransport.create();

    const server = new Server(
      { name: 'rew-mcp', version: '1.0.0' },
      { capabilities: { tools: { listChanged: true }, logging: {} } }
    );
    registerTools(server);
    await server.connect(serverTransport);

    const client = new Client({ name: 'test', version: '1.0.0' }, {});
    await client.connect(clientTransport);

    const response = await client.callTool({
      name: 'rew.api_connect',
      arguments: {}
    });

    expect(response.isError).toBe(true);
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('error');
    expect(result.error_type).toBe('connection_failed');
  });

  it('should successfully connect and list measurements', async () => {
    mswServer.use(
      http.get('http://127.0.0.1:4735/doc.json', () => {
        return HttpResponse.json({ info: { version: '5.30.9' }, openapi: '3.0.0' });
      }),
      http.get('http://127.0.0.1:4735/measurements', () => {
        return HttpResponse.json([
          { uuid: 'uuid-1', name: 'Left', type: 'SPL' },
          { uuid: 'uuid-2', name: 'Right', type: 'SPL' }
        ]);
      }),
      http.get('http://127.0.0.1:4735/application', () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.get('http://127.0.0.1:4735/application/blocking', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const [clientTransport, serverTransport] = InMemoryTransport.create();

    const server = new Server(
      { name: 'rew-mcp', version: '1.0.0' },
      { capabilities: { tools: { listChanged: true }, logging: {} } }
    );
    registerTools(server);
    await server.connect(serverTransport);

    const client = new Client({ name: 'test', version: '1.0.0' }, {});
    await client.connect(clientTransport);

    // Connect
    const connectResponse = await client.callTool({
      name: 'rew.api_connect',
      arguments: {}
    });

    expect(connectResponse.isError).toBe(false);
    const connectResult = JSON.parse(connectResponse.content[0].text);
    expect(connectResult.data.connected).toBe(true);

    // List measurements
    const listResponse = await client.callTool({
      name: 'rew.api_list_measurements',
      arguments: {}
    });

    expect(listResponse.isError).toBe(false);
    const listResult = JSON.parse(listResponse.content[0].text);
    expect(listResult.data.measurements).toHaveLength(2);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for Node.js testing | Vitest | 2023-2024 | Faster, native ESM, better TypeScript support. REW-mcp already uses Vitest. |
| nock for HTTP mocking | MSW (Mock Service Worker) | 2024-2025 | Type-safe, works in Node and browser, reusable handlers. REW-mcp needs to add MSW. |
| Function-level mocking | HTTP-level mocking | 2025-2026 | Catches more bugs (URL construction, headers, response parsing). MSW enables this. |
| MCP custom testing harness | SDK InMemoryTransport | 2025 (SDK v1.0+) | Official SDK provides Client + InMemoryTransport for testing. No custom harness needed. |

**Deprecated/outdated:**
- **Null returns from API methods**: Modern pattern is throwing typed errors. Null returns hide error details.
- **Function-level mocks in integration tests**: Doesn't test HTTP layer. Use MSW for HTTP-level mocking.
- **Any types in tool handlers**: TypeScript strict mode is standard. Use proper typing with Zod validation.

## Open Questions

### 1. Should REW API client always throw errors, or return Result<T, Error> type?

**What we know:**
- Current code returns `null` on errors (21 locations)
- Tools check for null and convert to `ToolResponse<T>` error
- Throwing errors is more idiomatic TypeScript

**What's unclear:**
- Whether callers prefer try/catch (throws) vs if-check (Result type)
- Impact on code readability

**Recommendation:** Throw typed errors. Tools already have try/catch blocks (line 235-247 in tools/index.ts). Throwing preserves stack traces and forces error handling.

### 2. How deeply should API responses be validated with Zod?

**What we know:**
- Tool inputs already validated with Zod (all 18 tools)
- API responses not validated—assumed to match types
- REW API is external, could return unexpected data

**What's unclear:**
- Performance impact of validating every response
- Whether to validate top-level only or nested fields

**Recommendation:** Validate top-level structure only in Phase 1. Add deep validation if REW version mismatches occur in testing. Example:

```typescript
const MeasurementResponseSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sampleRate: z.number().optional(),
  // ... other fields
});

const data = MeasurementResponseSchema.parse(response.data);
```

### 3. Should test suite run against live REW instance in CI?

**What we know:**
- MSW mocks provide fast, reliable tests
- Live REW tests would catch API changes
- CI environment may not have REW installed

**What's unclear:**
- Frequency of REW API breaking changes
- Value of live integration tests vs cost

**Recommendation:** Phase 1 uses MSW only. Add optional live REW tests as manual script (not CI) for major version changes. Document: "Run `npm run test:live-rew` before updating supported REW version."

## Sources

### Primary (HIGH confidence)

- **MCP SDK Official Documentation**: [https://modelcontextprotocol.io/docs](https://modelcontextprotocol.io/docs) - Specification for capabilities, error handling, tool registration
- **MCP SDK GitHub**: [https://github.com/modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - InMemoryTransport usage for testing
- **MSW Official Documentation**: [https://mswjs.io/docs/](https://mswjs.io/docs/) - HTTP mocking patterns for Node.js
- **Vitest Documentation**: [https://vitest.dev/guide/](https://vitest.dev/guide/) - Integration testing with MSW
- **Zod Documentation**: [https://zod.dev/](https://zod.dev/) - Schema validation patterns

### Secondary (MEDIUM confidence)

- **.planning/research/STACK.md** (project file) - Testing stack research, MSW patterns
- **.planning/research/PITFALLS.md** (project file) - Silent API failures, MCP compliance violations
- **.planning/codebase/CONCERNS.md** (project file) - Current tech debt, test gaps, type safety issues

### Tertiary (LOW confidence)

- **Stack Overflow discussions on MSW vs nock** - Ecosystem consensus on modern HTTP mocking
- **TypeScript handbook on custom errors** - Error subclass patterns

## Metadata

**Confidence breakdown:**
- MCP registration pattern: HIGH - Current code correct, verified against spec
- Error propagation: HIGH - Pattern identified, fix path clear
- Testing stack: HIGH - MSW is standard for Node.js API mocking in 2026
- API client refactoring: MEDIUM - Requires touching 21 null return sites, needs careful testing
- Integration test coverage: HIGH - Clear patterns from official SDK examples

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable domain, REW API doesn't change frequently)

**Phase 1 success depends on:**
1. Adding MSW for HTTP-level mocking
2. Refactoring API client to throw typed errors (not return null)
3. Writing integration tests that verify complete error propagation path
4. Validating `isError: true` reaches MCP clients for all failure modes

**Quick wins for Phase 1:**
- MCP registration already correct (no changes needed)
- Tool error handling pattern already good (just needs testing)
- Base64 decoder already tested (15 tests passing)
- Analysis functions already tested (157 tests passing)

**Phase 1 blockers (must fix):**
- Zero integration tests for API client (blocks confident deployment)
- 21 null returns mask error details (blocks proper error handling)
- No MCP end-to-end tests (blocks protocol compliance validation)
