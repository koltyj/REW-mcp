# Technology Stack

**Analysis Date:** 2026-01-21

## Languages

**Primary:**
- TypeScript 5.8.2 - All source code and implementation
- JavaScript (ES2022) - Compiled output and scripts

**Secondary:**
- Shell/Bash - Build scripts and npm commands

## Runtime

**Environment:**
- Node.js >=18.0.0 - Required runtime for MCP server execution

**Package Manager:**
- npm - Primary dependency management
- npm-lock: `package-lock.json` present

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.2 - MCP (Model Context Protocol) server implementation at `src/index.ts`
  - StdioServerTransport for stdio-based communication
  - Server and tool registration system

**Validation & Schema:**
- zod 3.23.8 - Runtime input validation and schema definition across all tool files
- zod-to-json-schema 3.23.5 - Converts Zod schemas to JSON Schema for MCP protocol compliance

**Testing:**
- vitest 2.1.8 - Unit test runner and framework
- @vitest/coverage-v8 2.1.8 - Code coverage reporting
- Config: `vitest.config.ts` with globals, v8 coverage, HTML reports

**Build/Dev:**
- TypeScript compiler (tsc) - Builds src to dist with source maps and declarations
- ESLint + @typescript-eslint - Linting and code quality
- .eslintrc.json configuration

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk - Provides MCP server protocol implementation. All MCP tool registration and communication flows through this.
- zod - Input validation for all tool parameters. Every tool uses Zod schemas defined in `src/tools/*.ts`
- Fetch API (native Node.js) - HTTP client for REW REST API communication in `src/api/rew-client.ts`

**Infrastructure:**
- No external databases, caching, or observability SDKs
- No authentication libraries (REW API is local only)
- No data serialization libraries (uses native JSON)

## Configuration

**Build:**
- `tsconfig.json` - ES2022 target, ES modules, strict type checking
  - Output: `dist/` directory
  - Source maps enabled for debugging
  - No unused variable/parameter tolerance
  - Explicit return type requirements for functions

**Linting:**
- `.eslintrc.json` - TypeScript-aware ESLint configuration
  - Extends: eslint:recommended, @typescript-eslint/recommended
  - Environment: node + es2022
  - Key rules: explicit-function-return-type (warn), no-unused-vars (error), eqeqeq (always)

**Testing:**
- `vitest.config.ts` - Global test utilities, node environment, v8 coverage with HTML reporter

**Runtime Scripts:**
- build: `tsc && node -e "require('fs').chmodSync('dist/index.js', '755')"`
- start: `node dist/index.js`
- dev: `tsc --watch`
- test: `vitest run`
- test:watch: `vitest`
- test:coverage: `vitest run --coverage`
- lint: `eslint src/**/*.ts`
- lint:fix: `eslint src/**/*.ts --fix`

## Environment

**Required:**
- Node.js 18+ executable in PATH
- No environment variables required for operation
- No .env file support (analysis-only, no secrets needed)

**Development:**
- TypeScript compiler required for source development
- ESLint + TypeScript plugin required for linting
- Vitest installed for testing

**Deployment:**
- Published to npm registry as `rew-mcp`
- Accessible via: `npx -y rew-mcp` or `npm install -g rew-mcp && rew-mcp`
- Smithery.yaml configuration for MCP server registration

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js 18+
- npm or compatible package manager
- Text editor/IDE with TypeScript support recommended

**Production:**
- Node.js 18+ on any platform (desktop/server)
- Used as MCP server within:
  - Claude Desktop (via claude_desktop_config.json)
  - Cursor IDE (v0.45.6+)
  - VS Code (with MCP extension)
  - Windsurf or compatible LLM editor

## Binary & Package Distribution

**Entry Point:**
- `dist/index.js` - Compiled MCP server executable
- Shebang: `#!/usr/bin/env node` for CLI execution
- Distributed via npm package with executable permissions

**Files Included in Distribution:**
- `dist/` directory only (compiled TypeScript)
- No source files shipped with npm package

---

*Stack analysis: 2026-01-21*
