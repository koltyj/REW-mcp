---
name: room-acoustics
description: This skill should be used when the user asks about "room acoustics", "room modes", "standing waves", "bass traps", "acoustic treatment", "speaker placement", "listening position", "SBIR", "speaker boundary interference", "reflection points", "RT60", "decay time", "frequency response problems", "frequency null", "bass peak", "room correction", "GLM calibration", "Genelec GLM", "speaker calibration", "target curve", "Schroeder frequency", or when the user describes problems like "my bass sounds boomy", "there is a dip in my frequency response", "how should I treat my room", or discusses REW measurement data showing acoustic anomalies. Provides room acoustics domain knowledge for interpreting REW measurements and making treatment and placement decisions.
---

# Room Acoustics Domain Knowledge

This skill provides the acoustics domain knowledge needed to interpret REW measurements and guide treatment and placement decisions. Apply this knowledge when analyzing frequency response data, impulse responses, decay characteristics, and calibration results from the REW MCP server.

## Room Modes

### Fundamentals

Room modes are standing waves that form when sound reflects between parallel surfaces. The fundamental frequency of a mode depends on the distance between surfaces and the speed of sound (343 m/s at 20 C).

Three types exist, in decreasing order of energy:

- **Axial modes** -- involve two parallel surfaces (one dimension). Strongest and most audible. Calculate as `f = n * c / (2 * L)` where `n` is the mode order, `c` is the speed of sound, and `L` is the dimension in meters. The REW MCP `rew.analyze_room_modes` tool computes these automatically.
- **Tangential modes** -- involve four surfaces (two dimensions). Roughly half the energy of axial modes. Calculate as `f = (c/2) * sqrt((n1/L1)^2 + (n2/L2)^2)`.
- **Oblique modes** -- involve all six surfaces (three dimensions). Weakest and typically negligible below 200 Hz. Only relevant when modal density is very low.

### Identifying Modes from Measurements

Look for these signatures in REW frequency response data:

- **Narrow peaks** (high Q) in the 20--200 Hz range that correlate with theoretical mode frequencies for the room dimensions. Use `rew.analyze_room_modes` with `room_dimensions_m` to get automatic correlation.
- **Mode clusters** -- multiple modes within 5 Hz of each other. These reinforce and create exaggerated peaks. The analysis engine flags clusters of three or more modes.
- **Mode gaps** -- frequency ranges with no modal support (>15 Hz gap). These create thin-sounding regions that no amount of EQ can fix. Gaps exceeding 30 Hz are significant.

### When to Worry

Focus on modes below 200 Hz. Above the Schroeder frequency, modal density is high enough that the room behaves statistically and individual modes are not a concern. Prioritize peaks exceeding 5 dB deviation and nulls exceeding -6 dB, which are the default thresholds in `rew.analyze_room_modes`.

Modes with high Q (>10) are more audible and create longer ringing. Cross-reference with `rew.analyze_decay` results -- if a peak at 63 Hz also shows elevated T60, that mode is actively ringing and producing audible coloration.

## SBIR (Speaker Boundary Interference Response)

### Quarter-Wavelength Cancellation

When a speaker is placed near a wall, the direct sound and the wall reflection interfere. At the frequency where the distance from the speaker driver to the wall equals one-quarter wavelength, destructive interference creates a null (cancellation). The null frequency is:

```
f_null = c / (4 * d)
```

where `d` is the distance from the driver to the nearest boundary in meters.

Common SBIR null frequencies by distance:
- 0.3 m (1 ft) from wall: ~286 Hz null
- 0.6 m (2 ft): ~143 Hz null
- 0.9 m (3 ft): ~95 Hz null
- 1.2 m (4 ft): ~72 Hz null
- 1.5 m (5 ft): ~57 Hz null

### How Distance Creates Nulls

Each boundary (rear wall, side wall, ceiling, floor, desk surface) creates its own SBIR null at a frequency determined by the driver-to-boundary distance. Multiple boundaries create multiple nulls. The `rew.analyze_room` tool's peaks/nulls section classifies SBIR nulls using Q-factor analysis -- narrow, deep nulls with high Q (>5) at frequencies consistent with boundary distances are flagged as SBIR candidates.

SBIR nulls are particularly problematic because:
- They **cannot** be corrected by EQ or GLM. Boosting at a null frequency wastes amplifier headroom and heats the voice coil without producing useful output at the listening position.
- They are position-dependent. Moving the speaker by even 15 cm changes the null frequency significantly.
- They interact with room modes. An SBIR null coinciding with a room mode null creates an extremely deep cancellation.

### Resolution

Move the speaker closer to or farther from the boundary. Flush-mounting (soffit mounting) eliminates the rear wall SBIR entirely by removing the path length difference. When flush mounting is not possible, place speakers either very close (<0.15 m) to push the null above the crossover frequency, or far enough away (>1.5 m) to push it below the subwoofer's operating range.

## Reflection Points

### First Reflections

First-order reflections arrive at the listening position after a single bounce off a room surface. They are the strongest reflections and most damaging to stereo imaging and frequency response accuracy. Identify them using `rew.analyze_impulse` -- reflections arriving within 0--20 ms of the direct sound with relative levels above -15 dB are the primary concern.

The mirror-source method determines first reflection points: imagine a mirror on each wall surface. If the speaker is visible in the mirror from the listening position, that point is a first reflection point. Typical surfaces to treat: side walls (most critical), ceiling, desk/console surface, front wall behind monitors.

### Flutter Echo

Flutter echo occurs between parallel reflective surfaces (typically side walls or floor/ceiling). It produces a rapid series of discrete reflections audible as a metallic ringing or buzzing on transients. In REW impulse response data, flutter echo appears as a periodic train of reflections with consistent spacing.

Detect flutter echo by looking for repeated reflections at regular intervals in the ETC (Energy Time Curve). The spacing corresponds to the round-trip time between the parallel surfaces. Treat by angling surfaces, applying absorption to at least one surface of the parallel pair, or adding diffusion.

### Comb Filtering

When a reflection arrives with sufficient level and a short delay, it creates a comb filter pattern -- alternating peaks and nulls at harmonically related frequencies. The first null occurs at `f = c / (2 * path_difference)`. The `rew.analyze_impulse` tool calculates comb filter frequencies for each detected reflection.

Comb filtering from desk reflections is extremely common in near-field monitoring setups. The desk surface creates a strong reflection with a short path difference, producing nulls in the 100--400 Hz range that degrade low-mid accuracy.

## Schroeder Frequency and Modal Density

### Transition from Modal to Statistical Behavior

The Schroeder frequency marks the boundary between the modal region (where individual room modes dominate the response) and the statistical region (where modal density is high enough that the room behaves diffusely). Calculate it as:

```
f_schroeder = 2000 * sqrt(RT60 / V)
```

where `RT60` is the reverberation time in seconds and `V` is the room volume in cubic meters. The `rew.analyze_room_modes` tool computes this automatically when room dimensions are provided.

For a typical small studio room (40 m^3, RT60 = 0.3 s):
- Schroeder frequency: ~173 Hz

Below the Schroeder frequency, treat the room as a collection of discrete resonances. EQ and room correction (including GLM) have limited effectiveness here -- physical changes (placement, treatment) are the primary tools. Above the Schroeder frequency, broadband absorption and diffusion become effective, and EQ corrections translate more predictably.

### Practical Implications

- Below Schroeder: focus on modal analysis, speaker/listener placement optimization, and bass trapping. Use `rew.analyze_room_modes` and `rew.optimize_room` for guidance.
- Above Schroeder: focus on reflection control, broadband absorption, and EQ/GLM correction. Use `rew.analyze_impulse` and `rew.compare_to_target` for evaluation.
- At the transition: problems here are the hardest to solve. Both modal and statistical behaviors overlap.

## Target Curves

### Why Flat Is Not Ideal

A measurement microphone captures the direct sound plus all room reflections. In a real room, a truly flat direct-sound response from a speaker produces a measured response that rises in the bass (room gain from boundaries) and falls in the treble (air absorption, increased directivity). A "flat" measured response would actually mean the speaker is deficient in the bass and overly bright.

The `rew.compare_to_target` tool supports several built-in target curves:

- **Flat** -- 0 dB reference. Useful for anechoic comparison only.
- **REW Room Curve** -- +6 dB at 20 Hz tapering to 0 dB at 200 Hz, then -6 dB at 20 kHz. Represents expected in-room behavior of a well-calibrated system.
- **Harman** -- +4 dB bass shelf below 60 Hz, gentle HF rolloff. Based on listener preference research.
- **B&K House Curve** -- classic studio mixing reference with gradual LF rise and HF fall.

### LF Rise and HF Roll-off

The low-frequency rise in a target curve accounts for:
- Boundary reinforcement (each nearby boundary adds ~3 dB below its associated SBIR frequency)
- Room pressurization effect below the lowest room mode
- Subjective preference for slightly elevated bass in real listening environments

The high-frequency rolloff accounts for:
- Increased speaker directivity at higher frequencies (less room contribution)
- Air absorption at very high frequencies
- Listener preference (research consistently shows slight HF rolloff is preferred)

When evaluating measurements against a target, use `rew.compare_to_target` with the `rew_room_curve` or `harman` target type. Deviations exceeding 6 dB from the chosen target in any frequency band warrant investigation.

## Quick Reference: Common Problem Frequencies and Likely Causes

| Symptom | Likely Cause | Tool to Investigate |
|---------|-------------|-------------------|
| Broad peak 30--80 Hz | Room mode (axial, length dimension) | `rew.analyze_room_modes` |
| Narrow null 60--150 Hz | SBIR from rear wall | `rew.analyze_room` (peaks_nulls section) |
| Null at ~143 Hz | Speaker 0.6 m from wall (SBIR) | `rew.analyze_room` |
| Comb pattern 100--400 Hz | Desk reflection | `rew.analyze_impulse` |
| Ringing at specific Hz | Room mode with long decay | `rew.analyze_decay` |
| L/R imbalance below 200 Hz | Asymmetric speaker placement | `rew.analyze_room` (lr_symmetry section) |
| Dip at sub crossover | Phase/polarity mismatch | `rew.analyze_room` (sub_integration section) |
| Deep null, GLM cannot fix | SBIR or mode cancellation | `rew.interpret_with_glm_context` |
| Response above target >6 dB | Untreated room mode or boundary gain | `rew.compare_to_target` |
| Excessive decay below 100 Hz | Insufficient bass trapping | `rew.analyze_decay` |

## References

For detailed treatment of specific topics, consult:

- **[GLM Knowledge](references/glm-knowledge.md)** -- Genelec GLM calibration system: what it measures, what it corrects, its limitations, calibration workflow, and interpretation of before/after results.
- **[Treatment Guide](references/treatment-guide.md)** -- Acoustic treatment principles: bass traps, broadband absorption, diffusion, priority order, material specifications, and RT60 targets for mixing rooms.
