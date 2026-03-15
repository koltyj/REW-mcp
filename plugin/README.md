# REW MCP Toolkit Plugin

Claude Code plugin for audio engineers using the [REW MCP server](../README.md). Provides domain knowledge, guided workflows, measurement quality review, and workflow enforcement.

## Prerequisites

- [REW MCP server](../README.md) installed and configured in your MCP client
- [Room EQ Wizard](https://www.roomeqwizard.com) running with `-api` flag
- Measurement microphone (calibrated preferred)
- REW Pro license for automated sweep measurements

## Installation

```bash
claude --plugin-dir /path/to/rew-mcp/plugin
```

Or symlink into your project:
```bash
ln -s /path/to/rew-mcp/plugin .claude-plugin/rew-mcp-toolkit
```

## Commands

| Command | Description |
|---------|-------------|
| `/rew:calibrate [target_spl]` | Full calibration workflow — mic setup, level check, SPL calibration (default 85 dB), L/R/Sub measurement, analysis, optimization |
| `/rew:analyze [file_path]` | Analyze room measurements with prioritized recommendations. Works with live REW data or imported text exports |
| `/rew:optimize` | Iterative placement optimization — one recommendation at a time, measure, validate, repeat |
| `/rew:status` | Show session state, measurement progress, and next recommended step |

## Skills

| Skill | Activates When |
|-------|---------------|
| **room-acoustics** | Discussing room modes, SBIR, treatment, speaker placement, RT60, target curves, GLM calibration |
| **rew-workflows** | Working with REW MCP tools, asking about measurement workflows, tool chaining, best practices |

## Agent

| Agent | Behavior |
|-------|----------|
| **measurement-reviewer** | Proactively reviews measurement data quality after sessions complete. Checks for clipping, low SNR, consistency issues, and suspicious patterns. Reports Critical/Warning/Info findings. |

## Hook

**Workflow enforcement** (PreToolUse) — soft-warns when REW tools are called out of the recommended order (e.g., analyzing before calibrating). Never blocks, only advises.

## License

[MIT](../LICENSE)
