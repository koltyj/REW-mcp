# Acoustic Treatment Guide

## Bass Traps

Bass trapping is the single most impactful acoustic treatment for small rooms. Low-frequency energy accumulates in corners and along room boundaries, and without absorption, room modes ring excessively and produce uneven bass response. Prioritize bass trapping over all other treatment.

### Porous Absorbers

Thick porous absorbers (mineral wool, fiberglass) absorb bass frequencies proportionally to their depth. The absorber must be a meaningful fraction of the wavelength to be effective:

- **4" (100 mm) panel** -- Effective above ~200 Hz. Provides broadband absorption in mid and high frequencies but minimal bass absorption. Insufficient as a bass trap.
- **6" (150 mm) panel** -- Effective above ~125 Hz. Begins to address upper bass. Useful at first reflection points where broadband absorption is also desired.
- **8--12" (200--300 mm) panel or corner trap** -- Effective above ~80 Hz. The minimum depth for meaningful bass trapping in most small rooms.
- **16--24" (400--600 mm) corner trap** -- Effective into the 40--60 Hz range. Required for addressing deep bass modes in typical project studio rooms.

Mount porous absorbers with an air gap behind them to extend their effective range to lower frequencies. A 4" panel with a 4" air gap performs similarly to an 8" panel at low frequencies while using less material.

### Membrane / Panel Absorbers

Membrane (panel) absorbers use a sealed or semi-sealed air cavity behind a stiff panel that resonates at a target frequency. They absorb bass energy in a tuned frequency band without affecting mid and high frequencies. Useful when broadband absorbers would over-damp the room at higher frequencies.

- Effective for targeting specific problem frequencies (typically 40--120 Hz)
- Require careful construction and tuning -- the panel mass, cavity depth, and damping material determine the resonant frequency and bandwidth
- Less predictable than porous absorbers; prototype and measure before committing

### Helmholtz Resonators

Helmholtz resonators are tuned cavities that absorb at a specific frequency. The classic form is a box with a port (hole) -- the air in the port resonates against the air spring inside the cavity.

- Very narrow bandwidth (high Q absorption)
- Target a single problem frequency with precision
- Multiple units required to address multiple modes
- Complex to build correctly; typically used as a supplement to broadband porous treatment, not a replacement

### Placement Priority: Tri-Corners First

Tri-corners (where three surfaces meet -- wall/wall/ceiling or wall/wall/floor) are the highest-pressure zones for all room modes. Place bass trapping in tri-corners first, as these locations provide the maximum absorption per unit of material for all three axial mode families simultaneously.

Priority order for bass trap placement:
1. **Tri-corners** (all eight, prioritizing front wall corners behind speakers)
2. **Wall-wall edges** (vertical dihedral corners)
3. **Wall-ceiling and wall-floor edges**
4. **Front wall** (behind speakers -- absorbs the first back-wall reflection of the speaker's rear radiation)
5. **Rear wall** (behind the listening position)

## Broadband Absorption

### First Reflection Points

After bass trapping, treat the first reflection points. These are the locations on room surfaces where sound from the speaker bounces once before reaching the listening position. Use the mirror method: sit at the listening position and have someone slide a mirror along each wall surface. Where the speaker driver is visible in the mirror, that is a first reflection point.

Treatment at first reflection points should be absorptive, not diffusive. The goal is to reduce the level of the first reflection relative to the direct sound, improving imaging precision and reducing comb filtering. Use panels at least 2" (50 mm) thick, ideally 4" (100 mm), with dimensions large enough to cover the reflection zone (typically 24" x 48" / 60 x 120 cm minimum).

Priority order for first reflection points:
1. **Side walls** at ear height (most critical for stereo imaging)
2. **Ceiling** above the listening position (reflection from each speaker)
3. **Console/desk surface** (use angled absorbers or a reflection filter if the desk cannot be treated)
4. **Front wall** between and around speakers (reduces front wall reflection)

### Rear Wall

The rear wall (behind the listening position) receives direct sound from the speakers and reflects it back toward the listener with a delay. In small rooms, this reflection arrives within 10--30 ms, creating comb filtering and coloring the sound. Treat the rear wall with absorption, diffusion, or a combination.

- If the rear wall is close to the listener (<1.5 m), absorb. There is not enough distance for diffusion to develop its spatial pattern.
- If the rear wall is farther away (>2 m), diffusion becomes viable. See the diffusion section below.

### Ceiling

The ceiling reflection is often overlooked but significant. In rooms with standard ceiling heights (2.4--2.7 m), the ceiling reflection arrives within 5--15 ms of the direct sound, well within the comb filtering danger zone. A broad absorptive cloud panel suspended above the listening position (or surface-mounted panels) addresses this reflection.

### Side Walls

Beyond the first reflection points, the remaining side wall area contributes to the room's overall reverberant field. In small rooms, treat at least 30--40% of side wall area with absorption to control RT60 in the mid and high frequencies. Avoid treating 100% -- some reflective area is needed to maintain a sense of space and prevent the room from sounding dead.

## Diffusion

### When and Where to Use Diffusion

Diffusion scatters sound energy uniformly rather than absorbing it. It preserves the total energy in the room while eliminating strong discrete reflections. This maintains a sense of spaciousness and liveliness without the coloration that specular reflections cause.

Use diffusion when:
- The surface is far enough from the listening position for the scattered sound to fully develop (minimum 3--4x the diffuser's design wavelength, typically >2 m)
- The room is at risk of being over-damped and sounding dead
- Preserving energy is preferred over removing it (e.g., live rooms, control rooms with adequate bass trapping)

### Where to Place Diffusers

- **Rear wall** -- The most common and effective location for diffusion. The listener faces away from this wall, so scattered reflections arrive from behind and to the sides, contributing to spaciousness without coloring the direct sound.
- **Ceiling** (rear half) -- Complements rear wall diffusion. Less critical than the rear wall.
- **Side walls** (only behind the listening position) -- Rear portions of side walls can benefit from diffusion once first reflection points are treated with absorption.

### Where NOT to Place Diffusers

**Not at first reflection points.** This is a common mistake. A diffuser at a first reflection point does not eliminate the reflection; it scatters it into multiple arrivals at similar delay times, potentially worsening comb filtering rather than improving it. First reflection points require absorption.

**Not directly behind speakers.** The front wall behind speakers should be treated with absorption (or the speakers should be soffit-mounted). Diffusion here scatters the speaker's rear radiation back into the room at short delays.

**Not at very close range.** Diffusers need distance to develop their spatial pattern. Placing a 2D diffuser 0.5 m from the listener does not provide useful diffusion -- the scattered sound arrives too quickly and at too similar a level to function as true diffusion.

## Treatment Priority Order for Small Rooms

Follow this sequence when treating a project studio, home studio, or small mixing room. Each step builds on the previous one. Measure with REW after each step to verify improvement before proceeding.

1. **Bass trapping** -- Tri-corners, wall-wall corners, front wall behind speakers. This is the foundation. Without bass trapping, all other treatment decisions are compromised because the bass response is unreliable. Use `rew.analyze_room_modes` and `rew.analyze_decay` to evaluate bass performance after treatment.

2. **First reflection points** -- Side walls, ceiling, desk. Absorptive panels (4"+ thick). Use `rew.analyze_impulse` to verify reduction in early reflection levels. C80 should improve; ITD gap should increase.

3. **Rear wall** -- Absorption, diffusion, or combination depending on distance from listener. Use `rew.analyze_impulse` to verify the rear wall reflection is controlled.

4. **Ceiling cloud** -- Broadband absorber above the listening position. Particularly important in rooms with hard ceilings (drywall, concrete).

5. **Side walls** (remaining area) -- Additional absorption to control RT60. Aim for 30--40% coverage. Use `rew.analyze_decay` to verify decay times are within target.

6. **Fine-tuning** -- Adjust treatment density and placement based on measurements. Use `rew.compare_to_target` to evaluate against the chosen target curve. Run GLM calibration after all physical treatment is complete.

## Common Mistakes

**Over-damping highs while ignoring bass** -- This is the most common treatment error. Thin foam panels (1--2") absorb mid and high frequencies effectively but do nothing for bass. A room covered in thin foam sounds muffled and boomy -- the high-frequency RT60 is unnaturally short while bass rings unchecked. Always start with thick bass trapping before adding thin broadband panels.

**Ignoring bass entirely** -- Some treatments focus exclusively on first reflections with 2" panels, ignoring the fundamental bass problems. The resulting room may have good imaging but wildly inaccurate bass response. Bass trapping is the foundation.

**Symmetric treatment for asymmetric rooms** -- If the room is asymmetric (speaker closer to one side wall than the other, window on one side, door on the other), symmetric treatment does not produce symmetric acoustic behavior. Treat based on measured need, not geometric symmetry. Use `rew.analyze_room` with L/R measurements to identify asymmetric behavior.

**Placing diffusion at first reflection points** -- As noted above, diffusers at first reflection points scatter rather than remove the reflection, potentially worsening comb filtering. Absorb at first reflection points; diffuse at the rear wall and distant surfaces.

**Insufficient air gap** -- Mounting absorbers flat against the wall wastes their low-frequency potential. A 4" panel with a 4" air gap provides significantly more bass absorption than the same panel mounted flush. Use standoffs, furring strips, or Z-clips to create an air gap behind all wall-mounted absorbers.

**Treating based on rules of thumb instead of measurements** -- Generic advice (e.g., "put bass traps in every corner") may not address the specific problems in a given room. Measure first with REW, identify the specific frequencies and locations of problems, treat those problems, then re-measure. The `rew.optimize_room` tool provides measurement-driven recommendations following a scientific approach: suggest, measure, evaluate, then next.

## DIY vs Commercial Panels

### DIY Panel Construction

Standard DIY absorber construction:
- **Frame** -- 1x4 or 2x4 lumber, or metal channel. Depth determines low-frequency effectiveness.
- **Fill** -- Rigid mineral wool or fiberglass. Standard products:
  - **Rockwool Safe'n'Sound** -- Readily available, NRC ~0.95 at 4" depth. Effective for mid/high absorption and moderate bass trapping.
  - **Rockwool ComfortBoard 80** -- Higher density (8 pcf / 128 kg/m^3). Better low-frequency performance.
  - **Owens Corning 703** -- Industry standard. 3 pcf (48 kg/m^3) density. NRC 1.0 at 4" depth. Excellent broadband absorber. More expensive than Rockwool alternatives.
  - **Owens Corning 705** -- Higher density (6 pcf / 96 kg/m^3). Better low-frequency performance than 703. Use for bass traps.
- **Covering** -- Acoustically transparent fabric (muslin, burlap, speaker grille cloth). Do NOT use vinyl, leather, or other non-porous materials as facing -- they reflect sound and defeat the purpose.

### Commercial Panels

Commercial panels offer convenience, consistent construction, and aesthetic finish. When evaluating commercial products, look for:
- Published absorption coefficients (NRC or per-frequency Sabins data)
- Panel depth (reject any panel thinner than 2" for acoustic treatment; reject panels thinner than 4" for bass trapping)
- Core material specification (mineral wool or fiberglass, NOT foam, for bass-relevant frequencies)
- Air gap mounting option

Common commercial options: GIK Acoustics, ATS Acoustics, Primacoustic, Vicoustic. These manufacturers publish measured absorption data. Acoustic foam products (Auralex, etc.) are effective only for mid/high frequencies and should not be relied upon for bass treatment.

## How Much Treatment Is Enough

### RT60 Targets for Mixing Rooms

RT60 (reverberation time -- time for sound to decay by 60 dB) varies with frequency and room size. Target values for mixing and critical listening rooms:

| Frequency Band | Target RT60 (small room <80 m^3) | Target RT60 (medium room 80--200 m^3) |
|---------------|----------------------------------|--------------------------------------|
| 63 Hz | 0.3--0.5 s | 0.3--0.5 s |
| 125 Hz | 0.25--0.4 s | 0.3--0.45 s |
| 250 Hz | 0.2--0.35 s | 0.25--0.4 s |
| 500 Hz | 0.2--0.3 s | 0.25--0.35 s |
| 1 kHz | 0.2--0.3 s | 0.25--0.35 s |
| 2 kHz | 0.2--0.3 s | 0.2--0.3 s |
| 4 kHz | 0.2--0.3 s | 0.2--0.3 s |

Key principles:
- **Overall target: 0.2--0.4 seconds** for small mixing rooms. Use `rew.analyze_decay` with `decay_threshold_seconds: 0.4` to identify frequencies exceeding this target.
- **Flat decay curve** -- RT60 should be roughly uniform across frequency bands. A room with 0.2 s RT60 at 2 kHz but 0.8 s at 80 Hz has a severe bass trapping deficiency. The `rew.analyze_decay` tool reports per-band decay and flags uneven decay profiles.
- **Not too dry** -- RT60 below 0.15 s at mid/high frequencies makes the room sound dead and fatiguing. If side wall treatment brings mid-frequency RT60 below 0.2 s, reduce absorptive coverage or replace some absorption with diffusion.
- **Bass-to-mid ratio** -- Ideally, bass RT60 should be no more than 1.5x the mid-frequency RT60. A ratio above 2x indicates insufficient bass trapping.

### When to Stop Treating

Stop adding treatment when:
- RT60 is within the target range across all frequency bands (verify with `rew.analyze_decay`)
- The bass-to-mid RT60 ratio is below 1.5x
- `rew.compare_to_target` shows the response is within 6 dB of the chosen target curve across all bands
- `rew.optimize_room` with `check_progress` action reports "should_stop" or the smoothness criterion reaches the "good" zone
- Subjective listening confirms the room sounds controlled but not dead -- transients are clean, stereo imaging is stable, and bass notes are defined rather than boomy or ringing

Avoid the temptation to continue adding treatment in pursuit of perfection. Diminishing returns set in quickly once the major problems are addressed. At that point, speaker and listener positioning (guided by `rew.optimize_room`) and GLM calibration provide more return than additional treatment.
