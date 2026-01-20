# rew.api_connect

Connect to a running REW instance's REST API.

## Description

Establishes connection to REW's REST API for live measurement access.
REW must be launched with `-api` flag or have API enabled in preferences.

## Prerequisites

- REW running with API enabled
- Default port: 4735
- Access restricted to localhost (127.0.0.1)

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "port": {
      "type": "integer",
      "default": 4735,
      "minimum": 1025,
      "maximum": 65535,
      "description": "REW API port"
    },
    "timeout_ms": {
      "type": "integer",
      "default": 10000,
      "minimum": 1000,
      "maximum": 60000,
      "description": "Connection timeout in milliseconds"
    },
    "host": {
      "type": "string",
      "default": "127.0.0.1",
      "description": "Host address"
    }
  }
}
```

## Output

Returns connection status:
- `status` - "connected" or "error"
- `rew_version` - REW version string
- `measurements_available` - Number of measurements in REW
- `api_capabilities` - Pro features, blocking mode availability

## Related Tools

- `rew.api_list_measurements` - List available measurements
- `rew.api_get_measurement` - Fetch specific measurement

## Reference

REW API Documentation:
https://www.roomeqwizard.com/help/help_en-GB/html/api.html
