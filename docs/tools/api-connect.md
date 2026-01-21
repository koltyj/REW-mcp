# rew.api_connect

Connect to a running REW instance's REST API.

## Description

Establishes connection to REW's REST API for live measurement access.
REW must be launched with `-api` flag or have API enabled in preferences.

**Important**: The REW REST API requires **version 5.30 or later**.

## Prerequisites

- REW version 5.30+ running
- API enabled and started in Preferences → API
- Default port: 4735
- Access restricted to localhost (127.0.0.1)

## Enabling the REW API

1. Open REW
2. Go to **Preferences → API**
3. Check **Enable API** 
4. Click the **Start** button
5. Note the port number (default: 4735)

Alternatively, launch REW from terminal with the `-api` flag:
- **macOS**: `open -a REW.app --args -api`
- **Windows**: `"C:\Program Files\REW\roomeqwizard.exe" -api`

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
- `diagnostics` - Connection diagnostics (see below)

### Diagnostics Object

When connection fails, the diagnostics object provides detailed troubleshooting info:
- `server_responding` - Whether any server responded at the URL
- `openapi_available` - Whether the REW OpenAPI spec was found
- `api_version` - API version from OpenAPI spec (if available)
- `tested_url` - The URL that was tested

## Troubleshooting

### HTTP 404 Error

This means a server is responding but the REW API endpoint wasn't found. Common causes:

1. **REW version too old** - API requires v5.30+. Check Help → About REW.
2. **API not started** - Go to Preferences → API and click "Start"
3. **Wrong port** - Verify the port in Preferences → API matches your connection

### Connection Refused

REW is not responding at all. Common causes:

1. **REW not running** - Start REW first
2. **API not enabled** - Enable in Preferences → API
3. **Firewall blocking** - Check macOS System Settings → Privacy & Security → Firewall

### Verifying API is Running

You can verify the API is working by opening a browser to:
- `http://localhost:4735` - Should show Swagger UI
- `http://localhost:4735/doc.json` - Should return OpenAPI spec

## Related Tools

- `rew.api_list_measurements` - List available measurements
- `rew.api_get_measurement` - Fetch specific measurement

## Reference

REW API Documentation:
https://www.roomeqwizard.com/help/help_en-GB/html/api.html
