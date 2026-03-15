---
name: status
description: Show current REW session state — what's been measured, calibration status, active recommendations, and next recommended step.
allowed-tools: ["mcp"]
---

Gather and present a clean status summary of the current REW session state.

## Step 1: Connect

Call `rew.api_connect` with default parameters. If connection fails, report that REW is not reachable and suggest launching it with the `-api` flag. Do not proceed further.

## Step 2: Gather State

Run these calls to collect session information:

1. Call `rew.api_measurement_session` with action `get_status` to check for active sessions. Note the session ID, sequence step, and measurements taken.
2. Call `rew.api_list_measurements` to get all measurements currently loaded in REW.
3. Call `rew.api_audio` with action `status` to get the current audio device configuration.

## Step 3: Determine State and Next Step

Based on the gathered information, determine which state the user is in and what they should do next:

### State: No Connection
- REW is not running or API is not enabled.
- Next step: "Launch REW with the -api flag and run `/rew:status` again."

### State: Connected, No Measurements
- REW is running but no measurements exist.
- Next step: "Run `/rew:calibrate` to set up audio devices, calibrate SPL, and take initial measurements."

### State: Measurements Exist, No Active Session
- Measurements are loaded in REW but there is no active measurement session.
- List the available measurements by name and type.
- Next step: "Run `/rew:analyze` to analyze these measurements, or `/rew:calibrate` to start a fresh calibration session."

### State: Active Session, Measurements In Progress
- A session is active and some measurements have been taken.
- Show which channels have been measured (L/R/Sub) and which remain.
- Next step: "Continue the measurement session -- [list remaining channels] still need to be measured."

### State: Active Session, All Measurements Complete
- Session exists with L/R (and optionally Sub) measurements complete.
- Next step: "Run `/rew:analyze` to get a comprehensive room analysis with prioritized recommendations."

### State: Analysis Done, No Optimization
- Measurements exist and analysis has been performed (infer from measurement count and names).
- Next step: "Run `/rew:optimize` to start the iterative optimization cycle."

### State: Optimization In Progress
- An optimization workflow is active.
- Show the current recommendation and progress toward the +/-3 dB target.
- Next step: "Continue with `/rew:optimize` to get the next recommendation."

## Step 4: Present Summary

Format the status as a clean summary:

```
REW Session Status
------------------
Connection:    Connected (REW vX.X.X)
Audio Input:   [device name]
Audio Output:  [device name]
Session:       [Active/None] (ID: ...)
Measurements:  [count] loaded
  - [measurement names/channels]
State:         [current state description]
Next Step:     [recommended action]
```

Keep it concise. The user should be able to glance at this and know exactly where they are and what to do next.
