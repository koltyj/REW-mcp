<div align="center">

# REW MCP Server

**AI-powered room acoustics analysis for studio monitoring**

[![npm version](https://img.shields.io/npm/v/rew-mcp.svg?style=flat-square)](https://www.npmjs.com/package/rew-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/koltyj/rew-mcp/ci.yml?style=flat-square&label=CI)](https://github.com/koltyj/rew-mcp/actions)
[![Coverage](https://img.shields.io/badge/coverage-74.85%25-yellow?style=flat-square)](https://github.com/koltyj/rew-mcp/actions)

[Getting Started](#getting-started) •
[Documentation](#documentation) •
[Tools](#available-tools) •
[Contributing](#contributing)

</div>

---

## What is this?

REW MCP Server is a [Model Context Protocol](https://modelcontextprotocol.io) server that enables Claude (and other LLMs) to analyze room acoustics using [Room EQ Wizard](https://www.roomeqwizard.com) data. It transforms raw frequency response measurements into actionable recommendations for speaker placement and acoustic treatment.

**Key capabilities:**

- 🎯 **Guided calibration workflows** — Step-by-step mic gain staging and monitor level calibration
- 📊 **Plain language analysis** — Understand "what's wrong and why" instead of just looking at graphs
- 🔊 **GLM transparency** — See what Genelec GLM fixed and what it couldn't
- 📍 **Placement optimization** — Data-driven speaker and listening position recommendations
- ✅ **Validation** — Confirm adjustments actually improved your response

## Why use this?

Traditional room calibration is a "run and hope" process. You measure, apply GLM correction, and trust the result. This server changes that by:

1. **Explaining the problems** — Room modes, SBIR, symmetry issues in plain language
2. **Showing GLM's work** — What the DSP corrected vs what it couldn't fix (physics limitations)
3. **Guiding improvements** — One recommendation at a time, measure after each change
4. **Validating results** — Quantify improvements toward your target response

## Getting Started

### Quick Install

```bash
npx rew-mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

### Cursor

[![Install in Cursor](https://img.shields.io/badge/Cursor-Install_MCP-black?style=flat-square&logo=cursor)](https://cursor.com/install-mcp?name=rew-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInJldy1tY3AiXX0%3D)

Or manually: Settings → Features → MCP Servers → Add `npx -y rew-mcp`

### VS Code

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MCP-0098FF?style=flat-square&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=rew-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22rew-mcp%22%5D%7D)

### Smithery

```bash
npx -y @smithery/cli install rew-mcp --client claude
```

## Requirements

- **Node.js 18+**
- **Room EQ Wizard** running with `-api` flag (`localhost:4735`)
- **Measurement microphone** (calibrated preferred)

## Available Tools

### Measurement & Setup

| Tool | Description |
|------|-------------|
| `rew.api_connect` | Connect to REW API |
| `rew.api_check_levels` | Check mic input levels, detect clipping |
| `rew.api_calibrate_spl` | Calibrate monitor level to target SPL |
| `rew.api_measurement_session` | Guided L/R/Sub measurement sequence |

### Analysis

| Tool | Description |
|------|-------------|
| `rew.analyze_room` | Full room analysis with prioritized recommendations |
| `rew.api_parse_text` | Parse REW text exports |

### Optimization

| Tool | Description |
|------|-------------|
| `rew.optimize_room` | Get placement recommendations, validate adjustments |

### MCP Prompts

| Prompt | Description |
|--------|-------------|
| `rew_calibration_full` | Complete calibration workflow |
| `rew_gain_staging` | Standalone level calibration |
| `rew_measurement_workflow` | Session-aware L/R/Sub sequence |
| `rew_optimization_workflow` | Iterative placement optimization |

### MCP Resources

| URI Scheme | Description |
|------------|-------------|
| `session://{id}` | Session state and measurements |
| `measurement://{id}` | Full frequency response data |
| `recommendations://{id}` | Active recommendations |
| `history://{id}` | Measurement history |

## Example Workflow

```
1. Start REW with -api flag
2. "Help me calibrate my studio monitors"
3. Claude guides you through:
   - Checking mic levels
   - Calibrating to 85 dB SPL
   - Measuring L, R, Sub speakers
   - Analyzing room acoustics
   - Optimizing placement
   - Validating improvements
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design and data flow |
| [GLM Context](docs/glm-context.md) | How Genelec GLM works |
| [Analysis Rules](docs/analysis-rules.md) | Detection algorithms |
| [File Formats](docs/file-formats.md) | REW export specifications |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run dev
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
# Fork the repo, then:
git checkout -b feature/amazing-feature
npm test
git commit -m 'feat: add amazing feature'
git push origin feature/amazing-feature
# Open a Pull Request
```

## License

[MIT](LICENSE) © Kolton Jacobs

---

<div align="center">

**[Documentation](docs/)** • **[Changelog](CHANGELOG.md)** • **[Report Bug](https://github.com/koltyj/rew-mcp/issues)** • **[Request Feature](https://github.com/koltyj/rew-mcp/issues)**

</div>
