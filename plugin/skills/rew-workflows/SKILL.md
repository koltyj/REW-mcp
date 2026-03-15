---
name: rew-workflows
description: This skill should be used when the user asks to "measure my room", "calibrate my monitors", "analyze my measurements", "optimize speaker placement", "run a calibration", "check my levels", "do a measurement session", "compare before and after", "what should I measure next", or when working with REW MCP server tools and needing guidance on workflow sequencing, tool chaining, and best practices for room measurement campaigns.
---

# REW MCP Workflows

This skill encodes the canonical tool-chaining sequences, prompt invocations, and resource access patterns for the REW MCP server. Apply these patterns whenever orchestrating room measurement, calibration, analysis, or optimization tasks.

## Tool Overview

The REW MCP server exposes tools across six categories. Each tool follows an action-based input pattern and returns structured JSON with `status`, `data`, and error fields.

### Setup

- **`rew.api_connect`** -- Establish connection to a running REW instance. Default port 4735. Must call before any other API tool. Returns REW version, measurement count, and capability flags (pro_features, blocking_mode).
- **`rew.api_audio`** -- Configure audio devices. Actions: `status`, `list_devices`, `set_input`, `set_output`, `set_sample_rate`. Use to select the measurement microphone and output device before measuring.
- **`rew.api_check_levels`** -- Read input levels and classify into zones: CLIPPING, HOT, OPTIMAL (-20 to -10 dBFS), LOW, VERY_LOW. Blocks measurement for CLIPPING or VERY_LOW zones. Provides per-channel RMS/peak and L/R mismatch detection (>3 dB triggers warning).

### Calibration

- **`rew.api_calibrate_spl`** -- Semi-automated SPL calibration. Three-phase state machine: `start` (play pink noise at -20 dBFS + start SPL meter with C-weighting Slow), `check` (read current SPL, calculate adjustment from target, generate guidance), `stop` (stop generator and meter). Default target: 85 dB. Tolerance: 1.0 dB.
- **`rew.api_generator`** -- Signal generator control. Actions: `status`, `start`, `stop`, `set_signal`, `set_level`, `set_frequency`, `list_signals`. Generates pink noise, sweeps, tones.

### Measurement

- **`rew.api_measure`** -- Direct measurement control. Actions: `status`, `sweep`, `spl`, `cancel`, `configure`. Sweep measurements require REW Pro license.
- **`rew.api_measurement_session`** -- Guided L/R/Sub measurement sequence with persistent session state. Actions: `start_session` (create new session, get UUID), `measure` (trigger measurement for a channel: left/right/sub), `get_status` (check progress or list active sessions), `stop_session`. Enforces sequence order: left -> right -> sub -> complete. Auto-names measurements with session prefix.
- **`rew.api_measure_workflow`** -- Orchestrated measurement workflow. Actions: `setup` (auto-configure devices), `check_levels`, `calibrate_level`, `measure` (single sweep), `measure_sequence` (L/R or multi-position). Handles device selection, blocking mode, and result retrieval.

### Analysis

- **`rew.analyze_room`** -- Unified analysis combining peaks/nulls, room modes (requires dimensions), sub integration (requires sub measurement), L/R symmetry (requires L+R measurements), and GLM calibration transparency (full with pre+post, heuristic with post-only). Returns top 5 prioritized recommendations scored 60% fixability + 40% severity. Always use this as the primary analysis entry point.
- **`rew.analyze_room_modes`** -- Standalone room mode analysis. Correlates detected peaks with theoretical axial/tangential/oblique modes from room dimensions.
- **`rew.analyze_decay`** -- ISO 3382 decay analysis (T20/T30/EDT) from impulse response data. Identifies frequencies with excessive ringing.
- **`rew.analyze_impulse`** -- Early reflection detection and path estimation from impulse data.
- **`rew.compare_measurements`** -- Compare 2-10 measurements. Types: `before_after`, `placement_comparison`, `lr_symmetry`, `with_without_sub`. Returns per-band analysis with improvement scores.
- **`rew.compare_to_target`** -- Compare a measurement against target curves: `flat`, `rew_room_curve` (LF rise + HF roll), `harman`, or custom. Returns deviation stats.

### Optimization

- **`rew.optimize_room`** -- Iterative optimization guidance. Three actions:
  - `get_recommendation` -- Return the single highest-priority placement or settings recommendation. One at a time for scientific rigor.
  - `validate_adjustment` -- Compare pre/post measurement at a target frequency to classify result as success (>50% reduction), partial, unchanged, or worsened.
  - `check_progress` -- Evaluate zone-based success criteria (smoothness 40-200 Hz, L/R balance, sub integration). Returns `should_stop` flag when smoothness reaches "good" zone.

### Data

- **`rew.ingest_measurement`** -- Parse REW text export (frequency response or impulse response) into internal store. Requires `speaker_id` (L/R/Sub/etc.) and `condition` metadata.
- **`rew.api_get_measurement`** -- Fetch a measurement from REW by UUID (not index -- indices shift).
- **`rew.api_list_measurements`** -- List all measurements in the connected REW instance.
- **`rew.api_import`** -- Import measurement data into REW. Actions: `frequency_response_file`, `frequency_response_data`, `impulse_response_file`, `impulse_response_data`, `rta_file`, `sweep_recording`.

### GLM Integration

- **`rew.interpret_with_glm_context`** -- Interpret analysis results considering Genelec GLM capabilities and limitations. Classifies corrections as successfully applied, beyond scope, or residual. Supports GLM 3 and 4 version-specific behavior. Provides system readiness verdict.

### Advanced

- **`rew.average_measurements`** -- Spatial averaging from multiple positions. Methods: RMS (incoherent, recommended for spatial averaging), Vector (coherent, requires phase), or hybrid.
- **`rew.api_spl_meter`** -- SPL meter control. Actions: `start`, `stop`, `read`, `configure`. Supports A/C/Z weighting, Slow/Fast/Impulse response.
- **`rew.api_rta`** -- Real-time analyzer. Actions: `start`, `stop`, `capture`, `reset`, `configure`, `read_levels`, `read_captured`, `read_distortion`.
- **`rew.api_eq`** -- Global EQ management. Actions: `list_equalisers`, `list_manufacturers`, `get_defaults`, `set_defaults`, `get_house_curve`, `set_house_curve`.
- **`rew.api_measurement_eq`** -- Per-measurement EQ. Actions: `get_equaliser`, `set_equaliser`, `get_filters`, `set_filters`, `get_target`, `set_target`, `predicted_response`, `filter_response`, `match_target`.
- **`rew.api_measurement_commands`** -- Per-measurement commands. Actions: `list_commands`, `execute`.
- **`rew.api_groups`** -- Measurement group management. Actions: `list`, `create`, `get`, `update`, `delete`, `list_measurements`, `add_measurement`, `remove_measurement`.

## Workflow Sequences

### 1. Full Calibration (first-time setup)

The end-to-end workflow for a new studio or after major changes. Follow this exact sequence:

```
rew.api_connect
  -> rew.api_audio (list_devices, set_input, set_output)
  -> rew.api_check_levels
  -> rew.api_calibrate_spl (start -> check loop -> stop)
  -> rew.api_measurement_session (start_session)
  -> rew.api_measurement_session (measure: left)
  -> rew.api_measurement_session (measure: right)
  -> rew.api_measurement_session (measure: sub)
  -> rew.analyze_room (with L/R/Sub measurement IDs + dimensions)
  -> rew.interpret_with_glm_context (if Genelec monitors)
  -> rew.optimize_room (get_recommendation -> validate -> check_progress loop)
```

Pause for user input before playing audio, before each measurement, and before each physical adjustment. Invoke the `rew_calibration_full` prompt to activate this workflow with embedded guidance.

### 2. Quick Re-measure (after physical change)

Use when re-measuring after moving speakers, adding treatment, or changing position:

```
rew.api_connect (if not already connected)
  -> rew.api_measurement_session (start_session)
  -> rew.api_measurement_session (measure: left/right/sub as needed)
  -> rew.analyze_room
  -> rew.compare_measurements (before_after with previous session's measurements)
  -> rew.optimize_room (validate_adjustment on the specific issue addressed)
```

### 3. Analysis Only (existing measurements)

For offline analysis of previously exported REW data:

```
rew.ingest_measurement (for each exported file)
  -> rew.analyze_room (with ingested measurement IDs)
  -> rew.compare_to_target (against flat, room curve, or Harman)
  -> rew.interpret_with_glm_context (if applicable)
```

Or for measurements already in REW:

```
rew.api_connect
  -> rew.api_list_measurements
  -> rew.api_get_measurement (for each relevant measurement)
  -> rew.analyze_room
```

### 4. Optimization Cycle (iterative improvement)

The measure-adjust-validate loop. Never skip validation:

```
rew.optimize_room (action: get_recommendation)
  -> [User makes physical change]
  -> rew.api_measurement_session (measure the affected channel)
  -> rew.optimize_room (action: validate_adjustment, with pre/post IDs + target freq)
  -> rew.optimize_room (action: check_progress)
  -> [Repeat until should_stop or user satisfied]
```

Stop conditions: smoothness reaches "good" zone, user is satisfied, or diminishing returns detected.

## MCP Prompts

Prompts provide pre-built conversational workflows. Invoke them to activate structured multi-step guidance with built-in checkpoints.

- **`rew_calibration_full`** -- Complete end-to-end calibration workflow. Optional args: `target_spl_db` (default 85), `room_dimensions` (format "LxWxH" in feet). Covers gain staging through optimization.
- **`rew_gain_staging`** -- Standalone SPL calibration using pink noise and SPL meter. Optional arg: `target_spl_db`. Does not require or create a measurement session.
- **`rew_measurement_workflow`** -- Session-aware L/R/Sub measurement sequence. Required arg: `session_id`. Embeds session state as a resource. Tracks remaining measurements and provides step-by-step guidance.
- **`rew_optimization_workflow`** -- Iterative placement optimization with measurement validation. Required arg: `session_id` (must have completed measurements). Embeds session state. Enforces scientific method: one recommendation, measure, validate, repeat.

## MCP Resources

Resources provide read-only access to session and measurement state via URI templates.

- **`session://{session_id}`** -- Current session state: sequence step, completed measurements (with UUIDs, channels, timestamps), target SPL, notes.
- **`measurement://{measurement_id}`** -- Full measurement data including frequency response arrays (frequencies_hz, spl_db).
- **`recommendations://{session_id}`** -- Active recommendations for a session from analysis and optimization tools.
- **`history://{session_id}`** -- Measurement history and summaries for a session.

Access resources to maintain context across tool calls without re-running analysis. Session resources update automatically as measurements are taken.

## Best Practices

### Pre-Measurement Checklist

- Always call `rew.api_connect` first. Every other API tool depends on it and returns a connection error without it.
- Always run `rew.api_check_levels` before measuring. Do not proceed if the zone is CLIPPING or VERY_LOW.
- Calibrate SPL to 85 dB (broadcast reference) before any measurements. This ensures consistent level reference across sessions.
- Confirm the correct input device (measurement mic) and output device via `rew.api_audio` before measuring.

### Measurement Discipline

- Measure L, R, and Sub separately -- never all at once. The session tool enforces left -> right -> sub ordering.
- Use UUID-based measurement references, not indices. Indices shift when measurements are added or removed in REW.
- Auto-naming uses `{session_prefix}_{channel}` format. Do not override unless the user requests custom naming.
- REW Pro license is required for automated sweep measurements. If a 403 error occurs, inform the user about the license requirement.

### Analysis Strategy

- Use `rew.analyze_room` as the primary analysis entry point. It combines peaks/nulls, room modes, sub integration, L/R symmetry, and GLM comparison into a single prioritized result. Do not call individual analysis tools (`analyze_room_modes`, `analyze_decay`, etc.) unless investigating a specific isolated issue.
- Provide room dimensions when available -- they enable theoretical mode correlation, which significantly improves recommendation quality.
- If both pre-GLM and post-GLM measurements exist, pass both to `analyze_room` for full GLM comparison rather than heuristic mode.

### Optimization Discipline

- Use `rew.optimize_room` for one-at-a-time recommendations. Never attempt to fix multiple issues simultaneously -- changes interact and prior measurements become invalid.
- Always validate adjustments with new measurements. Never assume an adjustment helped without measuring.
- Compare before/after for every physical change using `rew.compare_measurements` with `before_after` type.
- Prioritize placement and settings adjustments (free, high impact) before recommending acoustic treatment (cost, variable impact).
- Stop optimization when `check_progress` returns `should_stop: true` or when improvements fall below 1 dB per iteration.

### Error Recovery

- Connection refused: REW is not running or API is not enabled. Direct the user to enable the API in REW Preferences or launch with the `-api` flag.
- Timeout: REW may be busy processing. Wait and retry once. If persistent, check if REW is frozen.
- Level clipping: Reduce mic gain or generator level before retrying. Never proceed with clipped input.
- Measurement fails with 403: REW Pro license required. Cannot be worked around for automated sweeps.
- Session not found: Sessions are in-memory only. If the server restarted, create a new session.

For detailed tool chaining patterns, parameter examples, and error recovery sequences, see `references/tool-chaining.md`.
