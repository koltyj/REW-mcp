# REW MCP Server

An MCP (Model Context Protocol) server that exposes Room EQ Wizard (REW) measurement data and analysis tools to LLMs, enabling AI-assisted speaker placement decisions and validation of Genelec GLM calibration.

## Features

- 📊 **Parse REW exports** - Frequency response and impulse response text files
- 🔍 **Detect room modes** - Identify peaks, nulls, and correlate with theoretical modes
- 📉 **Analyze decay times** - Find excessive ringing and resonances
- 🔊 **Reflection analysis** - Detect early reflections and comb filtering
- ⚖️ **Compare measurements** - Pre/post GLM, placement optimization, L/R symmetry
- 🎯 **GLM-aware interpretation** - Understand what Genelec GLM can and cannot fix
- 🤖 **AI-assisted decision support** - Get structured recommendations with confidence levels

## What This Is

The MCP server **does not control REW in real time**. It:

- Ingests, parses, compares, and analyzes REW exports
- Provides structured insights to an LLM (Claude/Copilot)
- Enables AI-assisted decision support for room acoustics

## Primary Use Cases

1. **Speaker placement optimization** - Compare measurements from different speaker positions
2. **Pre- vs post-GLM calibration comparison** - Validate what Genelec GLM addressed
3. **Room mode and null identification** - Detect problematic frequencies
4. **Decision support** - Move speaker vs trust GLM vs treat room

## Non-Goals

| Not Supported | Reason |
|---------------|--------|
| Real-time audio control | System is analysis-only |
| DSP or EQ application | Human executes all changes |
| Replace Genelec GLM | Complements, doesn't replace |
| Automatic "magic fixes" | Advises only, human decides |

## Documentation

### Core Documentation

| Document | Purpose |
|----------|---------|
| [Architecture](docs/architecture.md) | System design and data flow |
| [File Formats](docs/file-formats.md) | REW export format specifications |
| [Analysis Rules](docs/analysis-rules.md) | Deterministic analysis algorithms |
| [GLM Context](docs/glm-context.md) | Genelec GLM behavior reference |
| [Guardrails](docs/guardrails.md) | Safety constraints and quality rules |
| [Examples](docs/examples.md) | Usage patterns and workflows |
| [References](docs/references.md) | External documentation sources |

### MCP Protocol Documentation

| Document | Purpose |
|----------|---------|
| [MCP Server Config](docs/mcp-server-config.md) | Server capabilities and initialization |
| [Resources](docs/resources.md) | MCP resource definitions for data access |
| [Prompts](docs/prompts.md) | MCP prompt templates for workflows |

### Tool Specifications

| Tool | Purpose |
|------|---------|
| [rew.ingest_measurement](docs/tools/ingest-measurement.md) | Parse and normalize REW exports |
| [rew.compare_measurements](docs/tools/compare-measurements.md) | Compare two or more measurements |
| [rew.analyze_room_modes](docs/tools/analyze-room-modes.md) | Detect peaks, nulls, and modes |
| [rew.analyze_decay](docs/tools/analyze-decay.md) | Waterfall and decay interpretation |
| [rew.analyze_impulse](docs/tools/analyze-impulse.md) | Impulse response and ETC analysis |
| [rew.interpret_with_glm_context](docs/tools/interpret-with-glm-context.md) | GLM-aware result interpretation |

## Installation

### Running with npx (Recommended)

No installation required - run directly:

```bash
npx -y rew-mcp
```

### Manual Installation

Install globally via npm:

```bash
npm install -g rew-mcp
```

Then run:

```bash
rew-mcp
```

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rew-mcp": {
      "command": "npx",
      "args": ["-y", "rew-mcp"]
    }
  }
}
```

### Usage with Cursor

**For Cursor v0.48.6+**

1. Open Cursor Settings
2. Go to Features > MCP Servers
3. Click "+ Add new global MCP server"
4. Enter the following code:

```json
{
  "mcpServers": {
    "rew-mcp": {
      "command": "npx",
      "args": ["-y", "rew-mcp"]
    }
  }
}
```

**For Cursor v0.45.6**

1. Open Cursor Settings
2. Go to Features > MCP Servers
3. Click "+ Add New MCP Server"
4. Enter:
   - Name: "rew-mcp"
   - Type: "command"
   - Command: `npx -y rew-mcp`

### Usage with VS Code

For quick installation, click the installation button below:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=rew-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22rew-mcp%22%5D%7D)

Or manually add to your user settings (Ctrl + Shift + P → "Preferences: Open User Settings (JSON)"):

```json
{
  "mcp": {
    "servers": {
      "rew-mcp": {
        "command": "npx",
        "args": ["-y", "rew-mcp"]
      }
    }
  }
}
```

Alternatively, create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "rew-mcp": {
      "command": "npx",
      "args": ["-y", "rew-mcp"]
    }
  }
}
```

### Usage with Windsurf

Add this to your `./codeium/windsurf/model_config.json`:

```json
{
  "mcpServers": {
    "rew-mcp": {
      "command": "npx",
      "args": ["-y", "rew-mcp"]
    }
  }
}
```

### Installing via Smithery

To install REW MCP for Claude Desktop automatically via [Smithery](https://smithery.ai):

```bash
npx -y @smithery/cli install rew-mcp --client claude
```

## Quick Start Workflow

```
1. User measures with REW → exports data files
2. MCP server ingests measurement files
3. LLM calls analysis tools
4. LLM explains results to user
5. User makes physical changes
6. Repeat until satisfied
```

## Available Tools

| Tool | Purpose | Typical Use |
|------|---------|-------------|
| `rew.ingest_measurement` | Parse and store REW exports | First step - load your measurement data |
| `rew.compare_measurements` | Compare 2+ measurements | Compare placements or pre/post GLM |
| `rew.analyze_room_modes` | Detect peaks, nulls, modes | Identify room acoustic issues |
| `rew.analyze_decay` | Analyze decay times | Check for excessive ringing |
| `rew.analyze_impulse` | Detect early reflections | Find reflection sources |
| `rew.interpret_with_glm_context` | GLM-aware interpretation | Understand GLM's effectiveness |

See [Tool Specifications](#tool-specifications) section below for detailed documentation.

## Usage Example

```typescript
// 1. Ingest a pre-GLM measurement
const preGLM = await rew.ingest_measurement({
  file_contents: fs.readFileSync('left_speaker_pre_glm.txt', 'utf-8'),
  metadata: {
    speaker_id: 'L',
    condition: 'pre_glm'
  }
});

// 2. Ingest post-GLM measurement
const postGLM = await rew.ingest_measurement({
  file_contents: fs.readFileSync('left_speaker_post_glm.txt', 'utf-8'),
  metadata: {
    speaker_id: 'L',
    condition: 'post_glm'
  }
});

// 3. Compare the measurements
const comparison = await rew.compare_measurements({
  measurement_ids: [preGLM.measurement_id, postGLM.measurement_id],
  comparison_type: 'before_after',
  reference_measurement_id: preGLM.measurement_id
});

// 4. Interpret with GLM context
const interpretation = await rew.interpret_with_glm_context({
  comparison_id: comparison.comparison_id
});
```

## Development

Build from source:

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start

# Run tests
npm test

# Watch mode for development
npm run dev
```

## Success Criteria

The system is successful if it can:

- Clearly state "Placement B is objectively better than Placement A"
- Explain why GLM did or did not fix an issue
- Reduce guesswork without pretending certainty
- Respect Genelec GLM's design philosophy

## Core Principle

**Epistemic honesty over false confidence.**

The system must:
- Never hallucinate causes
- Always mark uncertainty
- Prefer "likely" over "certain"
- Defer final judgment to humans

## MCP Protocol Compliance

This server implements **MCP Protocol Version 2025-06-18**.

| Feature | Status |
|---------|--------|
| Tools (with output schemas) | ✅ Supported |
| Resources | ✅ Supported |
| Prompts | ✅ Supported |
| Logging | ✅ Supported |
| Transport: stdio | ✅ Primary |
| Transport: HTTP+SSE | ⬜ Optional |

## External References

- **MCP Specification**: https://modelcontextprotocol.io/specification/2025-06-18
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **MCP Python SDK**: https://github.com/modelcontextprotocol/python-sdk
- **REW API Documentation**: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
- **REW File Export Documentation**: https://www.roomeqwizard.com/help/help_en-GB/html/file.html
- **Genelec GLM**: https://www.genelec.com/glm

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `npm test` to verify
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
