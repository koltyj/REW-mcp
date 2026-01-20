# MCP Server Configuration

This document specifies the MCP server configuration for the REW measurement analysis server.

> **Protocol Version**: 2025-06-18
> **Specification**: https://modelcontextprotocol.io/specification/2025-06-18

## Server Information

```json
{
  "serverInfo": {
    "name": "rew-mcp-server",
    "title": "REW Measurement Analysis Server",
    "version": "1.0.0"
  }
}
```

## Capabilities

| Capability | Supported | Description |
|------------|-----------|-------------|
| Tools | ✅ Yes | 6 analysis tools for REW data |
| Resources | ✅ Yes | Access to stored measurements |
| Prompts | ✅ Yes | Common workflow templates |
| Logging | ✅ Yes | Structured logging support |
| listChanged | ❌ No | Static tool/resource list |

## Initialization

### Initialize Request (from client)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

### Initialize Response (from server)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": {},
      "resources": {
        "subscribe": false,
        "listChanged": false
      },
      "prompts": {},
      "logging": {}
    },
    "serverInfo": {
      "name": "rew-mcp-server",
      "title": "REW Measurement Analysis Server",
      "version": "1.0.0"
    },
    "instructions": "This server analyzes Room EQ Wizard measurement data. Workflow: 1) Ingest measurements using rew.ingest_measurement, 2) Run analysis tools (room_modes, decay, impulse), 3) Compare measurements or interpret with GLM context. All analyses are deterministic and include confidence scores."
  }
}
```

### Initialized Notification (from client)

```json
{
  "jsonrpc": "2.0",
  "method": "initialized"
}
```

## Transport Support

| Transport | Supported | Notes |
|-----------|-----------|-------|
| stdio | ✅ Primary | Recommended for local use |
| HTTP+SSE | ⬜ Optional | For remote/web deployments |

## Tool Response Format

All tool responses follow this MCP-compliant structure:

### Success Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\": \"success\", \"measurement_id\": \"meas_001\", ...}"
    }
  ],
  "isError": false
}
```

### Error Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\": \"error\", \"error_type\": \"parse_error\", \"message\": \"...\"}"
    }
  ],
  "isError": true
}
```

## Tool List

| Tool Name | Title | Description |
|-----------|-------|-------------|
| `rew.ingest_measurement` | Ingest Measurement | Parse and store REW exports |
| `rew.compare_measurements` | Compare Measurements | Compare two or more measurements |
| `rew.analyze_room_modes` | Analyze Room Modes | Detect peaks, nulls, and modes |
| `rew.analyze_decay` | Analyze Decay | Waterfall and decay analysis |
| `rew.analyze_impulse` | Analyze Impulse Response | IR and reflection analysis |
| `rew.interpret_with_glm_context` | Interpret with GLM Context | GLM-aware interpretation |

## Resource List

| URI Pattern | Name | Description |
|-------------|------|-------------|
| `rew://measurements` | Measurement List | List all stored measurements |
| `rew://measurements/{id}` | Stored Measurement | Access specific measurement data |
| `rew://measurements/{id}/frequency-response` | Frequency Response | Raw FR data for a measurement |
| `rew://measurements/{id}/impulse-response` | Impulse Response | Raw IR data for a measurement |

## Prompt List

| Prompt Name | Description |
|-------------|-------------|
| `glm_comparison_workflow` | Pre/post GLM comparison workflow |
| `placement_optimization` | Speaker placement comparison workflow |
| `room_analysis_complete` | Full room acoustic analysis |

## Error Codes

| Code | Type | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Invalid JSON-RPC |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid parameters |
| -32603 | Internal error | Server error |

## Application-Specific Errors

| Error Type | Description | Resolution |
|------------|-------------|------------|
| `parse_error` | Cannot parse REW file | Re-export from REW as text |
| `validation_error` | Invalid input values | Check parameter constraints |
| `measurement_not_found` | Unknown measurement ID | List measurements first |
| `insufficient_data` | Not enough data points | Re-export with higher resolution |
| `incompatible_measurements` | Cannot compare measurements | Ensure overlapping frequency ranges |

## Logging

The server supports MCP logging levels:

| Level | Usage |
|-------|-------|
| `debug` | Detailed parsing information |
| `info` | Tool invocations and completions |
| `warning` | Data quality issues, low confidence |
| `error` | Failures and exceptions |

Example log notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "rew-mcp-server",
    "data": "Ingested measurement meas_001 with 512 data points"
  }
}
```
