<div align="center">

# REW MCP Toolkit

**Claude Code plugin for room acoustics workflows**

</div>

---

A companion plugin for audio engineers using the [REW MCP server](../README.md). Adds domain knowledge, guided slash commands, measurement quality review, and workflow enforcement to Claude Code.

## Prerequisites

- REW MCP server installed and configured ([setup guide](../README.md#-getting-started))
- [Room EQ Wizard](https://www.roomeqwizard.com) running with `-api` flag
- Measurement microphone (calibrated preferred)
- REW Pro license for automated sweep measurements

## Installation

```bash
# Point Claude Code at the plugin directory
claude --plugin-dir /path/to/rew-mcp/plugin
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/rew:calibrate [target_spl]` | Full calibration workflow — mic setup, level check, SPL calibration (default 85 dB), L/R/Sub measurement, room analysis, optimization guidance |
| `/rew:analyze [file_path]` | Analyze room measurements with prioritized recommendations. Works with live REW data or imported text exports |
| `/rew:optimize` | Iterative placement optimization — one recommendation at a time, measure, validate, repeat |
| `/rew:status` | Show current session state, measurement progress, and recommended next step |

## Skills

Auto-activate based on conversation context — no manual invocation needed.

| Skill | Activates when discussing | Includes |
|-------|--------------------------|----------|
| **room-acoustics** | Room modes, SBIR, treatment, speaker placement, RT60, target curves, GLM | References: [GLM knowledge](skills/room-acoustics/references/glm-knowledge.md), [treatment guide](skills/room-acoustics/references/treatment-guide.md) |
| **rew-workflows** | Measurement workflows, tool chaining, calibration sequences, best practices | Reference: [tool chaining patterns](skills/rew-workflows/references/tool-chaining.md) |

## Agent

| Agent | Trigger | Behavior |
|-------|---------|----------|
| **measurement-reviewer** | Proactive after measurement sessions, or on request | Checks signal chain integrity, averaging consistency, frequency response shape, bass adequacy, L/R consistency, time domain. Reports **Critical** / **Warning** / **Info** with specific remediation steps. |

## Hook

**Workflow enforcement** — A `PreToolUse` prompt hook that monitors REW tool call order and soft-warns when prerequisites are skipped (e.g., analyzing before calibrating, optimizing before measuring). Never blocks execution; experienced users can ignore the warnings.

---

## Plugin Structure

```
plugin/
├── .claude-plugin/plugin.json     # Plugin manifest
├── commands/                       # 4 slash commands
│   ├── calibrate.md
│   ├── analyze.md
│   ├── optimize.md
│   └── status.md
├── agents/
│   └── measurement-reviewer.md    # Quality review agent
├── skills/
│   ├── room-acoustics/            # Domain knowledge
│   │   ├── SKILL.md
│   │   └── references/
│   └── rew-workflows/             # Tool orchestration
│       ├── SKILL.md
│       └── references/
└── hooks/
    └── hooks.json                 # Workflow enforcement
```

## License

[MIT](../LICENSE)
