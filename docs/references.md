# External References

This document compiles authoritative external sources used in this documentation. When implementing the MCP server, always verify behavior against these primary sources.

## Room EQ Wizard (REW)

### Official Documentation

| Resource | URL | Content |
|----------|-----|---------|
| REW Help Index | https://www.roomeqwizard.com/help/help_en-GB/html/index.html | Complete help documentation |
| File Menu (Exports) | https://www.roomeqwizard.com/help/help_en-GB/html/file.html | Export format details |
| REW API | https://www.roomeqwizard.com/help/help_en-GB/html/api.html | HTTP API specification |
| Impulse Response | https://www.roomeqwizard.com/help/help_en-GB/html/impulseresponse.html | IR concepts |
| Waterfall Graph | https://www.roomeqwizard.com/help/help_en-GB/html/graph_waterfall.html | Waterfall generation |
| RT60 Graph | https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html | Decay measurement |
| The Limits of EQ | https://www.roomeqwizard.com/help/help_en-GB/html/iseqtheanswer.html | EQ limitations |
| Room Simulation | https://www.roomeqwizard.com/help/help_en-GB/html/modalsim.html | Room mode calculator |
| Data Import | https://www.roomeqwizard.com/help/help_en-GB/html/dataimport.html | Import formats |

### REW API Details (from official docs)

- **Default port**: 4735
- **Host**: localhost (127.0.0.1) only
- **OpenAPI spec**: `localhost:4735/doc.json` or `localhost:4735/doc.yaml`
- **Array encoding**: Base64, big-endian 32-bit floats
- **Pro license required**: For automated sweep measurements

### REW Export Formats (from File Menu docs)

1. **Frequency Response Text**: FRD-compatible, space-delimited, comment lines start with `*`
2. **Impulse Response Text**: Header with metadata, followed by sample values
3. **WAV export**: 16/24/32-bit PCM or 32-bit float, mono or stereo
4. **MDAT**: Binary format (proprietary)

---

## Model Context Protocol (MCP)

### Official Specification

| Resource | URL | Content |
|----------|-----|---------|
| MCP Documentation | https://modelcontextprotocol.io/ | Main documentation site |
| Tools Specification | https://modelcontextprotocol.io/specification/2025-06-18/server/tools | Tool definition spec |
| Resources | https://modelcontextprotocol.io/specification/2025-06-18/server/resources | Resource handling |

### MCP Tool Requirements (from specification)

Tools MUST:
- Validate all inputs
- Implement proper access controls
- Rate limit invocations
- Sanitize outputs

Tool Definition Schema:
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "inputSchema": {
    "type": "object",
    "properties": {...},
    "required": [...]
  }
}
```

Tool Results can include:
- Text content
- Image content
- Structured content (JSON)
- Resource links

---

## Genelec GLM

### Official Resources

| Resource | URL | Content |
|----------|-----|---------|
| GLM Software Page | https://www.genelec.com/glm | Product overview |
| SAM Technology | https://www.genelec.com/sam | Smart Active Monitoring |
| Genelec Support | https://www.genelec.com/support | Technical support |

### GLM Design Philosophy (from Genelec documentation)

1. **Cut-only correction**: Minimizes distortion and power consumption
2. **In-room target response**: Flat in-room, accounting for room gain
3. **Conservative correction**: Avoids over-processing
4. **Focus on LF**: Primary correction below 500 Hz
5. **No null boosting**: Deep nulls left unchanged by design

### GLM Capabilities (documented behavior)

| Feature | GLM 3 | GLM 4 |
|---------|-------|-------|
| AutoCal | Yes | Yes (improved) |
| Multi-point measurement | No | Yes (GRADE) |
| Level matching | Yes | Yes |
| Delay alignment | Yes | Yes |
| Subwoofer integration | Basic | Advanced |
| Room acoustic reports | No | Yes (GRADE) |

---

## Acoustic Theory References

### Room Modes

**Axial mode formula**:
```
f = c / (2L) × n

where:
  c = 343 m/s (speed of sound at 20°C)
  L = room dimension in meters
  n = mode order (1, 2, 3, ...)
```

**Schroeder frequency**:
```
f_s = 2000 × √(RT60 / V)

where:
  RT60 = reverberation time in seconds
  V = room volume in m³
```

### SBIR (Speaker-Boundary Interference Response)

**Quarter-wave cancellation**:
```
f_null = c / (4d)

where:
  d = distance from speaker to boundary
```

### Comb Filtering

**Null frequencies from reflection**:
```
f_null = (2n + 1) / (2t)

where:
  t = delay time in seconds
  n = 0, 1, 2, ...
```

### Recommended Reading

- F. Alton Everest, "Master Handbook of Acoustics" (McGraw-Hill)
- Philip Newell, "Recording Studio Design" (Focal Press)
- Bob Katz, "Mastering Audio" (Focal Press)

---

## Standards

### ISO 3382: Room Acoustics

Defines measurement parameters:
- RT60: Reverberation time (60 dB decay)
- T30: Decay time extrapolated from 30 dB decay
- C50, C80: Clarity indices
- D50: Definition (ratio of early to total energy)

### IEC 61672: Sound Level Meters

Defines:
- A, C, Z frequency weightings
- Sound level measurement standards

---

## Implementation Notes

### When in Doubt

1. **Check REW documentation first**: https://www.roomeqwizard.com/help/help_en-GB/html/index.html
2. **Test with actual REW exports**: The documentation describes file formats, but always verify with real files
3. **REW API swagger**: When REW is running with API enabled, `localhost:4735` provides interactive API docs

### Version Considerations

- REW versions may differ slightly in export format
- Always parse metadata to detect version
- Handle both old and new format variations gracefully

### GLM Behavior

- Do not assume GLM capabilities beyond documented behavior
- When uncertain whether GLM can address an issue, state "may or may not be addressable"
- Always recommend physical solutions for deep nulls (>10 dB)

---

## Validation Checklist

Before finalizing any analysis algorithm, verify against:

- [ ] REW documentation for measurement methodology
- [ ] MCP specification for tool interface compliance
- [ ] Genelec documentation for GLM behavior claims
- [ ] Acoustic theory for physics-based calculations
- [ ] Real measurement data for edge cases

---

## Document Maintenance

This documentation should be updated when:

1. REW releases new versions with format changes
2. MCP specification is updated
3. Genelec releases new GLM versions
4. Errors or inaccuracies are discovered

Last verified: January 2024
REW version referenced: 5.31+
MCP specification version: 2025-06-18
GLM version referenced: GLM 4
