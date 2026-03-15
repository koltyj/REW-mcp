# Genelec GLM Calibration System

## What GLM Measures and Corrects

Genelec GLM (Genelec Loudspeaker Manager) is a room calibration system for Genelec SAM (Smart Active Monitoring) speakers. It uses a measurement microphone (typically the Genelec 8300A) to capture the in-room frequency response at the listening position, then applies digital correction filters within the speaker's DSP.

GLM addresses four domains:

- **Magnitude (frequency response)** -- Applies parametric cut filters to reduce peaks caused by room modes, boundary reinforcement, and speaker-room interaction. GLM uses cut-only correction; it never boosts. This is a deliberate design choice: boosting at null frequencies wastes headroom and increases distortion without producing useful output at the listening position.
- **Phase alignment** -- Aligns phase between speakers in a multi-speaker system, particularly at subwoofer crossover frequencies. Ensures coherent summation at the crossover point.
- **Delay compensation** -- Compensates for differences in speaker-to-listener distance. Aligns the arrival time of all speakers so the acoustic image is centered at the listening position.
- **Level matching** -- Normalizes output levels across all speakers in the system. Accounts for distance differences and individual speaker sensitivity variations.

## GLM Limitations

### What GLM Cannot Fix

Understand these fundamental limitations before interpreting GLM results. The `rew.interpret_with_glm_context` and `rew.analyze_room` tools classify issues into "GLM addressable" and "beyond GLM scope" categories based on these physics:

**Room modes below the Schroeder frequency** -- GLM can reduce the peaks of room modes (cut the resonance), but the underlying standing wave pattern remains. The null points of room modes are completely beyond GLM's reach. At frequencies where the room naturally cancels the sound, no amount of electronic correction can produce output. GLM's cut-only approach means it can tame the peaks but the modal pattern (peaks AND nulls) persists.

**SBIR nulls** -- Quarter-wavelength cancellation from boundary reflections creates nulls that are acoustic in nature. The direct sound and reflected sound destructively interfere at the listening position. GLM cannot boost to fill these nulls, and even if it could, the cancellation would simply consume the additional output. The `rew.analyze_room` tool flags deep nulls (>10 dB) as "beyond GLM scope" for this reason.

**Reflections** -- GLM operates on the steady-state frequency response. It cannot selectively remove individual reflections from the impulse response. Early reflections that cause comb filtering, imaging degradation, and coloration remain unchanged after GLM calibration. The reflection pattern is determined by room geometry and surface properties -- only physical treatment (absorption, diffusion) addresses reflections.

**Asymmetric placement** -- If left and right speakers have different relationships to room boundaries (different distances to side walls, rear wall, corners), each speaker excites different room modes and generates different SBIR patterns. GLM calibrates each speaker independently, so it can partially compensate for level differences, but the fundamental acoustic asymmetry remains. L/R imaging and bass response will differ between channels in ways GLM cannot fully resolve.

**Decay time (RT60)** -- GLM does not shorten reverberation time. A room with excessive decay at 80 Hz will still ring at 80 Hz after GLM calibration. The steady-state peak at 80 Hz may be reduced, but the temporal behavior (how long the room resonates) is unchanged. Only physical absorption addresses decay.

**Diffuse-field response** -- GLM optimizes for a single listening position (or a small zone around it). Moving away from the calibrated position, the correction becomes less valid and may worsen the response. This is inherent to any single-point room correction system.

## GLM Calibration Workflow

### AutoCal

The standard GLM workflow:

1. **Connect all SAM speakers** to the GLM network via the GLM adapter or Ethernet. Verify all speakers are detected in GLM software.
2. **Position the measurement microphone** at the primary listening position, at ear height. Use a stand, not a hand-held position. The microphone should face the ceiling (omnidirectional capsule pointing up) per Genelec's specification.
3. **Run AutoCal** -- GLM sequentially measures each speaker, capturing the room+speaker response at the listening position. It then computes and uploads correction filters to each speaker's DSP.
4. **Verify** -- Play reference material and evaluate. Use REW measurements (via `rew.api_measure`) to capture the post-GLM response independently for objective verification.

### Manual Adjustment

After AutoCal, manual adjustments may be necessary:

- **Bass roll-off** -- If the room has severe low-frequency problems, consider engaging the bass roll-off switch on the speaker to supplement GLM's correction. This is particularly useful when GLM's cut filters reach their maximum depth and the peak is still not fully controlled.
- **Desktop mode / wall compensation** -- Enable the appropriate acoustic setting on the speaker if it is placed on a desk or near a wall. These settings apply broad shelving cuts that complement GLM's parametric corrections.
- **Subwoofer level** -- After AutoCal, verify subwoofer integration with `rew.analyze_room` using the `sub_measurement_id` parameter. Adjust subwoofer level if the crossover region shows excess or deficiency.
- **Target level** -- GLM's target response is approximately flat with a slight room curve. Adjust the system reference level to match the desired monitoring SPL.

### Verification with REW

After GLM calibration, verify the result with REW:

1. Run `rew.api_measure` to capture a fresh measurement at the listening position.
2. Use `rew.ingest_measurement` followed by `rew.analyze_room` to get a full analysis of the post-GLM state.
3. If pre-GLM measurements exist, use `rew.analyze_room` with both `measurement_id` (post) and `pre_measurement_id` (pre) for full comparison analysis. The tool classifies each issue as "GLM success," "partial improvement," or "beyond GLM scope."
4. Use `rew.compare_to_target` with `rew_room_curve` target type to evaluate how well the calibrated system matches the expected in-room response.

## Interpreting GLM Before/After

### What "GLM Addressed" Means

The `rew.analyze_room` tool's GLM comparison section classifies corrections:

- **Success (50%+ reduction)** -- The peak was reduced by at least half. GLM's parametric cut filter is working as designed. The frequency is now within or closer to the target window. Typical for moderate peaks (3--8 dB) at frequencies where the room mode is not too narrow.
- **Partial improvement** -- Some reduction occurred but less than 50%. This may indicate the peak is wider than GLM's filter can fully address, or the peak is at the edge of GLM's correction range.
- **Unchanged** -- Less than the context-dependent threshold of change (1--3 dB depending on issue size). The issue may be outside GLM's target frequency range, or the correction filter may have been allocated elsewhere.

### What "Physics Limitation" Means

Issues classified as "beyond GLM scope" in the analysis output:

- **Deep nulls (>10 dB)** -- These are acoustic cancellations. GLM correctly leaves them alone rather than wasting headroom trying to boost into a null. The recommended action is repositioning (move the speaker or the listening position to shift the null frequency away from critical content).
- **SBIR nulls** -- Identified by narrow Q factor and frequency consistent with a quarter-wavelength boundary distance. Moving the speaker relative to the boundary is the only real solution. See the treatment guide for placement strategies.
- **Persistent room modes** -- The peak may be reduced, but the null side of the mode pattern remains. Bass trapping reduces mode energy overall; repositioning changes which modes are excited at the listening position.

### Overcorrection Indicators

The analysis engine detects two overcorrection patterns:

- **Unnaturally flat sub-bass** (<2 dB variance below 40 Hz) -- May indicate GLM has over-corrected, producing a response that sounds thin or lifeless in the deep bass. Some natural variation below 40 Hz is expected and even preferred.
- **Null revelation** -- When GLM cuts surrounding peaks, pre-existing nulls appear relatively deeper because the surrounding level has been reduced. This is expected behavior, not a GLM error, but it can make the response look worse in narrow bands even though the overall response is improved.

## When to Re-Run GLM

Re-run GLM calibration after:

- Any physical change: moving speakers, moving the listening position, adding or removing furniture, adding or removing acoustic treatment, changing speaker angle
- Replacing a speaker or subwoofer
- Changing crossover settings (subwoofer crossover frequency, bass management configuration)
- Switching between speaker configurations (e.g., stereo to surround)

Do **not** re-run GLM:
- Before making physical changes (measure first, change, then recalibrate)
- To "fix" a problem identified in measurements without first addressing the physical cause
- Repeatedly without changing anything -- GLM is deterministic; running it twice on the same physical setup produces the same result

## Common GLM Mistakes

**Running on an uncalibrated microphone** -- The Genelec 8300A measurement mic is factory-calibrated. Using a different microphone without a calibration file introduces systematic error. If using a third-party mic (e.g., UMIK-1), load its calibration file. Note that GLM expects an omnidirectional measurement mic; directional microphones produce incorrect results.

**Wrong listening position** -- The microphone must be at the exact listening position, at ear height. Measuring at a different position calibrates for the wrong point. Even 15 cm difference changes the SBIR pattern and mode excitation significantly.

**Sub phase not verified** -- GLM aligns delay and level but may not fully optimize subwoofer phase. After AutoCal, verify sub integration with `rew.analyze_room` using the `sub_measurement_id` parameter. If the tool detects phase inversion or a crossover dip, manually adjust sub phase (0/180 switch) or sub delay, then re-run GLM.

**Measuring with noise present** -- Background noise (HVAC, computer fans, external sources) contaminates the measurement. GLM's stimulus-to-noise ratio may be insufficient to accurately characterize the room response. Reduce background noise to at least 10 dB below the measurement level. Check with `rew.api_spl_meter` to verify ambient noise levels before calibrating.

**Expecting GLM to fix everything** -- GLM is a calibration tool, not a replacement for acoustic treatment and proper speaker placement. If the room has severe modal problems, deep SBIR nulls, or strong early reflections, address those physically first. GLM refines the response after the physical setup is optimized. Treat the room, position the speakers, verify with REW, then run GLM, then verify again.

**Not saving the GLM profile** -- After a successful calibration, save the GLM profile. If speaker firmware is updated or settings are reset, the calibration is lost. Keep backups of GLM profiles alongside the REW measurement files that verified them.
