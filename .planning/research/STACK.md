# Technology Stack: MCP Server Testing & Validation

**Project:** REW MCP Server
**Researched:** 2026-01-21
**Confidence:** HIGH (verified with official docs, current ecosystem patterns)

## Context

This stack research addresses testing and validation infrastructure for an existing TypeScript MCP server with 18 tools that integrate with the REW (Room EQ Wizard) REST API. The server uses `@modelcontextprotocol/sdk` v1.25.2, Vitest 2.1.8, and Node.js 18+.

**Current state:** Analysis functions have unit tests, but zero integration tests for tool handlers or API connectivity.

**Goal:** Add comprehensive testing for tool registration, API integration, data round-trip, and analysis accuracy without requiring live REW instances during CI.

## Recommended Testing Stack

### Core Testing Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^2.1.8 | Test runner and unit testing | Already configured. Native ESM support, fast, TypeScript-first. Better than Jest for Node 18+ projects. |
| @vitest/coverage-v8 | ^2.1.8 | Code coverage | Already configured. V8 coverage is faster and more accurate than Istanbul for modern Node. |
| MSW (Mock Service Worker) | ^2.6.0 | HTTP mocking for REW API | **Recommended over alternatives.** Type-safe, works in both Node and browser, reusable handlers. Replaces nock/undici mocks. |
| @modelcontextprotocol/sdk | ^1.25.2 | MCP client for integration tests | SDK provides both server and client. Use Client + in-memory transport for testing tool handlers. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.23.8 | Schema validation testing | Already installed. Validate tool input/output schemas in tests. |
| happy-dom or jsdom | ^16.x or ^26.x | DOM environment (if needed) | Only if testing browser-based tool visualization features. Not needed for REW API integration. |

## Installation

```bash
# Add MSW for API mocking
npm install -D msw@^2.6.0

# No other additions needed - Vitest and SDK already installed
```

## Testing Architecture

### 1. Unit Tests (Existing Pattern - Continue)

**What:** Pure analysis functions without external dependencies.
**Location:** `src/analysis/*.test.ts`, `src/parser/*.test.ts`
**Pattern:** Direct function imports, synthetic data, no mocks.

```typescript
// Example: src/analysis/peaks-nulls.test.ts (already exists)
import { detectPeaks } from './peaks-nulls.js';
import type { FrequencyResponseData } from '../types/index.js';

it('should detect a clear peak', () => {
  const fr: FrequencyResponseData = {
    frequencies_hz: [20, 25, 30, 35, 40],
    spl_db: [80, 80, 95, 80, 80], // 15dB peak at 30Hz
    phase_degrees: [0, 0, 0, 0, 0]
  };

  const peaks = detectPeaks(fr, { threshold_db: 5 });
  expect(peaks.length).toBeGreaterThan(0);
  expect(peaks[0].frequency_hz).toBe(30);
});
```

**Coverage target:** 90%+ for analysis functions.

### 2. API Client Tests (NEW - High Priority)

**What:** Test `REWApiClient` methods with mocked HTTP responses.
**Location:** `src/api/rew-client.test.ts` (create)
**Pattern:** MSW handlers for REW API endpoints.

```typescript
// src/api/rew-client.test.ts (NEW FILE)
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { REWApiClient } from './rew-client.js';

// Define MSW handlers for REW API
const handlers = [
  http.get('http://127.0.0.1:4735/doc.json', () => {
    return HttpResponse.json({
      info: { version: '5.30.9' },
      openapi: '3.0.0'
    });
  }),

  http.get('http://127.0.0.1:4735/measurements', () => {
    return HttpResponse.json([
      { uuid: 'test-uuid-1', name: 'Left Main', type: 'SPL' },
      { uuid: 'test-uuid-2', name: 'Right Main', type: 'SPL' }
    ]);
  }),

  http.get('http://127.0.0.1:4735/measurements/:uuid/frequency-response', ({ params }) => {
    // Return base64-encoded float arrays per REW API spec
    return HttpResponse.json({
      frequencies: btoa(new Float32Array([20, 50, 100]).buffer),
      magnitude: btoa(new Float32Array([80, 82, 81]).buffer),
      phase: btoa(new Float32Array([0, -10, -20]).buffer)
    });
  })
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('REWApiClient', () => {
  it('should connect successfully', async () => {
    const client = new REWApiClient();
    const status = await client.connect();

    expect(status.connected).toBe(true);
    expect(status.rew_version).toBe('5.30.9');
    expect(status.measurements_available).toBe(2);
  });

  it('should list measurements', async () => {
    const client = new REWApiClient();
    await client.connect();
    const measurements = await client.listMeasurements();

    expect(measurements).toHaveLength(2);
    expect(measurements[0].uuid).toBe('test-uuid-1');
    expect(measurements[0].name).toBe('Left Main');
  });

  it('should fetch frequency response', async () => {
    const client = new REWApiClient();
    await client.connect();
    const fr = await client.getFrequencyResponse('test-uuid-1');

    expect(fr).toBeDefined();
    expect(fr!.frequencies_hz).toEqual([20, 50, 100]);
    expect(fr!.spl_db).toEqual([80, 82, 81]);
  });

  it('should handle connection refused', async () => {
    // Override handler to simulate REW not running
    server.use(
      http.get('http://127.0.0.1:4735/doc.json', () => {
        return HttpResponse.error();
      })
    );

    const client = new REWApiClient();
    const status = await client.connect();

    expect(status.connected).toBe(false);
    expect(status.error_message).toContain('Cannot connect to REW');
  });
});
```

**Why MSW over alternatives:**
- **Type-safe:** TypeScript-first API with inference
- **Spec-based:** Models real HTTP, not mocking fetch directly
- **Reusable:** Same handlers work across all tests
- **Standards-compliant:** Uses Fetch API Response objects
- **Better than nock:** Nock doesn't work well with native fetch; MSW intercepts at network level
- **Better than vitest-fetch-mock:** MSW provides structured handlers vs. global mocks

**Coverage target:** 80%+ for API client methods.

### 3. Tool Handler Integration Tests (NEW - Critical)

**What:** Test MCP tool handlers end-to-end using SDK Client + in-memory transport.
**Location:** `src/tools/*.test.ts` (create test files for each tool)
**Pattern:** In-memory MCP client/server connection with MSW for API calls.

```typescript
// src/tools/api-list-measurements.test.ts (NEW FILE)
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from './index.js';

// MSW server for REW API mocking
const server = setupServer(
  http.get('http://127.0.0.1:4735/doc.json', () => {
    return HttpResponse.json({ info: { version: '5.30.9' } });
  }),
  http.get('http://127.0.0.1:4735/measurements', () => {
    return HttpResponse.json([
      { uuid: 'uuid-1', name: 'Left', type: 'SPL' },
      { uuid: 'uuid-2', name: 'Right', type: 'SPL' }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('rew.api_list_measurements', () => {
  it('should list measurements after connection', async () => {
    // Create MCP server instance
    const mcpServer = new Server(
      { name: 'rew-mcp-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    registerTools(mcpServer);

    // Create in-memory transport
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Connect server and client
    const serverPromise = mcpServer.connect(serverTransport);
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);
    await serverPromise;

    // Step 1: Connect to API first
    const connectResult = await client.callTool({
      name: 'rew.api_connect',
      arguments: {}
    });

    expect(connectResult.isError).toBe(false);
    const connectData = JSON.parse(connectResult.content[0].text);
    expect(connectData.connected).toBe(true);

    // Step 2: List measurements
    const listResult = await client.callTool({
      name: 'rew.api_list_measurements',
      arguments: {}
    });

    expect(listResult.isError).toBe(false);
    const measurements = JSON.parse(listResult.content[0].text);
    expect(measurements.length).toBe(2);
    expect(measurements[0].name).toBe('Left');

    await client.close();
    await mcpServer.close();
  });

  it('should return error when not connected', async () => {
    const mcpServer = new Server(
      { name: 'rew-mcp-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    registerTools(mcpServer);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const serverPromise = mcpServer.connect(serverTransport);
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);
    await serverPromise;

    // Call list_measurements WITHOUT connecting first
    const result = await client.callTool({
      name: 'rew.api_list_measurements',
      arguments: {}
    });

    expect(result.isError).toBe(true);
    const error = JSON.parse(result.content[0].text);
    expect(error.message || error.error).toContain('not connected');

    await client.close();
    await mcpServer.close();
  });
});
```

**Why in-memory transport:**
- **Eliminates race conditions:** No subprocess spawn timing issues
- **Faster:** No IPC overhead or stdio stream parsing
- **Official pattern:** Recommended by MCP SDK docs for testing
- **Type-safe:** Full TypeScript inference for requests/responses

**Alternative (NOT recommended):** Subprocess stdio testing with `spawn`. This pattern is prone to flakiness, requires cleanup logic, and doesn't provide type safety. Only use for E2E smoke tests.

**Coverage target:** 70%+ for tool handlers (focus on happy path + error cases).

### 4. Tool Registration Tests (NEW - Quick Wins)

**What:** Verify all 18 tools are properly registered with valid schemas.
**Location:** `src/tools/index.test.ts` (create)
**Pattern:** Call `listTools()` and validate schemas.

```typescript
// src/tools/index.test.ts (NEW FILE)
import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from './index.js';

describe('Tool Registration', () => {
  it('should register all 18 tools', async () => {
    const mcpServer = new Server(
      { name: 'rew-mcp-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    registerTools(mcpServer);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const serverPromise = mcpServer.connect(serverTransport);
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);
    await serverPromise;

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(18);

    // Verify key tools exist
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('rew.api_connect');
    expect(toolNames).toContain('rew.api_list_measurements');
    expect(toolNames).toContain('rew.api_get_measurement');
    expect(toolNames).toContain('rew.ingest_measurement');
    expect(toolNames).toContain('rew.analyze_room_modes');

    await client.close();
    await mcpServer.close();
  });

  it('should have valid input schemas for all tools', async () => {
    const mcpServer = new Server(
      { name: 'rew-mcp-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    registerTools(mcpServer);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const serverPromise = mcpServer.connect(serverTransport);
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);
    await serverPromise;

    const { tools } = await client.listTools();

    // All tools must have inputSchema
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }

    await client.close();
    await mcpServer.close();
  });

  it('should reject unknown tool names', async () => {
    const mcpServer = new Server(
      { name: 'rew-mcp-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    registerTools(mcpServer);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const serverPromise = mcpServer.connect(serverTransport);
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(clientTransport);
    await serverPromise;

    await expect(async () => {
      await client.callTool({
        name: 'rew.nonexistent_tool',
        arguments: {}
      });
    }).rejects.toThrow();

    await client.close();
    await mcpServer.close();
  });
});
```

**Coverage target:** 100% (this is a quick validation suite).

### 5. Manual Testing with MCP Inspector (Development Only)

**What:** Interactive testing in a web UI with real MCP protocol validation.
**When:** During development to verify tool behavior and protocol compliance.
**Pattern:** Run inspector via npx, no installation needed.

```bash
# Start inspector pointing at built server
npx @modelcontextprotocol/inspector node dist/index.js

# Inspector UI opens at http://localhost:6274
# - Lists all tools
# - Shows tool schemas
# - Allows manual tool invocation
# - Validates MCP protocol messages
# - Shows request/response logs
```

**Why use inspector:**
- **Protocol validation:** Catches schema errors that tests might miss
- **Interactive debugging:** See exactly what LLM clients will see
- **Real-time logs:** Debug tool execution flow
- **No setup required:** Just npx, no permanent installation

**Why NOT use inspector for CI:**
- Requires human interaction
- Not scriptable
- Slower than automated tests

**When to use:** After implementing new tools, before committing. Run inspector, manually test the tool, verify schema looks correct.

## Testing Strategy by Layer

| Layer | Test Type | Tools | Mock Strategy | Priority |
|-------|-----------|-------|---------------|----------|
| Analysis functions | Unit | Vitest | None (pure functions) | HIGH |
| API client | Unit | Vitest + MSW | Mock REW HTTP endpoints | HIGH |
| Tool handlers | Integration | Vitest + MCP SDK Client + MSW | In-memory transport + mock REW API | CRITICAL |
| Tool registration | Integration | Vitest + MCP SDK Client | In-memory transport, no API calls | MEDIUM |
| Manual validation | Manual | MCP Inspector | None (development only) | LOW |

## Anti-Patterns to Avoid

### 1. Testing with Subprocess Stdio Transport

**What goes wrong:**
```typescript
// DON'T DO THIS
const mcpServerProcess = spawn('node', ['dist/index.js']);
const client = new Client(...);
await client.connect(new StdioClientTransport({
  reader: mcpServerProcess.stdout,
  writer: mcpServerProcess.stdin
}));
```

**Why bad:**
- Race conditions on process startup
- Cleanup complexity (kill process, wait for exit)
- Slower than in-memory transport
- Harder to debug (stdio interleaving)
- Flaky in CI (timing-dependent)

**Instead:** Use `InMemoryTransport.createLinkedPair()` for all integration tests.

### 2. Mocking fetch with vi.fn() Globally

**What goes wrong:**
```typescript
// DON'T DO THIS
global.fetch = vi.fn(() => Promise.resolve({
  json: () => Promise.resolve({ data: 'test' })
}));
```

**Why bad:**
- Global state pollutes other tests
- No type safety for mock responses
- Verbose setup for each endpoint
- Doesn't model real HTTP behavior
- Hard to reuse across tests

**Instead:** Use MSW with structured handlers that model REW API spec.

### 3. Testing Analysis Functions with Live API Calls

**What goes wrong:**
```typescript
// DON'T DO THIS
it('should analyze room modes from REW', async () => {
  const client = new REWApiClient(); // Tries to connect to localhost:4735
  await client.connect();
  const fr = await client.getFrequencyResponse('some-uuid');
  const modes = analyzeRoomModes(fr);
  expect(modes.length).toBeGreaterThan(0);
});
```

**Why bad:**
- Requires REW to be running during tests
- CI will fail without REW instance
- Slower (network I/O)
- Non-deterministic (depends on REW state)
- Couples analysis tests to API availability

**Instead:** Unit test analysis functions with synthetic data. Integration test API client separately with MSW.

### 4. Ignoring Base64 Encoding in Mock Responses

**What goes wrong:**
```typescript
// DON'T DO THIS
http.get('*/frequency-response', () => {
  return HttpResponse.json({
    frequencies: [20, 50, 100], // Should be base64-encoded Float32Array
    magnitude: [80, 82, 81]
  });
});
```

**Why bad:**
- Doesn't match REW API spec (uses base64-encoded float arrays)
- Test passes but real API calls fail
- `decodeREWFloatArray()` expects base64 strings, not arrays

**Instead:** Mock REW responses with proper base64 encoding:
```typescript
http.get('*/frequency-response', () => {
  const frequencies = new Float32Array([20, 50, 100]);
  const magnitude = new Float32Array([80, 82, 81]);

  return HttpResponse.json({
    frequencies: btoa(String.fromCharCode(...new Uint8Array(frequencies.buffer))),
    magnitude: btoa(String.fromCharCode(...new Uint8Array(magnitude.buffer)))
  });
});
```

### 5. Not Cleaning Up MSW Handlers Between Tests

**What goes wrong:**
```typescript
// DON'T DO THIS
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterAll(() => server.close());
// Missing: afterEach(() => server.resetHandlers());
```

**Why bad:**
- Test-specific handlers leak into other tests
- `server.use()` overrides persist across tests
- Hard-to-debug test interdependencies
- Flaky test failures

**Instead:** Always reset handlers after each test:
```typescript
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers()); // CRITICAL
afterAll(() => server.close());
```

## Validation Workflow

### Pre-Commit Validation

```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Ensure coverage thresholds met
# - analysis/: 90%+
# - api/: 80%+
# - tools/: 70%+
```

### CI Validation (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4 # Optional: upload coverage
```

### Manual Validation (Development)

```bash
# 1. Build server
npm run build

# 2. Run MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js

# 3. In inspector UI (http://localhost:6274):
#    - Click "Connect"
#    - Navigate to "Tools" tab
#    - Click "List Tools" (verify all 18 tools appear)
#    - Test a tool manually (e.g., rew.api_connect with no args)
#    - Verify response structure matches expected format

# 4. For API-dependent tools, ensure REW is running:
#    - Launch REW
#    - Go to Preferences → API
#    - Click "Start" to enable API server
#    - Run inspector again and test API tools
```

## Test Organization

```
src/
├── analysis/
│   ├── peaks-nulls.ts
│   ├── peaks-nulls.test.ts          # Unit tests (already exist)
│   ├── room-modes.ts
│   ├── room-modes.test.ts           # Unit tests (already exist)
│   └── ...
├── api/
│   ├── rew-client.ts
│   └── rew-client.test.ts           # API client tests (NEW - MSW)
├── tools/
│   ├── index.ts
│   ├── index.test.ts                # Tool registration tests (NEW)
│   ├── api-connect.ts
│   ├── api-connect.test.ts          # Integration test (NEW - MCP Client + MSW)
│   ├── api-list-measurements.ts
│   ├── api-list-measurements.test.ts # Integration test (NEW)
│   └── ...
└── parser/
    ├── rew-text.ts
    └── rew-text.test.ts             # Unit tests (already exist)
```

## MSW Handler Organization (Recommended)

```
src/
└── test-helpers/
    ├── msw-handlers.ts              # Reusable REW API handlers
    └── test-data.ts                 # Synthetic measurement data
```

Example:
```typescript
// src/test-helpers/msw-handlers.ts
import { http, HttpResponse } from 'msw';

export const rewApiHandlers = [
  http.get('http://127.0.0.1:4735/doc.json', () => {
    return HttpResponse.json({
      info: { version: '5.30.9' },
      openapi: '3.0.0'
    });
  }),

  http.get('http://127.0.0.1:4735/measurements', () => {
    return HttpResponse.json([
      { uuid: 'test-uuid-1', name: 'Left Main', type: 'SPL' },
      { uuid: 'test-uuid-2', name: 'Right Main', type: 'SPL' }
    ]);
  }),

  // Add more handlers...
];

// In tests:
import { setupServer } from 'msw/node';
import { rewApiHandlers } from '../test-helpers/msw-handlers.js';

const server = setupServer(...rewApiHandlers);
```

## Expected Coverage Targets

| Directory | Coverage Target | Rationale |
|-----------|-----------------|-----------|
| `src/analysis/` | 90%+ | Pure functions, critical logic, easy to test |
| `src/api/` | 80%+ | HTTP client with error handling, MSW-mocked |
| `src/tools/` | 70%+ | Integration tests focus on happy path + key errors |
| `src/parser/` | 85%+ | Text parsing, mostly deterministic |
| Overall | 80%+ | Comprehensive coverage without test theater |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HTTP Mocking | MSW 2.x | nock | Nock doesn't work reliably with native fetch in Node 18+ |
| HTTP Mocking | MSW 2.x | vitest-fetch-mock | Less structured than MSW, global mocking is error-prone |
| HTTP Mocking | MSW 2.x | undici.MockAgent | Undici-specific, doesn't work with global fetch |
| MCP Testing | In-memory transport | Subprocess stdio | Subprocess is flaky, slower, harder to debug |
| MCP Testing | SDK Client | Manual JSON-RPC | Client provides type safety and protocol compliance |
| Test Runner | Vitest | Jest | Jest has worse ESM support, slower, deprecated for new projects |
| Coverage | V8 | Istanbul (c8) | V8 is native to Node, faster, more accurate |

## Known Limitations

### 1. REW API Specification Gaps

**Issue:** Official REW API docs don't specify all endpoint behaviors.
**Impact:** Some endpoints (e.g., `/measurements/:uuid/waterfall`) may not exist in all REW versions.
**Mitigation:**
- Mark uncertain endpoints as `@deprecated` with audit notes (already done in `rew-client.ts`)
- Test against multiple REW versions if possible
- Use MCP Inspector with real REW to verify endpoints before writing tests

### 2. Base64 Float Array Encoding

**Issue:** REW returns float arrays as base64-encoded binary, not JSON arrays.
**Impact:** Mock responses must encode data correctly or tests will fail.
**Mitigation:**
- Use helper functions in test-helpers to encode test data
- Document encoding in MSW handler comments
- Include encoding/decoding in API client tests

### 3. Blocking Mode Availability

**Issue:** REW Pro license required for blocking mode and automated sweeps.
**Impact:** Some tests may not be runnable without Pro license.
**Mitigation:**
- Mock Pro feature availability in tests
- Document license requirements in test comments
- Test both Pro and non-Pro code paths

## Confidence Assessment

| Area | Confidence | Source | Notes |
|------|------------|--------|-------|
| Vitest setup | HIGH | Existing config + official docs | Already working for unit tests |
| MSW for API mocking | HIGH | MSW docs + ecosystem adoption | Standard 2025 practice, replaces nock |
| In-memory MCP testing | HIGH | MCP SDK examples + official docs | Recommended pattern per SDK maintainers |
| REW API spec | MEDIUM | Official REW docs + existing code | Some endpoints lack documentation |
| Coverage targets | HIGH | Industry standards + TypeScript projects | Realistic for MCP server validation |

## Sources

### MCP Testing Patterns
- [MCP Inspector - Model Context Protocol](https://modelcontextprotocol.io/docs/tools/inspector)
- [Unit Testing MCP Servers - MCPcat](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
- [Testing MCP Servers with MCP Inspector](https://mydeveloperplanet.com/2025/12/01/testing-mcp-servers-with-mcp-inspector/)
- [Build & Test MCP Server with TypeScript and MCP Inspector - Hackteam](https://hackteam.io/blog/build-test-mcp-server-typescript-mcp-inspector/)
- [How to Test MCP Servers - Stainless MCP Portal](https://www.stainless.com/mcp/how-to-test-mcp-servers)
- [GitHub - thoughtspot/mcp-testing-kit](https://github.com/thoughtspot/mcp-testing-kit)

### HTTP Mocking with MSW
- [Comparison - Mock Service Worker](https://mswjs.io/docs/comparison/)
- [Using Mock Service Worker With Vitest - Steve Kinney](https://stevekinney.com/courses/testing/testing-with-mock-service-worker)
- [Easier TypeScript API Testing with Vitest + MSW - DEV](https://dev.to/seratch/easier-typescript-api-testing-with-vitest-msw-4k3a)
- [React unit testing using Vitest, RTL and MSW - DEV](https://dev.to/medaymentn/react-unit-testing-using-vitest-rtl-and-msw-216j)

### Vitest and Fetch Mocking
- [vitest-fetch-mock - npm](https://www.npmjs.com/package/vitest-fetch-mock)
- [GitHub - IanVS/vitest-fetch-mock](https://github.com/IanVS/vitest-fetch-mock)
- [Mocking Fetch And Network Requests With Vitest - Steve Kinney](https://stevekinney.com/courses/testing/mocking-fetch-and-network-requests)

### MCP SDK and TypeScript
- [GitHub - modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- [@modelcontextprotocol/sdk - npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [Build Your Own MCP Server with TypeScript - Medium](https://medium.com/@reactjsbd/build-your-own-mcp-server-with-typescript-complete-guide-with-best-practices-016157b54ed6)

### MCP Best Practices
- [MCP Best Practices - Peter Steinberger](https://steipete.me/posts/2025/mcp-best-practices)
- [Implementing MCP: Tips, Tricks and Pitfalls - Nearform](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/)
