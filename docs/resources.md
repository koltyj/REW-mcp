# MCP Resources

This document describes the MCP resources exposed by `rew-mcp`.

## Overview

The server exposes two kinds of resources:

- Dynamic resources returned by `resources/list` for active sessions and stored measurements.
- Resource templates returned by `resources/templates/list` for all supported URI schemes.

All resources are read-only and return JSON payloads.

## Dynamic Resources

When sessions or stored measurements exist, `resources/list` returns entries such as:

```json
{
  "resources": [
    {
      "uri": "session://9d3a0c7f-64b2-43fb-a4c0-1618cf6d4c03",
      "name": "Session 9d3a0c7f",
      "description": "Measurement session created at 2026-03-15T14:20:11.019Z, step: measuring_left",
      "mimeType": "application/json"
    },
    {
      "uri": "measurement://left_baseline",
      "name": "Measurement left_baseline",
      "description": "L - baseline (frequency_response)",
      "mimeType": "application/json"
    }
  ]
}
```

## Resource Templates

The server advertises these templates:

| URI Template | Purpose |
|--------------|---------|
| `session://{session_id}` | Session state and measurement progress |
| `measurement://{measurement_id}` | Stored measurement data and metadata |
| `recommendations://{session_id}` | Optimization recommendations for a session |
| `history://{session_id}` | Measurement history and summaries for a session |

## Resource Payloads

### `session://{session_id}`

Returns session progress without embedding full frequency-response arrays.

```json
{
  "session_id": "9d3a0c7f-64b2-43fb-a4c0-1618cf6d4c03",
  "created_at": 1742048411019,
  "sequence_step": "measuring_left",
  "measurements": [
    {
      "uuid": "8f43a5d4-4be2-45fd-a9b6-34fbcda52828",
      "name": "Left speaker",
      "channel": "left",
      "timestamp": 1742048455011
    }
  ],
  "target_spl": 85,
  "notes": "Main listening position"
}
```

### `measurement://{measurement_id}`

Returns stored frequency-response data and metadata for a measurement created through `rew.ingest_measurement` or related workflows.

```json
{
  "id": "left_baseline",
  "metadata": {
    "speaker_id": "L",
    "condition": "baseline",
    "mic_position_id": "mlp"
  },
  "frequency_response": {
    "frequencies_hz": [20, 25, 31.5],
    "spl_db": [73.1, 74.8, 76.2],
    "phase_degrees": [0, -8.4, -15.2]
  },
  "timestamp": "2026-03-15T14:21:55.011Z"
}
```

### `recommendations://{session_id}`

Returns recommendation state for a session-driven optimization workflow.

### `history://{session_id}`

Returns measurement history and summaries associated with a session.

## Reading a Resource

Example request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/read",
  "params": {
    "uri": "measurement://left_baseline"
  }
}
```

## Error Behavior

- Invalid URI format returns an error.
- Unknown schemes return an error.
- Missing sessions or measurements return a not-found error from the resource handler.

## Notes

- Resources are read-only; use tools such as `rew.ingest_measurement`, `rew.api_get_measurement`, or `rew.api_measurement_session` to create data.
- Measurements appear in `resources/list` after they have been stored by the server.
