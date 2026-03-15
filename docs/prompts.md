# MCP Prompts

This document specifies the prompts exposed by the REW MCP server.

> **Reference**: MCP Prompts Specification (Protocol Version 2025-06-18)
> https://modelcontextprotocol.io/specification/2025-06-18/server/prompts

## Overview

Prompts provide reusable workflow templates for common REW analysis tasks. They guide LLMs through multi-step analysis processes.

## Prompt List

```json
{
  "prompts": [
    {
      "name": "glm_comparison_workflow",
      "description": "Compare pre-GLM and post-GLM measurements to assess calibration effectiveness",
      "arguments": [
        {
          "name": "pre_glm_file",
          "description": "Contents of the pre-GLM measurement file (REW text export)",
          "required": true
        },
        {
          "name": "post_glm_file",
          "description": "Contents of the post-GLM measurement file (REW text export)",
          "required": true
        },
        {
          "name": "speaker_id",
          "description": "Speaker channel identifier (L, R, Sub, etc.)",
          "required": true
        }
      ]
    },
    {
      "name": "placement_optimization",
      "description": "Compare measurements from different speaker placements to determine optimal position",
      "arguments": [
        {
          "name": "placement_files",
          "description": "Array of measurement file contents, one per placement",
          "required": true
        },
        {
          "name": "placement_labels",
          "description": "Array of labels for each placement (e.g., 'Position A', 'Position B')",
          "required": true
        },
        {
          "name": "speaker_id",
          "description": "Speaker channel identifier",
          "required": true
        }
      ]
    },
    {
      "name": "room_analysis_complete",
      "description": "Perform complete room acoustic analysis including modes, decay, and reflections",
      "arguments": [
        {
          "name": "measurement_file",
          "description": "Contents of REW measurement file with frequency response and impulse response",
          "required": true
        },
        {
          "name": "speaker_id",
          "description": "Speaker channel identifier",
          "required": true
        },
        {
          "name": "room_dimensions_m",
          "description": "Optional room dimensions as {length, width, height} in meters",
          "required": false
        }
      ]
    },
    {
      "name": "lr_symmetry_check",
      "description": "Check left/right speaker symmetry for stereo imaging assessment",
      "arguments": [
        {
          "name": "left_measurement_file",
          "description": "Contents of left speaker measurement file",
          "required": true
        },
        {
          "name": "right_measurement_file",
          "description": "Contents of right speaker measurement file",
          "required": true
        }
      ]
    },
    {
      "name": "subwoofer_integration",
      "description": "Analyze subwoofer integration with main speakers",
      "arguments": [
        {
          "name": "mains_only_file",
          "description": "Measurement with main speakers only (no sub)",
          "required": true
        },
        {
          "name": "mains_plus_sub_file",
          "description": "Measurement with main speakers and subwoofer",
          "required": true
        },
        {
          "name": "sub_only_file",
          "description": "Optional: Measurement with subwoofer only",
          "required": false
        }
      ]
    }
  ]
}
```

## Prompt Templates

### glm_comparison_workflow

```markdown
# GLM Calibration Comparison Workflow

## Step 1: Ingest Pre-GLM Measurement
Call `rew.ingest_measurement` with:
- file_contents: {{pre_glm_file}}
- metadata: { speaker_id: "{{speaker_id}}", condition: "pre_glm" }

## Step 2: Ingest Post-GLM Measurement
Call `rew.ingest_measurement` with:
- file_contents: {{post_glm_file}}
- metadata: { speaker_id: "{{speaker_id}}", condition: "post_glm" }

## Step 3: Compare Measurements
Call `rew.compare_measurements` with:
- measurement_ids: [pre_glm_id, post_glm_id]
- comparison_type: "before_after"
- reference_measurement_id: pre_glm_id

## Step 4: Interpret with GLM Context
Call `rew.interpret_with_glm_context` with:
- comparison_id: (from step 3)

## Step 5: Summarize Findings
Based on the analysis:
1. List issues GLM successfully addressed
2. List issues beyond GLM's scope
3. Provide recommendations for remaining issues

Remember: GLM uses cut-only correction and cannot address deep nulls or decay times.
```

### placement_optimization

```markdown
# Speaker Placement Optimization Workflow

## Step 1: Ingest All Placement Measurements
For each placement file in {{placement_files}}:
Call `rew.ingest_measurement` with:
- file_contents: (file content)
- metadata: { speaker_id: "{{speaker_id}}", condition: (corresponding label) }

## Step 2: Analyze Room Modes for Each
For each measurement:
Call `rew.analyze_room_modes` with:
- measurement_id: (measurement id)

## Step 3: Compare All Placements
Call `rew.compare_measurements` with:
- measurement_ids: [all measurement ids]
- comparison_type: "placement_comparison"

## Step 4: Determine Optimal Placement
Evaluate based on:
1. Lowest bass variance (smoother response)
2. Fewest severe peaks/nulls
3. Best mode distribution
4. Practical considerations

Provide recommendation with confidence level and trade-offs.
```

### room_analysis_complete

```markdown
# Complete Room Acoustic Analysis Workflow

## Step 1: Ingest Measurement
Call `rew.ingest_measurement` with:
- file_contents: {{measurement_file}}
- metadata: { speaker_id: "{{speaker_id}}", condition: "room_analysis" }

## Step 2: Analyze Room Modes
Call `rew.analyze_room_modes` with:
- measurement_id: (from step 1)
{{#if room_dimensions_m}}
- room_dimensions_m: {{room_dimensions_m}}
{{/if}}

## Step 3: Analyze Decay (if waterfall data available)
Call `rew.analyze_decay` with:
- measurement_id: (from step 1)

## Step 4: Analyze Impulse Response (if IR data available)
Call `rew.analyze_impulse` with:
- measurement_id: (from step 1)

## Step 5: Synthesize Findings
Combine all analyses to provide:
1. Primary acoustic issues (ranked by severity)
2. Issues addressable by EQ/GLM
3. Issues requiring physical treatment
4. Prioritized action recommendations
```

## Usage Examples

### Get Prompt

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/get",
  "params": {
    "name": "glm_comparison_workflow",
    "arguments": {
      "pre_glm_file": "* Freq(Hz) SPL(dB)...",
      "post_glm_file": "* Freq(Hz) SPL(dB)...",
      "speaker_id": "L"
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "description": "Compare pre-GLM and post-GLM measurements to assess calibration effectiveness",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "# GLM Calibration Comparison Workflow\n\n## Step 1: Ingest Pre-GLM Measurement\nCall `rew.ingest_measurement` with:\n- file_contents: * Freq(Hz) SPL(dB)...\n- metadata: { speaker_id: \"L\", condition: \"pre_glm\" }\n\n..."
        }
      }
    ]
  }
}
```

### List Prompts

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list"
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "prompts": [
      {
        "name": "glm_comparison_workflow",
        "description": "Compare pre-GLM and post-GLM measurements to assess calibration effectiveness",
        "arguments": [...]
      },
      {
        "name": "placement_optimization",
        "description": "Compare measurements from different speaker placements",
        "arguments": [...]
      }
    ]
  }
}
```

## Notes

- Prompts guide workflows but do not execute tools automatically
- The LLM interprets the prompt and makes tool calls
- Arguments are substituted into the prompt template
- Prompts help ensure consistent analysis workflows
