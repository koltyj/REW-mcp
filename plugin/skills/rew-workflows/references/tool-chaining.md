# Tool Chaining Patterns

Detailed sequences for chaining REW MCP tools, including parameters, expected outputs, branching logic, and error recovery.

## Connection and Setup Chain

Every workflow begins with the same three-step setup chain. Never skip steps; each gate-checks the next.

### Step 1: Connect

```
rew.api_connect({ port: 4735 })
```

Expected output:
- `status: "connected"` -- proceed
- `status: "error"` with `diagnostics.server_responding: false` -- REW is not running or API not enabled

On error: direct the user to launch REW with the `-api` flag or enable the API under Preferences. Do not retry automatically more than once.

### Step 2: Configure Audio Devices

```
rew.api_audio({ action: "list_devices" })
```

Inspect the returned device list. Identify the measurement microphone input and the monitor output. Then set them:

```
rew.api_audio({ action: "set_input", device_name: "<mic device>" })
rew.api_audio({ action: "set_output", device_name: "<output device>" })
```

If the expected device is missing from the list, check system audio settings. CoreAudio on macOS requires the device to be recognized at the OS level before REW can see it.

### Step 3: Check Input Levels

```
rew.api_check_levels({})
```

Interpret the `zone` field:

| Zone | Action |
|------|--------|
| `CLIPPING` | Block. Reduce mic gain immediately. Re-check. |
| `HOT` | Reduce mic gain by the recommended dB amount. Re-check. |
| `OPTIMAL` | Proceed to calibration or measurement. |
| `LOW` | Increase mic gain by the recommended dB amount. Re-check. |
| `VERY_LOW` | Block. Increase mic gain significantly or check signal chain. |

If the `feedback.warning` field contains an L/R mismatch warning (>3 dB difference), investigate mic positioning or channel routing before proceeding.

Re-check loop: after each gain adjustment, call `rew.api_check_levels` again. Do not proceed until zone is `OPTIMAL`.

## SPL Calibration Chain

Three-phase state machine. Always run start -> check (loop) -> stop in order.

### Phase 1: Start Calibration

```
rew.api_calibrate_spl({
  action: "start",
  target_spl: 85,
  tolerance_db: 1.0,
  weighting: "C"
})
```

This plays pink noise at -20 dBFS and starts the SPL meter with C-weighting, Slow response. Wait for user confirmation that they hear the pink noise before proceeding.

### Phase 2: Check Loop

```
rew.api_calibrate_spl({
  action: "check",
  target_spl: 85,
  tolerance_db: 1.0,
  weighting: "C"
})
```

Read the `calibration_status` fields:
- `within_tolerance: true` -- target achieved, proceed to stop
- `adjustment_db > 0` -- too quiet, tell user to increase volume by that amount
- `adjustment_db < 0` -- too loud, tell user to decrease volume by that amount

After user adjusts, call `check` again. Repeat until `within_tolerance` is true. Typical convergence: 2-4 iterations.

### Phase 3: Stop Calibration

```
rew.api_calibrate_spl({ action: "stop" })
```

Always call stop, even if calibration was not fully achieved. This stops the pink noise generator and SPL meter.

### Error Recovery

- If `check` returns `success: false` with a message about the SPL meter not reading, the meter may not have been started. Call `start` again.
- If SPL readings are wildly inconsistent (jumping >10 dB between checks), check for environmental noise. Pause and retry when quiet.

## Measurement Session Chain

The session tool enforces left -> right -> sub ordering via state machine validation.

### Start Session

```
rew.api_measurement_session({
  action: "start_session",
  notes: "Initial room measurement - baseline"
})
```

Returns `session_id` (UUID). Store this for all subsequent calls. The response includes `sequence_step: "ready"` and guidance for the first measurement.

### Measure Left

Confirm with user: left speaker is active, mic is at listening position pointing at left speaker.

```
rew.api_measurement_session({
  action: "measure",
  session_id: "<uuid>",
  channel: "left"
})
```

Returns `sequence_step: "left"`, `next_step: "right"`, and the measurement UUID in `measurements` array.

On 403 error: REW Pro license required. Cannot proceed with automated measurements. Inform user and suggest manual measurement in REW.

### Measure Right

Confirm with user: right speaker is now active, mic remains at listening position.

```
rew.api_measurement_session({
  action: "measure",
  session_id: "<uuid>",
  channel: "right"
})
```

Returns `sequence_step: "right"`, `next_step: "sub"`.

### Measure Sub

Confirm with user: subwoofer is active.

```
rew.api_measurement_session({
  action: "measure",
  session_id: "<uuid>",
  channel: "sub"
})
```

Returns `sequence_step: "complete"`, `next_step: null`. All measurements captured.

### Check Status (anytime)

```
rew.api_measurement_session({
  action: "get_status",
  session_id: "<uuid>"
})
```

Returns full session state including all measurements with UUIDs, current step, and guidance. Use this to recover context after interruption.

Without `session_id`, lists all active sessions.

### Sequence Errors

If calling `measure` with a channel out of order (e.g., "right" before "left"), the tool returns a `sequence_error` with the expected next step. Follow the enforced order.

## Analysis Chain

### Unified Analysis (primary path)

After completing a measurement session, extract measurement IDs from the session state and run unified analysis:

```
rew.analyze_room({
  measurement_id: "<left_uuid>",
  left_measurement_id: "<left_uuid>",
  right_measurement_id: "<right_uuid>",
  sub_measurement_id: "<sub_uuid>",
  room_dimensions: { length: 12, width: 10, height: 8 }
})
```

The `measurement_id` field is the primary measurement used for peaks/nulls analysis. Typically use the left channel as the primary. Provide all optional IDs to enable all analysis sections.

Key output fields:
- `overall_severity` -- significant / moderate / minor / negligible
- `top_recommendations[]` -- up to 5, sorted by priority_score (higher is more actionable)
- `analysis_sections.peaks_nulls` -- detected peaks, nulls, SBIR boundary interference
- `analysis_sections.room_modes` -- only populated when `room_dimensions` provided
- `analysis_sections.sub_integration` -- only populated when `sub_measurement_id` provided
- `analysis_sections.lr_symmetry` -- only populated when both L and R measurement IDs provided
- `analysis_sections.glm_comparison` -- always populated (heuristic if no pre-measurement, full with pre)

### GLM Interpretation (Genelec monitors)

If the user has Genelec monitors with GLM calibration:

```
rew.interpret_with_glm_context({
  measurement_id: "<post_glm_uuid>",
  glm_version: "glm4"
})
```

Or with pre/post comparison for higher confidence:

```
rew.interpret_with_glm_context({
  analysis_results: <output from analyze_room>,
  glm_version: "glm4"
})
```

Key output: `overall_verdict.system_readiness` -- ready / ready_with_caveats / needs_attention / not_ready.

### Individual Analysis Tools

Use these only when investigating a specific issue identified by `analyze_room`:

```
rew.analyze_room_modes({
  measurement_id: "<uuid>",
  room_dimensions: { length: 12, width: 10, height: 8 }
})
```

```
rew.analyze_decay({
  measurement_id: "<uuid>"
})
```

```
rew.analyze_impulse({
  measurement_id: "<uuid>"
})
```

Do not run these by default. Run `analyze_room` first and drill into individual tools only when a specific section warrants deeper investigation.

### Comparison Patterns

Before/after comparison (most common):

```
rew.compare_measurements({
  measurement_ids: ["<before_uuid>", "<after_uuid>"],
  comparison_type: "before_after",
  reference_measurement_id: "<before_uuid>"
})
```

L/R symmetry comparison:

```
rew.compare_measurements({
  measurement_ids: ["<left_uuid>", "<right_uuid>"],
  comparison_type: "lr_symmetry"
})
```

With/without sub comparison:

```
rew.compare_measurements({
  measurement_ids: ["<mains_only_uuid>", "<mains_plus_sub_uuid>"],
  comparison_type: "with_without_sub",
  reference_measurement_id: "<mains_only_uuid>"
})
```

Target curve comparison:

```
rew.compare_to_target({
  measurement_id: "<uuid>",
  target_type: "rew_room_curve"
})
```

## Optimization Chain

### Get Recommendation

```
rew.optimize_room({
  action: "get_recommendation",
  measurement_id: "<current_uuid>",
  left_measurement_id: "<left_uuid>",
  right_measurement_id: "<right_uuid>",
  sub_measurement_id: "<sub_uuid>",
  room_dimensions: { length: 12, width: 10, height: 8 }
})
```

Returns a single `recommendation` with:
- `element` -- what to move (speaker, sub, listening_position)
- `action` -- specific instruction (e.g., "Move left speaker 6 inches from rear wall")
- `reason` -- why this helps
- `confidence` -- high / medium / low
- `issue_frequency_hz` -- the specific frequency being addressed

Also returns `priority_rank` (always 1 -- it is the top priority) and `total_issues` (how many remain).

### Validate After Adjustment

After user makes the physical change and a new measurement is taken:

```
rew.optimize_room({
  action: "validate_adjustment",
  measurement_id: "<post_adjustment_uuid>",
  pre_measurement_id: "<pre_adjustment_uuid>",
  target_frequency_hz: 80,
  target_category: "peak"
})
```

The `target_frequency_hz` and `target_category` must match the issue from the recommendation. Categories: `peak`, `null`, `sbir`, `sub_integration`, `lr_symmetry`.

Result classification:
- `success` -- 50%+ reduction in the issue. Proceed to next recommendation.
- `partial` -- some improvement, less than 50%. Consider further adjustment or move on.
- `unchanged` -- no meaningful change. Try a different direction or magnitude.
- `worsened` -- the adjustment made things worse. Revert the change.

### Check Progress

```
rew.optimize_room({
  action: "check_progress",
  measurement_id: "<current_uuid>",
  left_measurement_id: "<left_uuid>",
  right_measurement_id: "<right_uuid>",
  sub_measurement_id: "<sub_uuid>"
})
```

Evaluates zone-based success criteria:
- Smoothness (40-200 Hz variance): excellent / good / fair / poor
- L/R balance: if L/R measurements provided
- Sub integration: if sub measurement provided

When `should_stop` is true, the room has reached "good" smoothness. Further optimization yields diminishing returns.

### Full Optimization Loop

```
[analyze_room] -> identify issues
  |
  v
[optimize_room: get_recommendation] -> present to user
  |
  v
[User makes adjustment]
  |
  v
[api_measurement_session: measure] -> capture new data
  |
  v
[optimize_room: validate_adjustment] -> assess result
  |
  +-- success/partial -> [optimize_room: check_progress]
  |                         |
  |                         +-- should_stop: true -> DONE
  |                         +-- should_stop: false -> back to get_recommendation
  |
  +-- unchanged -> suggest different direction, retry adjustment
  |
  +-- worsened -> revert change, try alternative
```

## Data Ingestion Patterns

### From REW Text Export

When the user provides a REW text export file:

```
rew.ingest_measurement({
  file_contents: "<raw text content>",
  metadata: {
    speaker_id: "L",
    condition: "pre_glm",
    notes: "Left speaker, no GLM calibration"
  }
})
```

Valid `speaker_id` values: L, R, C, Sub, Combined, LFE, SL, SR, RL, RR.
The `condition` field must be alphanumeric with underscores (e.g., `baseline`, `post_treatment`, `position_2`).

### From REW API

When working with measurements already in REW:

```
rew.api_list_measurements({})
```

Returns array of measurement summaries with UUIDs. Then fetch specific ones:

```
rew.api_get_measurement({ uuid: "<measurement_uuid>" })
```

### Import Into REW

To import data into REW (rather than into the MCP server's store):

```
rew.api_import({
  action: "frequency_response_data",
  data: "<frequency response data>",
  name: "Imported measurement"
})
```

## Error Recovery Patterns

### Connection Lost Mid-Workflow

Symptom: any API tool returns `connection_error`.

Recovery:
1. Call `rew.api_connect` to re-establish connection
2. Call `rew.api_measurement_session({ action: "get_status" })` to check if session survived
3. If session exists, resume from current `sequence_step`
4. If session is gone (server restarted), create new session and re-measure

### Measurement Fails

Symptom: `measure` action returns error.

Recovery by error type:
- `license_error` (403): REW Pro required. Cannot work around. Inform user.
- `api_error`: check REW is not busy (close any modal dialogs). Retry once.
- `connection_error`: re-connect (see above).
- Measurement captured but data looks wrong (flat line, noise floor only): check mic connection, input device selection, and input levels.

### Levels Clipping During Calibration

Symptom: `api_check_levels` returns `CLIPPING` zone.

Recovery:
1. Call `rew.api_calibrate_spl({ action: "stop" })` if calibration is active
2. Direct user to reduce mic preamp gain by 6-10 dB
3. Call `rew.api_check_levels` to verify
4. Repeat until zone is `OPTIMAL`
5. Restart calibration

### Analysis Returns No Issues

Symptom: `analyze_room` returns `overall_severity: "negligible"` and zero recommendations.

This is a valid result. The room response is already good. Run `compare_to_target` against the intended target curve to confirm the response meets expectations. If the user perceives problems that the analysis does not detect, investigate with individual analysis tools (`analyze_decay` for ringing, `analyze_impulse` for reflections).

### Optimization Stuck (Worsened Loop)

Symptom: repeated `validate_adjustment` results show `worsened`.

Recovery:
1. Revert to the last known good position
2. Re-measure to confirm reversion
3. Call `optimize_room({ action: "get_recommendation" })` with the reverted measurement -- it may suggest a different approach
4. If the same recommendation recurs, skip it and call `check_progress` to see if remaining issues warrant further work
5. Consider that room constraints may limit improvement in that frequency range

## Prompt Invocation Patterns

### When to Use Prompts vs. Direct Tool Calls

Use prompts when the user requests a complete workflow ("calibrate my room", "measure my monitors"). Prompts embed checkpoint guidance and session context.

Use direct tool calls when performing a specific action ("check my levels", "compare these two measurements") or when building a custom workflow.

### Prompt -> Tool Mapping

| User Request | Prompt | Key Tools Used |
|---|---|---|
| "Calibrate my room" / "Full calibration" | `rew_calibration_full` | connect, audio, check_levels, calibrate_spl, measurement_session, analyze_room, optimize_room |
| "Set my monitor levels" / "Gain staging" | `rew_gain_staging` | connect, calibrate_spl |
| "Take measurements" / "Measure my room" | `rew_measurement_workflow` | measurement_session (requires existing session_id) |
| "Optimize my placement" / "Fix my room" | `rew_optimization_workflow` | analyze_room, optimize_room (requires existing session_id with measurements) |

### Chaining Prompts

For a complete first-time setup:
1. Invoke `rew_calibration_full` (handles everything)

For returning users with an existing session:
1. Invoke `rew_measurement_workflow` with the session_id
2. After measurements complete, invoke `rew_optimization_workflow` with the same session_id

## Resource Access Patterns

### Maintaining Context Across Calls

Read session state to avoid redundant tool calls:

```
Read resource: session://<session_id>
```

Returns the current sequence step, all measurement UUIDs, and metadata. Use this to resume a workflow after interruption rather than calling `get_status`.

### Tracking Recommendations

```
Read resource: recommendations://<session_id>
```

Returns active recommendations from the most recent analysis. Use this to recall what was recommended without re-running `analyze_room`.

### Accessing Measurement Data

```
Read resource: measurement://<measurement_id>
```

Returns full frequency response arrays. Use this when a tool needs measurement data that was previously ingested or fetched, avoiding duplicate `api_get_measurement` calls.
