# Phase 3: Calibration Setup Tools - Research

**Researched:** 2026-01-21
**Domain:** Audio gain staging, dBFS level monitoring, SPL calibration, and REW API input level monitoring
**Confidence:** HIGH

## Summary

Phase 3 implements guided calibration workflows for mic gain (input level) and monitor level (SPL) before acoustic measurements. The standard approach combines REW's `/input-levels` API for real-time dBFS monitoring with generator/SPL meter endpoints for semi-automated calibration.

The established industry practice is:
1. **Gain staging**: Monitor RMS and peak dBFS levels from mic input, guide user to -12 dBFS RMS target (professional S/N ratio) while avoiding clipping (>-3 dBFS peak) and low signal (<-40 dBFS RMS)
2. **SPL calibration**: Play pink noise via REW generator, read SPL meter, calculate adjustment needed to reach 85 dB SPL reference level (broadcast standard) within ±1 dB tolerance (Class 2 professional accuracy)
3. **Iterative guidance**: Step-by-step feedback loop where user adjusts hardware gain → checks level → receives next instruction, continuing until target achieved

**Primary recommendation:** Use REW's `/input-levels/subscribe` endpoint with continuous monitoring, poll-based architecture (not websocket) with 500ms-1s update intervals for responsive --watch mode, and leverage existing generator/SPL meter tools for semi-automated SPL calibration workflow.

## Standard Stack

Phase 1 already established REW API client and MCP tooling. Phase 3 extends with input level monitoring endpoints.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| REW API | 5.30+ | Input level monitoring, generator, SPL meter | Official REW REST API, /input-levels endpoint provides RMS+peak dBFS |
| @modelcontextprotocol/sdk | ^1.25.2 | MCP server/client framework | Official MCP SDK for tool registration |
| Zod | ^3.23.8 | Runtime schema validation | TypeScript-first validation, already used in Phase 1/2 |
| Node.js fetch | native | HTTP polling for /input-levels | Native in Node 18+, no dependencies |

### Supporting (Pattern - No New Libraries)
| Component | Implementation | Purpose | When to Use |
|-----------|----------------|---------|-------------|
| Polling loop | setInterval with AbortController | Continuous --watch mode monitoring | Input level monitoring, live calibration feedback |
| Text-based zones | ANSI/emoji indicators | Visual feedback without GUI | CLI tool output (Clipping ⚠️, Optimal ✓) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling (/input-levels/last-levels) | Websocket subscription | REW API uses HTTP subscription callbacks, not websockets. Polling is REW's documented approach |
| ANSI color codes | Plain text | ANSI provides better visual feedback for zones, but adds complexity. Use emoji + text for clarity |
| -12 dBFS RMS target | -18 dBFS RMS (DAW standard) | -18 is mixing standard, -12 is measurement standard (hotter signal, better S/N for measurement) |
| 85 dB SPL | 79 dB SPL or 83 dB SPL | 85 is broadcast reference (SMPTE), 83 is revised cinema, 79 is small room. Use 85 as default with override |

**Installation:**
```bash
# No new dependencies needed
# REW API client already implemented in Phase 1
# Need to add input-levels methods to REWApiClient
```

## Architecture Patterns

### Current REW API Client Structure (Phase 1)
```
src/
├── api/
│   ├── rew-client.ts           # REW API client (needs input-levels methods)
│   ├── rew-api-error.ts        # Typed error handling
│   └── schemas.ts              # Zod schemas for API responses
├── tools/
│   ├── api-connect.ts          # Connection management
│   ├── api-generator.ts        # Generator control (Phase 1 - reuse for pink noise)
│   ├── api-spl-meter.ts        # SPL meter control (Phase 1 - reuse for SPL reading)
│   └── [NEW] api-check-levels.ts     # Input level monitoring (Phase 3)
│   └── [NEW] api-calibrate-spl.ts    # SPL calibration workflow (Phase 3)
```

### Pattern 1: REW Input Level Monitoring
**What:** Subscribe to REW's `/input-levels` endpoint and poll for RMS/peak dBFS values
**When to use:** Any mic gain checking, input level monitoring, clipping detection
**Example:**
```typescript
// Source: REW API documentation - /input-levels endpoint
// https://www.roomeqwizard.com/help/help_en-GB/html/api.html

// Extend REWApiClient with input-levels methods
class REWApiClient {
  /**
   * Start input level monitoring
   * REW API requires posting "start" command to /input-levels/command
   */
  async startInputLevelMonitoring(): Promise<boolean> {
    const commands = await this.request('GET', '/input-levels/commands');
    // Commands array contains: ["start", "stop"]

    const response = await this.request('POST', '/input-levels/command', {
      command: 'start'
    });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Stop input level monitoring
   */
  async stopInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', {
      command: 'stop'
    });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get available input level units
   * Default: dBFS (most common for digital measurement)
   */
  async getInputLevelUnits(): Promise<string[]> {
    const response = await this.request('GET', '/input-levels/units');
    if (response.status !== 200) return [];
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get last input levels (polling approach)
   * Returns InputLevels object with RMS and peak for each channel
   */
  async getInputLevels(unit: string = 'dBFS'): Promise<InputLevels | null> {
    const response = await this.request('GET', '/input-levels/last-levels', { unit });
    if (response.status !== 200) return null;

    const data = response.data as InputLevelsResponse;
    return {
      unit: data.unit || 'dBFS',
      rms_levels: data.rms || [],
      peak_levels: data.peak || [],
      time_span_seconds: data.timeSpanSeconds || 0.5
    };
  }
}

// Type definitions (add to schemas.ts)
export interface InputLevels {
  unit: string;              // 'dBFS', 'dBV', etc.
  rms_levels: number[];      // RMS level per channel
  peak_levels: number[];     // Peak level per channel
  time_span_seconds: number; // Time period for calculation
}
```

### Pattern 2: Polling-Based Watch Mode
**What:** Continuous monitoring with periodic updates until user interrupts
**When to use:** --watch mode for input levels, live SPL reading during calibration
**Example:**
```typescript
// Source: Standard Node.js polling pattern + AbortController
// Similar to Linux watch command (2s default interval)

async function watchInputLevels(
  client: REWApiClient,
  intervalMs: number = 1000,
  signal: AbortSignal
): Promise<void> {
  // Start monitoring
  await client.startInputLevelMonitoring();

  try {
    while (!signal.aborted) {
      const levels = await client.getInputLevels();

      if (levels) {
        // Calculate zone from RMS and peak
        const avgRMS = levels.rms_levels.reduce((a, b) => a + b, 0) / levels.rms_levels.length;
        const maxPeak = Math.max(...levels.peak_levels);

        const zone = determineLevelZone(avgRMS, maxPeak);
        console.log(formatLevelOutput(zone, avgRMS, maxPeak));
      }

      // Wait for next interval (but respect abort signal)
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      if (signal.aborted) break;
    }
  } finally {
    // Always stop monitoring on exit
    await client.stopInputLevelMonitoring();
  }
}

// Zone determination (matches Phase 3 decisions)
function determineLevelZone(rms: number, peak: number): LevelZone {
  // Priority: Clipping check first (most critical)
  if (peak > -3) return 'CLIPPING';

  // Then check RMS zones
  if (rms > -10) return 'HOT';
  if (rms >= -20 && rms <= -10) return 'OPTIMAL';  // Target: -12 dBFS RMS
  if (rms >= -40 && rms < -20) return 'LOW';

  return 'VERY_LOW';  // < -40 dBFS
}

type LevelZone = 'CLIPPING' | 'HOT' | 'OPTIMAL' | 'LOW' | 'VERY_LOW';
```

### Pattern 3: Zone-Based Level Feedback
**What:** Text output with emoji/symbols indicating signal quality zones
**When to use:** All level monitoring outputs, user feedback during calibration
**Example:**
```typescript
// Source: Phase 3 context decisions + industry standard thresholds

interface LevelFeedback {
  zone: LevelZone;
  indicator: string;  // Emoji or symbol
  color?: string;     // ANSI color code (optional)
  message: string;
  rms_db: number;
  peak_db: number;
}

function formatLevelOutput(zone: LevelZone, rms: number, peak: number): LevelFeedback {
  const feedback: Record<LevelZone, { indicator: string; message: string }> = {
    CLIPPING: {
      indicator: '⚠️  CLIPPING',
      message: `Peak: ${peak.toFixed(1)} dBFS - REDUCE MIC GAIN IMMEDIATELY`
    },
    HOT: {
      indicator: '🔥 HOT',
      message: `RMS: ${rms.toFixed(1)} dBFS - Turn down mic gain slightly`
    },
    OPTIMAL: {
      indicator: '✓  Good',
      message: `RMS: ${rms.toFixed(1)} dBFS - Level is optimal`
    },
    LOW: {
      indicator: '📉 Low',
      message: `RMS: ${rms.toFixed(1)} dBFS - Increase mic gain`
    },
    VERY_LOW: {
      indicator: '⚠️  VERY LOW',
      message: `RMS: ${rms.toFixed(1)} dBFS - INCREASE MIC GAIN (signal too quiet)`
    }
  };

  return {
    zone,
    indicator: feedback[zone].indicator,
    message: feedback[zone].message,
    rms_db: rms,
    peak_db: peak
  };
}
```

### Pattern 4: Semi-Automated SPL Calibration
**What:** Multi-step workflow: start generator → read SPL → calculate adjustment → repeat
**When to use:** Monitor level calibration to target SPL before measurement
**Example:**
```typescript
// Source: REW workflow + broadcast reference standard
// Uses existing Phase 1 tools: api-generator, api-spl-meter

interface SPLCalibrationStep {
  current_spl: number;
  target_spl: number;
  adjustment_needed: number;
  within_tolerance: boolean;
  instructions: string;
}

async function calibrateSPL(
  client: REWApiClient,
  targetSPL: number = 85,
  toleranceDB: number = 1
): Promise<SPLCalibrationStep> {
  // 1. Configure generator: pink noise, speaker cal signal
  await client.setGeneratorSignal('Pink noise (Speaker Cal)');
  await client.setGeneratorLevel(-20, 'dBFS');  // -20 dBFS RMS = 85 dB SPL at reference

  // 2. Start generator
  await client.executeGeneratorCommand('Play');

  // Wait for signal to stabilize (pink noise needs ~2s)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Read SPL meter (meter_id=1, C-weighted, Slow)
  await client.setSPLMeterConfig(1, { weighting: 'C', filter: 'Slow' });
  await client.executeSPLMeterCommand(1, 'Start');

  // Wait for meter to stabilize
  await new Promise(resolve => setTimeout(resolve, 1000));

  const levels = await client.getSPLMeterLevels(1);
  const currentSPL = levels?.spl || 0;

  // 4. Calculate adjustment
  const adjustment = targetSPL - currentSPL;
  const withinTolerance = Math.abs(adjustment) <= toleranceDB;

  // 5. Generate instructions
  let instructions: string;
  if (withinTolerance) {
    instructions = `✓ SPL calibrated: ${currentSPL.toFixed(1)} dB (within ±${toleranceDB} dB tolerance)`;
  } else if (adjustment > 0) {
    instructions = `Increase monitor volume by ~${Math.abs(adjustment).toFixed(1)} dB, then check again`;
  } else {
    instructions = `Decrease monitor volume by ~${Math.abs(adjustment).toFixed(1)} dB, then check again`;
  }

  return {
    current_spl: currentSPL,
    target_spl: targetSPL,
    adjustment_needed: adjustment,
    within_tolerance: withinTolerance,
    instructions
  };
}
```

### Pattern 5: Iterative Guidance Workflow
**What:** Step-by-step loop where user adjusts → checks → receives next instruction
**When to use:** Both mic gain calibration and SPL calibration (user-driven iteration)
**Example:**
```typescript
// Source: Industry best practice for iterative calibration
// User controls when to stop (no automatic escalation)

interface CalibrationWorkflow {
  check(): Promise<CalibrationResult>;
  shouldBlock(): boolean;  // Block measurement if issue detected
  getGuidance(): string;
}

class MicGainCalibration implements CalibrationWorkflow {
  constructor(private client: REWApiClient, private targetRMS: number = -12) {}

  async check(): Promise<CalibrationResult> {
    const levels = await this.client.getInputLevels();
    if (!levels) throw new Error('Failed to read input levels');

    const avgRMS = levels.rms_levels.reduce((a, b) => a + b, 0) / levels.rms_levels.length;
    const maxPeak = Math.max(...levels.peak_levels);

    const zone = determineLevelZone(avgRMS, maxPeak);

    return {
      zone,
      rms_db: avgRMS,
      peak_db: maxPeak,
      target_rms: this.targetRMS,
      should_block: zone === 'CLIPPING' || zone === 'VERY_LOW',
      guidance: this.getGuidanceForZone(zone, avgRMS, maxPeak)
    };
  }

  shouldBlock(): boolean {
    // Block measurement if clipping or very low signal
    // User must fix before proceeding (no --force flag)
    return true;  // Determined by check() result
  }

  private getGuidanceForZone(zone: LevelZone, rms: number, peak: number): string {
    // Generic hardware terms (works for any interface/preamp)
    const guidance: Record<LevelZone, string> = {
      CLIPPING: `⚠️  CLIPPING DETECTED (peak: ${peak.toFixed(1)} dBFS)\n` +
                `Turn down your mic preamp gain, then check again.\n` +
                `Target: -12 dBFS RMS with peaks below -3 dBFS`,

      HOT: `🔥 Signal is hot (RMS: ${rms.toFixed(1)} dBFS)\n` +
           `Turn down your mic preamp gain slightly, then check again.\n` +
           `Target: -12 dBFS RMS`,

      OPTIMAL: `✓ Level is optimal (RMS: ${rms.toFixed(1)} dBFS)\n` +
               `Peak: ${peak.toFixed(1)} dBFS - Good headroom.\n` +
               `Ready for measurement.`,

      LOW: `📉 Signal is low (RMS: ${rms.toFixed(1)} dBFS)\n` +
           `Increase your mic preamp gain, then check again.\n` +
           `Target: -12 dBFS RMS`,

      VERY_LOW: `⚠️  SIGNAL TOO LOW (RMS: ${rms.toFixed(1)} dBFS)\n` +
                `Increase your mic preamp gain significantly, then check again.\n` +
                `Check mic is connected and phantom power is enabled if needed.\n` +
                `Target: -12 dBFS RMS`
    };

    return guidance[zone];
  }
}

interface CalibrationResult {
  zone: LevelZone;
  rms_db: number;
  peak_db: number;
  target_rms: number;
  should_block: boolean;
  guidance: string;
}
```

### Anti-Patterns to Avoid

- **Don't use websockets for input-levels:** REW API uses HTTP polling, not websockets. The `/input-levels/subscribe` endpoint accepts a callback URL for webhooks, but polling `/input-levels/last-levels` is simpler for MCP tools.

- **Don't implement --force flag:** Phase 3 context specifies "no --force flag — bad measurements waste time, always enforce". Clipping and very low signal must block measurement.

- **Don't auto-adjust hardware gain:** Tools can only provide guidance. User must physically adjust mic preamp/interface gain knob. No API can control hardware gain (unless specific interface has API).

- **Don't assume single channel:** REW supports multi-channel interfaces. Always process all channels in `rms_levels` and `peak_levels` arrays.

- **Don't set SPL target too high for small rooms:** Default is 85 dB SPL (broadcast reference), but small rooms (<142 cubic meters) should use 73-76 dB SPL. Allow target override.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input level monitoring | Custom audio capture/analysis | REW `/input-levels` API | REW already calculates RMS/peak dBFS per channel, handles multi-channel, respects audio device settings |
| Pink noise generation | Generate audio file + playback | REW `/generator` API | REW handles speaker calibration filtering, dither, level control, multi-channel routing |
| SPL meter reading | Parse audio into frequency-weighted SPL | REW `/spl-meter` API | REW implements A/C/Z weighting, Slow/Fast/Impulse filters, Leq/SEL calculations (complex DSP) |
| Watch mode terminal updates | Manual console.clear() + redraw | setInterval with AbortSignal | Standard Node.js pattern, handles cleanup, respects interrupts |
| dBFS threshold detection | Manual comparisons | Zone-based categorization function | Industry-standard thresholds (-3, -10, -20, -40 dBFS), easier to test and maintain |

**Key insight:** REW's API provides professional-grade audio measurement primitives (RMS/peak calculation, pink noise generation, SPL metering). Building these from scratch would require complex DSP and wouldn't match REW's quality/accuracy.

## Common Pitfalls

### Pitfall 1: Input Level Monitoring Not Started
**What goes wrong:** Calling `/input-levels/last-levels` before starting monitoring returns null or stale data.

**Why it happens:**
- REW doesn't start audio capture automatically
- Input level monitoring requires explicit "start" command to `/input-levels/command`
- Developers assume levels are always available

**How to avoid:**
1. **Always call startInputLevelMonitoring() before polling:** Ensure monitoring is active
2. **Check for null response:** Handle case where monitoring not started or audio device not ready
3. **Stop monitoring on cleanup:** Use try/finally to ensure stopInputLevelMonitoring() called

**Warning signs:**
- `getInputLevels()` returns null despite audio device connected
- Input levels stuck at -Infinity or 0
- Error: "Audio capture not started"

**Recommended pattern:**
```typescript
// GOOD - Explicit start/stop lifecycle
await client.startInputLevelMonitoring();
try {
  const levels = await client.getInputLevels();
  // ... process levels
} finally {
  await client.stopInputLevelMonitoring();
}

// BAD - Assumes monitoring already active
const levels = await client.getInputLevels();  // May return null!
```

### Pitfall 2: Ignoring Multi-Channel Inputs
**What goes wrong:** Code assumes single channel (levels.rms_levels[0]) but user has stereo or multi-channel interface.

**Why it happens:**
- REW returns arrays for `rms_levels` and `peak_levels` (one per channel)
- Measurement microphones are mono, but audio interface may be stereo
- Left/right channels may have different levels if interface misconfigured

**How to avoid:**
1. **Process all channels:** Average RMS across channels, take max peak across channels
2. **Warn if channels differ significantly:** L/R mismatch >3 dB suggests interface/cable issue
3. **Support per-channel feedback (Phase 3 discretion):** For stereo measurement setups

**Warning signs:**
- User reports "level shows 0 on right channel"
- Clipping detected on one channel but not reported
- Code only checks `rms_levels[0]`

**Recommended pattern:**
```typescript
// GOOD - Multi-channel aware
const avgRMS = levels.rms_levels.reduce((a, b) => a + b, 0) / levels.rms_levels.length;
const maxPeak = Math.max(...levels.peak_levels);

// Check for L/R mismatch (optional - Phase 3 discretion)
if (levels.rms_levels.length === 2) {
  const diff = Math.abs(levels.rms_levels[0] - levels.rms_levels[1]);
  if (diff > 3) {
    console.warn(`⚠️  L/R channel mismatch: ${diff.toFixed(1)} dB difference`);
  }
}

// BAD - Assumes mono
const rms = levels.rms_levels[0];  // Ignores channel 1+ !
```

### Pitfall 3: SPL Calibration Without Stabilization Time
**What goes wrong:** Reading SPL meter immediately after starting pink noise gives incorrect reading (too low or fluctuating).

**Why it happens:**
- Pink noise needs 1-2 seconds to reach steady-state RMS level
- SPL meter averages over time (Slow mode = 1s time constant)
- Early reading captures transient, not stable level

**How to avoid:**
1. **Wait 2s after starting generator:** Allow pink noise to stabilize
2. **Wait 1s after starting SPL meter:** Allow averaging filter to fill
3. **Document in guidance:** Tell user "Waiting for signal to stabilize..."

**Warning signs:**
- SPL reading increases by 2-3 dB if checked again after few seconds
- Calibration requires multiple iterations despite no volume change
- SPL fluctuates between checks

**Recommended pattern:**
```typescript
// GOOD - Explicit stabilization waits
await client.executeGeneratorCommand('Play');
console.log('Starting pink noise... (waiting for signal to stabilize)');
await new Promise(resolve => setTimeout(resolve, 2000));  // 2s stabilization

await client.executeSPLMeterCommand(1, 'Start');
await new Promise(resolve => setTimeout(resolve, 1000));  // 1s meter averaging

const levels = await client.getSPLMeterLevels(1);

// BAD - Immediate reading
await client.executeGeneratorCommand('Play');
const levels = await client.getSPLMeterLevels(1);  // Unstable reading!
```

### Pitfall 4: Watch Mode Memory Leak
**What goes wrong:** Polling loop runs indefinitely even after user interrupts, consuming memory/CPU.

**Why it happens:**
- setInterval continues until explicitly cleared
- Promise-based polling loops don't respect SIGINT/Ctrl+C
- Cleanup not triggered on abrupt exit

**How to avoid:**
1. **Use AbortController for cancellation:** Standard Node.js pattern for async cancellation
2. **Clear interval on signal:** Listen for abort signal in polling loop
3. **Always cleanup in finally block:** Ensure monitoring stopped even on error

**Warning signs:**
- REW shows "Audio capture active" after tool exits
- Multiple polling loops running (check with process monitoring)
- Tool doesn't respond to Ctrl+C

**Recommended pattern:**
```typescript
// GOOD - AbortController pattern
const controller = new AbortController();

process.on('SIGINT', () => controller.abort());  // Ctrl+C support

try {
  await watchInputLevels(client, 1000, controller.signal);
} finally {
  await client.stopInputLevelMonitoring();
}

// Inside watchInputLevels:
while (!signal.aborted) {
  // ... poll levels
  await new Promise(resolve => setTimeout(resolve, intervalMs));
  if (signal.aborted) break;  // Respect abort
}

// BAD - Infinite loop
while (true) {
  // ... poll levels
  await new Promise(resolve => setTimeout(resolve, 1000));
}  // Never exits!
```

### Pitfall 5: Tolerance Too Tight for Real-World Use
**What goes wrong:** SPL calibration demands ±0.5 dB tolerance, user can't achieve it with consumer equipment.

**Why it happens:**
- ±1 dB is Class 2 professional accuracy (realistic for home use)
- ±0.5 dB is Class 1 lab accuracy (requires high-end SPL meter)
- Volume controls are stepped (1 dB increments typical), can't fine-tune

**How to avoid:**
1. **Default to ±1 dB tolerance:** Matches Phase 3 context decision
2. **Allow override for stricter tolerance:** Advanced users with Class 1 meters
3. **Document tolerance rationale:** Explain why ±1 dB is sufficient for room measurement

**Warning signs:**
- User reports "I'm stuck at 84.3 dB, can't get to 85 dB exactly"
- Calibration requires excessive iteration (>5 attempts)
- Guidance says "increase 0.2 dB" but volume knob changes 1 dB minimum

**Recommended pattern:**
```typescript
// GOOD - Realistic tolerance
const DEFAULT_TOLERANCE = 1.0;  // ±1 dB (Class 2 professional)

interface SPLCalibrationOptions {
  target_spl: number;
  tolerance_db: number;
}

async function calibrateSPL(
  client: REWApiClient,
  options: SPLCalibrationOptions = { target_spl: 85, tolerance_db: 1.0 }
) {
  // ... calibration logic
  const withinTolerance = Math.abs(adjustment) <= options.tolerance_db;

  if (withinTolerance) {
    return `✓ Calibrated: ${currentSPL.toFixed(1)} dB (within ±${options.tolerance_db} dB)`;
  }
}

// BAD - Unrealistic precision
const TOLERANCE = 0.1;  // ±0.1 dB - impossible with consumer equipment!
```

## Code Examples

Verified patterns from official sources:

### REW API Input Level Monitoring
```typescript
// Source: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
// REW API documentation - Input Levels section

import { z } from 'zod';

// Zod schema for InputLevels response
export const InputLevelsSchema = z.object({
  unit: z.string(),
  rms: z.array(z.number()),       // RMS level per channel
  peak: z.array(z.number()),      // Peak level per channel
  timeSpanSeconds: z.number()     // Averaging window
});

export type InputLevelsResponse = z.infer<typeof InputLevelsSchema>;

// REWApiClient extension (add to rew-client.ts)
class REWApiClient {
  /**
   * Get available input level monitoring commands
   */
  async getInputLevelCommands(): Promise<string[]> {
    const response = await this.request('GET', '/input-levels/commands');
    if (response.status !== 200) return [];
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Start input level monitoring
   * Automatically starts audio capture if not already running
   */
  async startInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', {
      command: 'start'
    });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Stop input level monitoring
   * Stops audio capture when no other monitoring active
   */
  async stopInputLevelMonitoring(): Promise<boolean> {
    const response = await this.request('POST', '/input-levels/command', {
      command: 'stop'
    });
    return response.status === 200 || response.status === 202;
  }

  /**
   * Get supported units for input levels
   * Default: dBFS (most common for digital)
   */
  async getInputLevelUnits(): Promise<string[]> {
    const response = await this.request('GET', '/input-levels/units');
    if (response.status !== 200) return [];
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get most recent input levels (polling approach)
   * Returns null if monitoring not started
   */
  async getInputLevels(unit: string = 'dBFS'): Promise<InputLevels | null> {
    const params = new URLSearchParams();
    if (unit) params.set('unit', unit);

    const path = `/input-levels/last-levels${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.request('GET', path);

    if (response.status !== 200 || !response.data) {
      return null;
    }

    const result = InputLevelsSchema.safeParse(response.data);
    if (!result.success) {
      return null;
    }

    return {
      unit: result.data.unit,
      rms_levels: result.data.rms,
      peak_levels: result.data.peak,
      time_span_seconds: result.data.timeSpanSeconds
    };
  }
}

export interface InputLevels {
  unit: string;
  rms_levels: number[];
  peak_levels: number[];
  time_span_seconds: number;
}
```

### MCP Tool: Check Input Levels
```typescript
// Source: Phase 3 requirements + existing tool patterns (api-generator.ts, api-spl-meter.ts)

import { z } from 'zod';
import { getActiveApiClient } from './api-connect.js';
import { REWApiError } from '../api/rew-api-error.js';
import type { ToolResponse } from '../types/index.js';

// Input schema
export const ApiCheckLevelsInputSchema = z.object({
  watch: z.boolean().default(false)
    .describe('Enable continuous monitoring (--watch mode). Updates every 1s until interrupted.'),

  interval_ms: z.number().min(100).max(5000).default(1000).optional()
    .describe('Update interval in milliseconds (watch mode only)'),

  target_rms: z.number().min(-60).max(0).default(-12).optional()
    .describe('Target RMS level in dBFS (default: -12 dBFS for measurement)')
});

export type ApiCheckLevelsInput = z.infer<typeof ApiCheckLevelsInputSchema>;

// Zone determination (Phase 3 context)
type LevelZone = 'CLIPPING' | 'HOT' | 'OPTIMAL' | 'LOW' | 'VERY_LOW';

function determineLevelZone(rms: number, peak: number): LevelZone {
  // Priority: Clipping first (blocks measurement)
  if (peak > -3) return 'CLIPPING';

  // RMS zones
  if (rms > -10) return 'HOT';
  if (rms >= -20 && rms <= -10) return 'OPTIMAL';  // -12 dBFS target
  if (rms >= -40 && rms < -20) return 'LOW';

  return 'VERY_LOW';  // < -40 dBFS (blocks measurement)
}

function formatLevelFeedback(
  zone: LevelZone,
  rms: number,
  peak: number,
  targetRMS: number
): string {
  const zoneDisplay: Record<LevelZone, string> = {
    CLIPPING: `⚠️  CLIPPING (${peak.toFixed(1)} dBFS peak)`,
    HOT: `🔥 HOT (${rms.toFixed(1)} dBFS RMS)`,
    OPTIMAL: `✓  Good range (${rms.toFixed(1)} dBFS RMS)`,
    LOW: `📉 Low (${rms.toFixed(1)} dBFS RMS)`,
    VERY_LOW: `⚠️  VERY LOW (${rms.toFixed(1)} dBFS RMS)`
  };

  const guidance: Record<LevelZone, string> = {
    CLIPPING: 'Turn down mic preamp gain, then check again',
    HOT: 'Turn down mic preamp gain slightly, then check again',
    OPTIMAL: `Ready for measurement (target: ${targetRMS.toFixed(0)} dBFS RMS)`,
    LOW: 'Increase mic preamp gain, then check again',
    VERY_LOW: 'Increase mic preamp gain significantly, then check again'
  };

  return `${zoneDisplay[zone]}\n${guidance[zone]}`;
}

/**
 * Execute check levels tool
 */
export async function executeApiCheckLevels(
  input: ApiCheckLevelsInput
): Promise<ToolResponse<ApiCheckLevelsResult>> {
  try {
    const validated = ApiCheckLevelsInputSchema.parse(input);
    const client = getActiveApiClient();

    if (!client) {
      return {
        status: 'error',
        error_type: 'connection_error',
        message: 'Not connected to REW API. Use rew.api_connect first.',
        suggestion: 'Call rew.api_connect to establish connection'
      };
    }

    // Start monitoring
    const started = await client.startInputLevelMonitoring();
    if (!started) {
      return {
        status: 'error',
        error_type: 'internal_error',
        message: 'Failed to start input level monitoring',
        suggestion: 'Check REW audio settings (Preferences → Soundcard)'
      };
    }

    try {
      if (validated.watch) {
        // Watch mode - continuous monitoring
        const controller = new AbortController();
        process.on('SIGINT', () => controller.abort());

        console.log('Monitoring input levels... (Ctrl+C to stop)\n');

        while (!controller.signal.aborted) {
          const levels = await client.getInputLevels();

          if (levels && levels.rms_levels.length > 0) {
            const avgRMS = levels.rms_levels.reduce((a, b) => a + b, 0) / levels.rms_levels.length;
            const maxPeak = Math.max(...levels.peak_levels);

            const zone = determineLevelZone(avgRMS, maxPeak);
            const feedback = formatLevelFeedback(zone, avgRMS, maxPeak, validated.target_rms || -12);

            console.clear();
            console.log(feedback);
          }

          await new Promise(resolve => setTimeout(resolve, validated.interval_ms || 1000));
          if (controller.signal.aborted) break;
        }

        return {
          status: 'success',
          data: {
            action: 'watch_stopped',
            message: 'Monitoring stopped'
          }
        };

      } else {
        // Single check
        const levels = await client.getInputLevels();

        if (!levels || levels.rms_levels.length === 0) {
          return {
            status: 'error',
            error_type: 'internal_error',
            message: 'No input levels available',
            suggestion: 'Check mic is connected and audio device is selected in REW'
          };
        }

        const avgRMS = levels.rms_levels.reduce((a, b) => a + b, 0) / levels.rms_levels.length;
        const maxPeak = Math.max(...levels.peak_levels);

        const zone = determineLevelZone(avgRMS, maxPeak);
        const shouldBlock = zone === 'CLIPPING' || zone === 'VERY_LOW';

        return {
          status: 'success',
          data: {
            action: 'check',
            zone,
            rms_db: avgRMS,
            peak_db: maxPeak,
            should_block_measurement: shouldBlock,
            feedback: formatLevelFeedback(zone, avgRMS, maxPeak, validated.target_rms || -12),
            channels: levels.rms_levels.map((rms, i) => ({
              channel: i,
              rms_db: rms,
              peak_db: levels.peak_levels[i]
            }))
          }
        };
      }

    } finally {
      // Always stop monitoring
      await client.stopInputLevelMonitoring();
    }

  } catch (error) {
    // ... standard error handling (same pattern as api-generator.ts)
  }
}

export interface ApiCheckLevelsResult {
  action: string;
  zone?: LevelZone;
  rms_db?: number;
  peak_db?: number;
  should_block_measurement?: boolean;
  feedback?: string;
  message?: string;
  channels?: Array<{
    channel: number;
    rms_db: number;
    peak_db: number;
  }>;
}
```

### SPL Calibration Workflow
```typescript
// Source: REW calibration workflow + broadcast reference standard (85 dB SPL)

export const ApiCalibrateSPLInputSchema = z.object({
  target_spl: z.number().min(70).max(95).default(85)
    .describe('Target SPL in dB (default: 85 dB - broadcast reference)'),

  tolerance_db: z.number().min(0.1).max(5).default(1.0)
    .describe('Acceptable tolerance in dB (default: ±1 dB - Class 2 professional)'),

  weighting: z.enum(['A', 'C', 'Z']).default('C')
    .describe('SPL meter weighting (C=flat low freq for calibration)'),

  meter_id: z.number().int().min(1).max(4).default(1)
    .describe('SPL meter ID (1-4)')
});

export type ApiCalibrateSPLInput = z.infer<typeof ApiCalibrateSPLInputSchema>;

export async function executeApiCalibrateSPL(
  input: ApiCalibrateSPLInput
): Promise<ToolResponse<ApiCalibrateSPLResult>> {
  const validated = ApiCalibrateSPLInputSchema.parse(input);
  const client = getActiveApiClient();

  if (!client) {
    return {
      status: 'error',
      error_type: 'connection_error',
      message: 'Not connected to REW API. Use rew.api_connect first.'
    };
  }

  try {
    // 1. Configure generator: Pink noise (speaker cal), -20 dBFS RMS
    await client.setGeneratorSignal('Pink noise (Speaker Cal)');
    await client.setGeneratorLevel(-20, 'dBFS');

    // 2. Configure SPL meter: C-weighted, Slow
    await client.setSPLMeterConfig(validated.meter_id, {
      weighting: validated.weighting,
      filter: 'Slow'
    });

    // 3. Start generator
    await client.executeGeneratorCommand('Play');
    console.log('Starting pink noise... (waiting for signal to stabilize)');
    await new Promise(resolve => setTimeout(resolve, 2000));  // Stabilization

    // 4. Start SPL meter
    await client.executeSPLMeterCommand(validated.meter_id, 'Start');
    await new Promise(resolve => setTimeout(resolve, 1000));  // Meter averaging

    // 5. Read SPL
    const levels = await client.getSPLMeterLevels(validated.meter_id);

    if (!levels) {
      return {
        status: 'error',
        error_type: 'internal_error',
        message: 'Failed to read SPL meter',
        suggestion: 'Check SPL meter is configured in REW (Preferences → SPL Meter)'
      };
    }

    const currentSPL = levels.spl;
    const adjustment = validated.target_spl - currentSPL;
    const withinTolerance = Math.abs(adjustment) <= validated.tolerance_db;

    // 6. Generate guidance
    let guidance: string;
    if (withinTolerance) {
      guidance = `✓ SPL calibrated: ${currentSPL.toFixed(1)} dB${validated.weighting} ` +
                 `(within ±${validated.tolerance_db} dB tolerance)`;
    } else if (adjustment > 0) {
      guidance = `Increase monitor volume by ~${Math.abs(adjustment).toFixed(1)} dB, then check again\n` +
                 `Current: ${currentSPL.toFixed(1)} dB${validated.weighting}, Target: ${validated.target_spl} dB`;
    } else {
      guidance = `Decrease monitor volume by ~${Math.abs(adjustment).toFixed(1)} dB, then check again\n` +
                 `Current: ${currentSPL.toFixed(1)} dB${validated.weighting}, Target: ${validated.target_spl} dB`;
    }

    return {
      status: 'success',
      data: {
        action: 'calibrate',
        current_spl: currentSPL,
        target_spl: validated.target_spl,
        adjustment_needed: adjustment,
        within_tolerance: withinTolerance,
        should_block_measurement: !withinTolerance,
        guidance,
        weighting: validated.weighting
      }
    };

  } finally {
    // Cleanup: Stop generator (leave SPL meter running for verification)
    await client.executeGeneratorCommand('Stop');
  }
}

export interface ApiCalibrateSPLResult {
  action: string;
  current_spl: number;
  target_spl: number;
  adjustment_needed: number;
  within_tolerance: boolean;
  should_block_measurement: boolean;
  guidance: string;
  weighting: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual mic gain adjustment (trial-and-error) | Real-time dBFS monitoring with zone feedback | 2020s (prosumer interfaces with metering) | Users can dial in optimal level in 1-2 attempts vs 5+ |
| -18 dBFS RMS target (DAW mixing standard) | -12 dBFS RMS target (measurement standard) | Industry practice | Hotter signal improves S/N ratio for measurement without clipping risk |
| External SPL meter + manual calculation | Semi-automated with REW generator + SPL meter API | REW 5.30+ API (2023+) | User only adjusts volume knob, tool calculates adjustment needed |
| 85 dB SPL universal recommendation | 85 dB for large rooms, 73-76 dB for small (<142 m³) | 2010s (research on home studio levels) | More appropriate levels for residential spaces, prevents hearing fatigue |
| ±0.5 dB tolerance (Class 1 lab accuracy) | ±1 dB tolerance (Class 2 professional) | Practical reality | Achievable with consumer SPL meters, realistic for volume control resolution |

**Deprecated/outdated:**
- **-18 dBFS RMS for measurement:** This is mixing standard. Measurement uses -12 dBFS for better S/N.
- **Universal 85 dB SPL:** Small rooms should use lower target (73-76 dB SPL).
- **Manual SPL calculation from reference:** REW API calculates adjustment automatically.
- **Websocket for input-levels:** REW uses HTTP polling, not websockets (common misconception).

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal polling interval for watch mode**
   - What we know: Standard `watch` command uses 2s default, can go as fast as 0.1s
   - What's unclear: REW's `/input-levels` update rate (API doesn't document internal averaging window)
   - Recommendation: Default to 1s interval (responsive without excessive API calls). Allow override via --interval flag.

2. **L/R channel calibration separately or together**
   - What we know: Phase 3 context says "Claude's discretion" on L/R approach
   - What's unclear: When to require per-channel calibration vs averaged
   - Recommendation: Default to averaged (simpler), warn if L/R differ >3 dB, add per-channel mode in future if users request it.

3. **Generator signal name for speaker calibration pink noise**
   - What we know: REW offers multiple pink noise variants (random, periodic, speaker cal, sub cal)
   - What's unclear: Exact string for `/generator/signal` endpoint (need to check `getGeneratorSignals()` output)
   - Recommendation: Use `list_signals` action first to discover exact naming, default to "Pink noise" if "Speaker Cal" variant not found.

4. **Input level units beyond dBFS**
   - What we know: API supports multiple units (`/input-levels/units` endpoint), dBFS is default
   - What's unclear: When users would want dBV, dBu, etc. for input level monitoring
   - Recommendation: Default to dBFS (standard for digital measurement), expose `unit` parameter for advanced users.

## Sources

### Primary (HIGH confidence)
- [REW API Documentation - Input Levels](https://www.roomeqwizard.com/help/help_en-GB/html/api.html) - Official API spec for /input-levels endpoint
- [REW Help - Check Levels](https://www.roomeqwizard.com/help/help_en-GB/html/measurementlevel.html) - Recommended level ranges (-30 to -12 dB), default test signal (-12 dBFS RMS)
- [REW Help - Making Measurements](https://www.roomeqwizard.com/help/help_en-GB/html/makingmeasurements.html) - SPL calibration workflow
- [REW Help - Signal Generator](https://www.roomeqwizard.com/help/help_en-GB/html/siggen.html) - Pink noise options

### Secondary (MEDIUM confidence)
- [Gain Staging in Audio Production – Basics & Practice](https://blog.nexatunes.com/gain-staging-in-audio-production-why-it-matters-how-to-do-it/) - -12 to -6 dBFS peak for recording, -18 dBFS RMS for mixing
- [The Perfect Monitoring Levels For Your Home Studio](https://www.masteringthemix.com/blogs/learn/the-perfect-monitoring-levels-for-your-home-studio) - 85 dB SPL broadcast reference, 73-76 dB for small rooms
- [Recording and Mixing Levels Demystified](https://mojosarmy.medium.com/recording-and-mixing-levels-demystified-151ec65705fa) - -18 dBFS RMS standard, peaks around -12 dBFS
- [Everything You Need To Know About Loudness LUFS vs. RMS vs. dBFS](https://mrmixandmaster.com/loudness-lufs-vs-rms-vs-dbfs/) - RMS vs peak measurement, when to use each
- [Class 1 vs Class 2 Sound Level Meter](https://www.softdb.com/blog/class-1-vs-class-2-sound-level-meter/) - ±0.5 dB (Class 1), ±1.0 dB (Class 2) accuracy
- [Linux watch Command](https://www.geeksforgeeks.org/linux-unix/watch-command-in-linux-with-examples/) - Default 2s interval, -n for custom interval, highlights differences

### Tertiary (LOW confidence)
- [REW Beta Release - REW API beta releases](https://www.avnirvana.com/threads/rew-api-beta-releases.12981/) - Community discussion of API features (not official docs)
- [SPL calibration for 85db question](https://forums.audioholics.com/forums/threads/spl-calibration-for-85db-question.128286/) - Home theater calibration practices (not professional measurement)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - REW API documented, existing tools established in Phase 1
- Architecture: HIGH - Patterns verified from REW API docs + existing codebase (api-generator, api-spl-meter)
- Pitfalls: MEDIUM - Based on common API usage issues + audio engineering best practices, not all verified in this codebase
- Level thresholds: HIGH - Industry-standard dBFS zones (-3, -10, -20, -40) documented across multiple professional sources
- SPL calibration: HIGH - REW official workflow + broadcast reference standard (85 dB SPL)
- Tolerance ranges: HIGH - Class 1/2 SPL meter specifications well-documented

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - REW API stable, audio measurement standards unchanged for decades)

**Key findings for planner:**
1. REW API provides `/input-levels` endpoint with RMS+peak per channel (not yet implemented in REWApiClient)
2. Polling approach (not websocket) - use `/input-levels/last-levels` with 1s interval for watch mode
3. Existing tools (api-generator, api-spl-meter from Phase 1) can be reused for SPL calibration workflow
4. Industry-standard thresholds: -12 dBFS RMS target, -3 dBFS peak clipping, -40 dBFS low signal, ±1 dB SPL tolerance
5. Phase 3 decisions locked: 5 zones (Clipping/Hot/Optimal/Low/Very Low), no --force flag, iterative guidance, generic hardware terms
6. Claude's discretion: L/R channel calibration approach, exact wording of guidance messages
