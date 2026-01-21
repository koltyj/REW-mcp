# Feature Landscape: Acoustic Calibration Assistant

**Domain:** Studio monitor calibration and room acoustic measurement
**Researched:** 2026-01-21
**Confidence:** HIGH (verified with multiple sources, existing GLM documentation, and REW ecosystem)

## Executive Summary

Professional acoustic calibration tools fall into three tiers: automated black-box systems (GLM, Sonarworks, ARC), manual analysis tools (REW), and guided workflow systems (rare/non-existent). The gap in the market is a **guided calibration assistant** that combines automated measurement with plain-language interpretation and iterative optimization workflow.

Key insight: GLM calibrates well but provides zero transparency. REW measures comprehensively but requires expert interpretation. The opportunity is bridging this gap — "what GLM did, what it couldn't fix, and what to do about it."

## Table Stakes

Features users expect from a calibration assistant. Missing these makes the tool feel incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **SPL meter integration** | Industry standard for level calibration | Low | REW API already supports this |
| **Mic gain staging guidance** | First step in every calibration guide | Low | Check for clipping, verify sensitivity |
| **Monitor level calibration** | Required for accurate reference monitoring | Low | Target: 79-85 dB SPL @ listening position |
| **Frequency response measurement** | Core acoustic analysis capability | Low | Already implemented in REW MCP |
| **Room mode identification** | Fundamental room acoustics problem | Medium | Theoretical modes + measurement correlation |
| **Pre/post comparison** | Validate that changes improved response | Low | Already implemented in REW MCP |
| **Plain language interpretation** | Users need "what's wrong" not just graphs | Medium | LLM's primary value-add |
| **L/R symmetry validation** | Basic stereo imaging requirement | Low | Compare left vs right measurements |
| **Sub integration analysis** | Critical for systems with subwoofer | Medium | Phase, timing, level, crossover analysis |
| **Measurement naming/organization** | Manage multiple positions/conditions | Low | Already in REW, need workflow structure |

## Differentiators

Features that set this tool apart from GLM alone or REW alone. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **GLM transparency layer** | Explains what AutoCal did/didn't fix | High | Unique value — no other tool does this |
| **Iterative optimization workflow** | Measure → interpret → suggest → re-measure loop | Medium | Structured process beats ad-hoc analysis |
| **Placement recommendations** | Data-driven position adjustments | High | Requires room dimension input, physics model |
| **Confidence-weighted suggestions** | "High confidence: move sub" vs "Low: try treatment" | Medium | Honest about uncertainty |
| **SBIR detection and diagnosis** | Speaker Boundary Interference Response identification | Medium | Physics-based, position-dependent |
| **Guided multi-position measurement** | Spatial averaging for better placement decisions | Medium | Measure multiple spots, identify best |
| **Validation feedback loop** | "Your adjustment improved X by Y dB" | Low | Motivational + educational |
| **Step-by-step calibration wizard** | First-time user workflow: mic gain → level → measure → interpret | Medium | Hand-holding for beginners |
| **Problem prioritization** | "Fix this first, defer that" ordering | Medium | Not all issues are equal severity |
| **Decay time analysis** | Identify ringing/resonance issues GLM can't fix | Medium | Already implemented, needs interpretation |
| **Reflection detection** | Early reflections causing comb filtering | High | Impulse response analysis + positioning |
| **Mix translation prediction** | "Your bass will be X dB louder in other rooms" | High | Statistical model based on deviation |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain or scope creep traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automated speaker movement** | Physical impossibility, safety liability | Suggest movement, human executes |
| **Automatic EQ application** | GLM already does this; duplication + conflict risk | Interpret GLM's results, don't replace it |
| **Treatment product recommendations** | Turns into affiliate marketing, loses credibility | Generic treatment categories only |
| **Multi-room management** | Scope creep, adds complexity for rare use case | Single room, well-optimized workflow |
| **Real-time monitoring during mixing** | Different problem domain (mixing assistant vs calibration) | Focus on calibration phase only |
| **Microphone calibration file generation** | Requires anechoic chamber, professional equipment | Use manufacturer cal files only |
| **Room simulation/modeling** | Complex physics, rarely accurate for small rooms | Measure reality, don't simulate it |
| **Automated treatment design** | Requires structural knowledge, liability risk | Identify issues, suggest treatment types |
| **"Magic fix" promises** | Physics can't be defeated; sets false expectations | Honest about limitations, frame as optimization |
| **Continuous re-calibration** | Calibration is occasional, not continuous | One-time setup + validation workflow |

## Feature Dependencies

```
Foundation Layer (Milestone 1):
├── REW API connection
├── Measurement retrieval
├── Basic analysis (modes, decay, impulse)
└── Comparison capability

Calibration Assistant Layer (Milestone 2):
├── Mic gain staging
│   ├── SPL meter integration
│   └── Clipping detection
├── Level calibration
│   ├── Test signal generation
│   └── Target SPL verification
├── Systematic measurement workflow
│   ├── L/R/Sub sequence
│   ├── Measurement naming
│   └── Organization by condition
├── Plain language interpretation
│   ├── GLM context awareness
│   ├── Room mode correlation
│   └── Problem prioritization
├── Placement recommendations
│   ├── Room dimension input
│   ├── SBIR detection
│   └── Position optimization
└── Validation workflow
    ├── Pre/post comparison
    ├── Improvement quantification
    └── Success criteria evaluation
```

## MVP Recommendation

For Milestone 2 (Calibration Assistant), prioritize:

### Must-Have (Table Stakes)
1. **Mic gain staging** — prevents invalid measurements from clipping/low SNR
2. **Monitor level calibration** — 79-85 dB SPL target at listening position
3. **Systematic measurement sequence** — L, R, Sub, Combined in organized workflow
4. **Plain language interpretation** — "Your left speaker has a 6dB peak at 80Hz due to room mode"
5. **Sub integration analysis** — Phase, level, timing validation
6. **Pre/post comparison** — Validate adjustments improved response

### Should-Have (Key Differentiators)
1. **GLM transparency layer** — Core unique value proposition
2. **Placement recommendations** — Move speaker/sub/listening position suggestions
3. **Step-by-step wizard** — First-time user guided workflow
4. **Validation feedback** — "Moving the sub improved the 50Hz null by 4dB"

### Could-Have (Nice-to-Have)
1. **Multi-position measurement guidance** — Spatial averaging
2. **Decay time interpretation** — Ringing/resonance issues
3. **Reflection detection** — Early reflection identification
4. **Problem prioritization** — "Fix sub phase first, defer HF reflection"

### Won't-Have (Defer to Post-MVP)
1. **Mix translation prediction** — Complex statistical modeling
2. **Advanced reflection analysis** — Requires ray-tracing or detailed room model
3. **Treatment design assistance** — Different skill domain
4. **Multi-room support** — Scope creep

## Domain-Specific Complexity Notes

### High-Complexity Features

**Placement recommendations** (High complexity):
- Requires room dimension input (user-provided)
- Physics model for SBIR calculation (frequency vs distance)
- Multiple position simulation (where to move for best improvement)
- Spatial averaging across measurement points
- Confidence assessment based on room constraints

**GLM transparency layer** (High complexity):
- Distinguish what GLM fixed vs what it couldn't
- Detect overcorrection or calibration artifacts
- Explain why certain issues remain (physics vs GLM limitations)
- Requires deep GLM behavior model (already implemented in glm-context.md)

**Reflection detection** (High complexity):
- Impulse response analysis for early reflections
- Time-of-arrival calculations to identify surfaces
- Comb filtering pattern recognition
- Distinguish direct vs reflected sound

### Medium-Complexity Features

**Sub integration analysis** (Medium complexity):
- Phase alignment detection (0°, 90°, 180° comparison)
- Timing offset calculation
- Crossover region smoothness
- Level matching validation
- Already partially implemented in analyze-sub-integration tool

**Iterative workflow orchestration** (Medium complexity):
- State management (which measurements taken, what's next)
- Conditional branching (if X bad, measure Y next)
- Progress tracking and resumption
- Clear exit criteria ("calibration complete" determination)

### Low-Complexity Features

**SPL meter integration** (Low complexity):
- REW API already supports this
- Read SPL value, compare to target
- Simple pass/fail or adjustment calculation

**Mic gain staging** (Low complexity):
- Generate test signal at known level
- Check for clipping (> -3dBFS)
- Check for low signal (< -40dBFS)
- Suggest preamp gain adjustment

## What GLM Does vs What This Tool Adds

Critical distinction for feature scoping:

| Capability | GLM AutoCal | This Tool |
|------------|-------------|-----------|
| **Measure frequency response** | ✅ Automatic | ✅ Via REW API |
| **Apply corrective EQ** | ✅ To speakers | ❌ Read-only |
| **Level matching** | ✅ L/R/Sub | ✅ Verify only |
| **Sub crossover/phase** | ✅ Automatic | ✅ Verify only |
| **Explain what it did** | ❌ Black box | ✅ **Core value** |
| **Identify unfixable issues** | ❌ Silent | ✅ **Core value** |
| **Suggest placement changes** | ❌ No guidance | ✅ **Core value** |
| **Validate improvements** | ❌ No feedback | ✅ **Core value** |
| **Guide systematic process** | ❌ One-shot | ✅ **Core value** |
| **Detect room modes** | ✅ Implicit | ✅ **Explicit + explained** |
| **Handle deep nulls** | ❌ Can't fix | ✅ **Explain why + suggest fix** |
| **Reflection analysis** | ❌ Not addressed | ✅ **Identify + explain** |

**Key insight**: This tool doesn't replace GLM — it **interprets GLM's results** and **guides manual optimization** that GLM cannot do (placement, treatment).

## Feature Categorization by User Journey

### Phase 1: Setup (First-Time User)
- [ ] Mic gain staging wizard
- [ ] Monitor level calibration
- [ ] Device configuration guidance
- [ ] Calibration file verification

### Phase 2: Baseline Measurement
- [ ] Systematic L/R/Sub measurement sequence
- [ ] Measurement organization (naming, conditions)
- [ ] Pre-GLM baseline capture
- [ ] Multi-position measurement guidance (optional)

### Phase 3: GLM Calibration
- [ ] User runs GLM AutoCal (external)
- [ ] Tool provides "what to expect" guidance

### Phase 4: Post-GLM Validation
- [ ] Systematic re-measurement (same positions)
- [ ] Pre/post comparison analysis
- [ ] GLM transparency interpretation
- [ ] Identify persistent issues

### Phase 5: Optimization (if needed)
- [ ] Placement recommendations for unfixed issues
- [ ] Sub position/phase optimization
- [ ] Iterative re-measurement workflow
- [ ] Improvement validation

### Phase 6: Final Validation
- [ ] Success criteria evaluation (±3dB, 40-200Hz)
- [ ] L/R symmetry check
- [ ] Sub integration validation
- [ ] "Calibration complete" determination

## User Skill Level Considerations

### Beginner Producer (Primary Audience)
**Needs:**
- Step-by-step guidance (don't assume knowledge)
- Plain language explanations (no jargon without definition)
- Confidence in next steps ("do this, then that")
- Validation that they're doing it right

**Features:**
- Calibration wizard (guided workflow)
- Problem prioritization (what to fix first)
- Success criteria (when to stop)
- Educational explanations (why this matters)

### Intermediate User (Secondary Audience)
**Needs:**
- Faster workflow (skip hand-holding)
- More technical detail (if requested)
- Flexibility to deviate from wizard
- Advanced analysis on demand

**Features:**
- Express mode (fewer prompts)
- Technical details toggle
- Manual measurement selection
- Raw data access

### Expert User (Tertiary Audience)
**Needs:**
- Full control (no automation unless requested)
- Scriptable workflows
- Batch operations
- Integration with other tools

**Features:**
- API access (already available via MCP)
- Batch comparison
- Custom analysis scripts
- Export capabilities

## Competitive Feature Analysis

| Feature | GLM | REW | Sonarworks | ARC Studio | This Tool |
|---------|-----|-----|------------|------------|-----------|
| **Automated measurement** | ✅ | ⚠️ Manual | ✅ | ✅ | ✅ |
| **Corrective EQ** | ✅ To speaker | ❌ | ✅ Plugin | ✅ Hardware | ❌ Read-only |
| **Plain language results** | ❌ | ❌ | ⚠️ Basic | ⚠️ Basic | ✅ |
| **Placement guidance** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **GLM transparency** | N/A | ❌ | N/A | N/A | ✅ |
| **Room mode detection** | Implicit | ✅ | ✅ | ✅ | ✅ |
| **Reflection analysis** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Sub integration** | ✅ | ✅ | ⚠️ Basic | ⚠️ Basic | ✅ |
| **Multi-position** | ⚠️ GLM4 | ✅ | ❌ | ❌ | ✅ |
| **Iterative workflow** | ❌ One-shot | ❌ | ❌ | ❌ | ✅ |
| **Cost** | Free w/ SAM | Free | $200/yr | $300 one-time | Free |

**Competitive positioning**: Only tool that combines GLM transparency + guided workflow + placement recommendations. Not a replacement for GLM (complements it), not a replacement for REW (uses it as measurement engine).

## Sources

Research based on:

### Professional Calibration Tools
- [Genelec GLM Software](https://www.genelec.com/glm) — Primary system being assisted
- [REW Room EQ Wizard](https://www.roomeqwizard.com/) — Measurement engine
- [Sonarworks SoundID Reference](https://www.sonarworks.com/soundid-reference) — Software-based room correction
- [IK Multimedia ARC Studio](https://www.production-expert.com/production-expert-1/ik-multimedia-arc-studio-does-it-really-work) — Hardware-based room correction

### Calibration Workflows
- [Calibrating Your Mixing Setup - Sound on Sound](https://www.soundonsound.com/techniques/calibrating-your-mixing-setup)
- [REW Getting Started Guide](https://www.roomeqwizard.com/help/help_en-GB/html/gettingstarted.html)
- [Room Acoustic Measurements 101 - Acoustic Frontiers](https://acousticfrontiers.com/blogs/articles/room-acoustic-measurements-101)
- [How To Measure Room Acoustics With REW - HOFA-Akustik](https://hofa-akustik.de/en/blog-en/measuring-room-acoustics-with-room-eq-wizard/)

### Common Mistakes and Pitfalls
- [Audyssey Room Calibration Common Mistakes - Sigberg Audio](https://www.sigbergaudio.com/blogs/news/audyssey-room-calibration-common-mistakes)
- [Why is Room Calibration Important? - Audient](https://support.audient.com/hc/en-us/articles/41240184029460-Why-is-Room-Calibration-Important)
- [Music Room Calibration FAQs - Dolby](https://professionalsupport.dolby.com/s/article/Music-Room-Calibration-FAQs?language=en_US)

### Comparison and Reviews
- [Group Test: What's the Best Room Correction Software? - MusicTech](https://musictech.com/features/group-test-room-correction/)
- [Room EQ Comparison: REW, ARC, Sonarworks - VI-CONTROL](https://vi-control.net/community/threads/room-eq-rew-arc-sonarworks-comparisons.104880/)
- [ARC Studio vs Sonarworks - Distinct Mastering](https://distinctmastering.com/post/ik-multimedia-arc-studio-vs-sonarworks-soundid-a-producers-guide-to-choosing-room-correction)
- [DRC Comparison: Dirac vs ARC vs Sonarworks - Audio Science Review](https://www.audiosciencereview.com/forum/index.php?threads/comparison-of-drcs-dirac-live-for-studio-ik-multimedia-arc-system-3-and-sonarworks-reference-4-studio-edition.18607/)

### SPL Calibration and Gain Staging
- [Calibrating the SPL Reading - REW Help](https://www.roomeqwizard.com/help/help_en-GB/html/inputcal.html)
- [What Do I Need to Measure SPL? - Rational Acoustics](https://support.rationalacoustics.com/support/solutions/articles/150000183626-what-do-i-need-to-measure-spl-)
- [How to Calibrate Smaart for SPL - Rational Acoustics](https://support.rationalacoustics.com/support/solutions/articles/150000162795-how-to-calibrate-smaart-for-spl)

### Subwoofer Integration
- [Tuning Your Subwoofer: REW How-To - AVForums](https://www.avforums.com/threads/tuning-your-subwoofer-rew-how-to.728289/)
- [DIY Subwoofer Setup Using REW - AVForums](https://www.avforums.com/threads/diy-subwoofer-setup-using-rew.1872039/)

### Training and Education
- [Berklee Online: Acoustics Course](https://online.berklee.edu/courses/acoustics)
- [Berklee Online: Architectural, Acoustic, and Audio System Design](https://online.berklee.edu/courses/architectural-acoustic-and-audio-system-design-for-the-modern-music-production-studio)

### Existing Project Documentation
- Project file: `/Users/koltonjacobs/DEV/MCP-Servers/REW-mcp/.planning/PROJECT.md`
- GLM context: `/Users/koltonjacobs/DEV/MCP-Servers/REW-mcp/docs/glm-context.md`
- REW API tools: `/Users/koltonjacobs/DEV/MCP-Servers/REW-mcp/docs/tools/`
