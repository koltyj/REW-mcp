# MCP Resources

This document specifies the resources exposed by the REW MCP server.

> **Reference**: MCP Resources Specification (Protocol Version 2025-06-18)
> https://modelcontextprotocol.io/specification/2025-06-18/server/resources

## Overview

Resources provide read-only access to measurement data without invoking analysis tools. This allows LLMs to inspect raw data when needed.

## Resource List

### Static Resources

```json
{
  "resources": [
    {
      "uri": "rew://measurements",
      "name": "Measurement List",
      "description": "List all stored measurements with metadata",
      "mimeType": "application/json"
    }
  ]
}
```

### Resource Templates

```json
{
  "resourceTemplates": [
    {
      "uriTemplate": "rew://measurements/{measurement_id}",
      "name": "Stored Measurement",
      "description": "Complete measurement data including frequency response, metadata, and quick stats",
      "mimeType": "application/json"
    },
    {
      "uriTemplate": "rew://measurements/{measurement_id}/frequency-response",
      "name": "Frequency Response Data",
      "description": "Raw frequency, SPL, and phase arrays for a measurement",
      "mimeType": "application/json"
    },
    {
      "uriTemplate": "rew://measurements/{measurement_id}/impulse-response",
      "name": "Impulse Response Data",
      "description": "Raw impulse response samples and metadata",
      "mimeType": "application/json"
    },
    {
      "uriTemplate": "rew://measurements/{measurement_id}/waterfall",
      "name": "Waterfall Data",
      "description": "Waterfall/spectrogram data if available",
      "mimeType": "application/json"
    }
  ]
}
```

## Resource Schemas

### Measurement List Response

```json
{
  "type": "object",
  "properties": {
    "measurements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "speaker_id": { "type": "string" },
          "condition": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" },
          "data_type": { "type": "string" },
          "frequency_range_hz": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 2,
            "maxItems": 2
          }
        },
        "required": ["id", "speaker_id", "condition", "timestamp"]
      }
    },
    "count": { "type": "integer" }
  }
}
```

### Stored Measurement Response

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "speaker_id": { "type": "string" },
    "condition": { "type": "string" },
    "mic_position_id": { "type": "string" },
    "notes": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "frequency_response": {
      "type": "object",
      "properties": {
        "frequencies_hz": { "type": "array", "items": { "type": "number" } },
        "spl_db": { "type": "array", "items": { "type": "number" } },
        "phase_degrees": { "type": "array", "items": { "type": "number" } }
      },
      "required": ["frequencies_hz", "spl_db"]
    },
    "impulse_response": {
      "type": "object",
      "properties": {
        "samples": { "type": "array", "items": { "type": "number" } },
        "sample_rate_hz": { "type": "integer" },
        "peak_index": { "type": "integer" },
        "start_time_s": { "type": "number" }
      }
    },
    "quick_stats": {
      "type": "object",
      "properties": {
        "bass_avg_db": { "type": "number" },
        "midrange_avg_db": { "type": "number" },
        "treble_avg_db": { "type": "number" },
        "variance_20_200hz_db": { "type": "number" },
        "variance_200_2000hz_db": { "type": "number" },
        "variance_2000_20000hz_db": { "type": "number" }
      }
    },
    "data_quality": {
      "type": "object",
      "properties": {
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
        "warnings": { "type": "array", "items": { "type": "object" } }
      }
    }
  },
  "required": ["id", "speaker_id", "condition", "frequency_response"]
}
```

### Frequency Response Resource

```json
{
  "type": "object",
  "properties": {
    "measurement_id": { "type": "string" },
    "frequencies_hz": {
      "type": "array",
      "items": { "type": "number" },
      "description": "Frequency values in Hz (ascending order)"
    },
    "spl_db": {
      "type": "array",
      "items": { "type": "number" },
      "description": "SPL values in dB"
    },
    "phase_degrees": {
      "type": "array",
      "items": { "type": "number" },
      "description": "Phase values in degrees (may be 0 if unavailable)"
    },
    "data_points": { "type": "integer" },
    "frequency_range_hz": {
      "type": "array",
      "items": { "type": "number" },
      "minItems": 2,
      "maxItems": 2
    }
  }
}
```

### Impulse Response Resource

```json
{
  "type": "object",
  "properties": {
    "measurement_id": { "type": "string" },
    "samples": {
      "type": "array",
      "items": { "type": "number" },
      "description": "IR sample values (normalized)"
    },
    "sample_rate_hz": { "type": "integer" },
    "peak_index": { "type": "integer" },
    "start_time_s": { "type": "number" },
    "duration_s": { "type": "number" }
  }
}
```

## Usage Examples

### List All Measurements

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/read",
  "params": {
    "uri": "rew://measurements"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "contents": [
      {
        "uri": "rew://measurements",
        "mimeType": "application/json",
        "text": "{\"measurements\": [{\"id\": \"meas_L_pre_glm\", \"speaker_id\": \"L\", \"condition\": \"pre_glm\", \"timestamp\": \"2024-01-20T14:30:00Z\"}], \"count\": 1}"
      }
    ]
  }
}
```

### Read Specific Measurement

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "rew://measurements/meas_L_pre_glm"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "rew://measurements/meas_L_pre_glm",
        "mimeType": "application/json",
        "text": "{\"id\": \"meas_L_pre_glm\", \"speaker_id\": \"L\", \"condition\": \"pre_glm\", \"frequency_response\": {...}, \"quick_stats\": {...}}"
      }
    ]
  }
}
```

### Read Frequency Response Only

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "rew://measurements/meas_L_pre_glm/frequency-response"
  }
}
```

## Error Handling

### Resource Not Found

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32002,
    "message": "Resource not found",
    "data": {
      "uri": "rew://measurements/nonexistent_id"
    }
  }
}
```

### Invalid URI

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid resource URI",
    "data": {
      "uri": "invalid://path"
    }
  }
}
```

## Notes

- Resources are read-only; use `rew.ingest_measurement` tool to add data
- Large arrays (frequency response, IR samples) are returned in full
- For analysis results, use the analysis tools instead of resources
- Resources do not trigger any computation; they return stored data only
