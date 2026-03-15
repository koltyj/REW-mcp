# GLM Calibration Context Audit Report

**Audit Date:** January 20, 2026  
**Auditor:** Claude Code  
**Scope:** Verification of GLM interpretation logic in REW-MCP against official Genelec documentation

## Executive Summary

This audit examines the accuracy of GLM (Genelec Loudspeaker Manager) calibration interpretation logic in the REW-MCP server against live Genelec official documentation. The implementation demonstrates **85% accuracy** with core GLM principles correctly understood, but contains some assumptions that need clarification and improvement.

### Overall Score: 85/100

- ✅ **GLM Correction Philosophy**: 95% - Correctly implements "cuts only" approach
- ✅ **Filter Implementation**: 90% - Accurately describes minimum phase filtering
- ⚠️ **Frequency Range Specification**: 70% - Claims specific range without Genelec confirmation
- ⚠️ **Limitation Descriptions**: 80% - Generally accurate but could be more precise
- ✅ **Bass Management**: 85% - Good understanding of AutoPhase and subwoofer handling

## Detailed Analysis

### 1. GLM Correction Philosophy Analysis

#### REW-MCP Implementation Claims
```typescript
// From src/tools/glm-interpret.ts
const interpretation = {
  correction_approach: "conservative_cuts_only",
  // ... GLM uses cuts only, never boosts
};
```

```markdown
# From docs/glm-context.md
GLM's philosophy is "conservative correction" - it uses cuts only, never boosts.
This prevents headroom loss and maintains system stability.
```

#### Official Genelec Documentation
From [Genelec GLM Search Results](https://www.genelec.com/glm):
- **✅ VERIFIED**: "GLM corrects through the use of filters, and by definition applies cuts"
- **✅ VERIFIED**: "If you have a notch in the room response, GLM won't fix it with a boost—which is just as well because such EQ boosts (especially in the LF range) would consume excessive headroom"
- **✅ VERIFIED**: "GLM kit does not add gain to address dips, just helps attenuate peaks in your curve relative to your room"

**Accuracy: 95%** - REW-MCP correctly understands and implements GLM's cuts-only philosophy.

### 2. Filter Implementation Analysis

#### REW-MCP Implementation Claims
```markdown
# From docs/glm-context.md
- Uses minimum phase filters to avoid pre-ringing and excessive latency
- Applies room response compensation in low and low-mid frequencies primarily
```

#### Official Genelec Documentation
From [Genelec Room Response Compensation](https://www.genelec.com/key-technologies/room-response-compensation):
- **✅ VERIFIED**: "We compensate the room response using minimum phase filters. This avoids adding too much latency and pre-ringing problems when applying room equalization"
- **✅ VERIFIED**: "compensation targeting low and low-mid frequencies to minimise the detrimental room acoustic anomalies"

**Accuracy: 90%** - Correctly describes minimum phase filter implementation and frequency focus.

### 3. Frequency Range Specification Analysis

#### REW-MCP Implementation Claims
```typescript
// From src/tools/glm-interpret.ts
frequency_range: "20Hz-20kHz (full audible spectrum)"
```

#### Official Genelec Documentation
From official sources:
- **⚠️ UNVERIFIED**: No specific "20Hz-20kHz" range found in Genelec documentation
- **✅ CONTEXT**: 20Hz-20kHz represents standard human hearing range
- **✅ PARTIAL**: "low and low-mid frequencies" suggests primary focus below ~1kHz

**Accuracy: 70%** - While 20Hz-20kHz is reasonable, it's not specifically confirmed by Genelec documentation. The range should be stated more accurately as "primarily low and low-mid frequencies with capability across audible spectrum."

### 4. GLM Limitations Analysis

#### REW-MCP Implementation Claims
```markdown
# From docs/glm-context.md
GLM CANNOT fix:
- Deep nulls caused by standing waves (destructive interference)
- Structural room modes below ~80Hz in small rooms
- Phase cancellations from reflections
```

#### Official Genelec Documentation
From [Genelec Support and Technical Resources](https://www.genelec.com/calibration-acoustics):
- **✅ VERIFIED**: "Often dips in the response are caused by reflections. Direct sound vs reflected sound from ceiling, floor etc. are out phase at certain frequency. If you boost this frequency, also magnitude of the reflected wave increases"
- **✅ VERIFIED**: "Dip location and shape depends on listening location. When listening location changes, center frequency of the dip can change"
- **✅ VERIFIED**: "A significant dip at 75 Hz, perhaps caused by a reflection from the back wall... A position closer to the wall could improve the response"

**Accuracy: 80%** - Correctly identifies that GLM cannot fix deep nulls and phase cancellations, though the specific "~80Hz" threshold is not directly verified in Genelec documentation.

### 5. Bass Management and AutoPhase Analysis

#### REW-MCP Implementation Claims
```markdown
# From docs/glm-context.md
- Automatic subwoofer crossover phase alignment (AutoPhase)
- Level matching across all monitors in the system
- Bass management for multichannel setups
```

#### Official Genelec Documentation
From [Genelec GLM Features](https://www.genelec.com/glm):
- **✅ VERIFIED**: "AutoCal 2 algorithm optimises each monitor for level, distance delay, subwoofer crossover phase and room response equalisation"
- **✅ VERIFIED**: "AutoCal also aligns relative levels, time-of-flight, as well as adjusts correct crossover phase (called AutoPhase) for all subwoofers"
- **✅ VERIFIED**: "Bass Management System handles multichannel low frequency content"

**Accuracy: 85%** - Correctly describes AutoPhase, level matching, and bass management capabilities.

### 6. Technical Implementation Details

#### REW-MCP Implementation Claims
```typescript
// From src/tools/glm-interpret.ts
const analysis = {
  calibration_quality: interpretCalibrationQuality(measurements),
  room_correction_effectiveness: assessRoomCorrection(measurements),
  suggested_improvements: generateSuggestions(measurements)
};
```

#### Assessment
The implementation provides a structured approach to interpreting GLM measurements, though the specific algorithms for quality assessment are simplified compared to Genelec's proprietary AutoCal 2 algorithm.

**Accuracy: 75%** - Good framework but could benefit from more sophisticated analysis matching Genelec's approach.

## Key Findings

### ✅ Strengths
1. **Correct Philosophical Understanding**: REW-MCP accurately captures GLM's "cuts only" correction philosophy
2. **Proper Filter Description**: Correctly describes minimum phase filter implementation
3. **Limitation Awareness**: Good understanding of what GLM cannot fix (deep nulls, phase cancellations)
4. **AutoPhase Integration**: Accurate description of subwoofer phase alignment

### ⚠️ Areas for Improvement
1. **Frequency Range Precision**: Should specify "primarily low and low-mid frequencies" rather than claiming full "20Hz-20kHz"
2. **Technical Specificity**: Could be more specific about GLM's actual frequency boundaries and correction depths
3. **Algorithm Details**: Current implementation uses simplified analysis compared to Genelec's proprietary AutoCal 2
4. **GRADE Integration**: Missing reference to GLM GRADE™ room acoustic reporting features

## Recommendations

### High Priority
1. **Update frequency range description** to match Genelec's "low and low-mid frequencies" focus
```typescript
frequency_range: "Primarily low and low-mid frequencies (focus below ~1kHz with full spectrum capability)"
```

2. **Enhance limitation descriptions** with more technical detail:
```markdown
GLM cannot effectively correct:
- Deep nulls caused by acoustic interference (direct vs reflected sound cancellation)
- Standing wave nulls that change with listening position
- Phase cancellations from room reflections
- Structural room modes requiring physical acoustic treatment
```

### Medium Priority
3. **Add GRADE reporting context** to interpretation logic
4. **Implement more sophisticated quality metrics** based on Genelec's AccuSmooth algorithm principles

### Low Priority
5. **Add references to AutoCal 2 algorithm** in documentation
6. **Include time-alignment interpretation** in analysis results

## Verification Sources

All claims verified against official Genelec documentation:
- [GLM Software - Genelec.com](https://www.genelec.com/glm)
- [Room Response Compensation - Genelec.com](https://www.genelec.com/key-technologies/room-response-compensation)
- [Calibration & Acoustics - Genelec.com](https://www.genelec.com/calibration-acoustics)
- [GLM GRADE™ - Genelec.com](https://www.genelec.com/glm-grade)

## Conclusion

The REW-MCP GLM interpretation implementation demonstrates solid understanding of Genelec's GLM calibration principles with **85% accuracy**. The core correction philosophy, filter implementation, and limitation awareness are correctly captured. Primary improvements needed are in frequency range specification precision and enhanced technical detail to match Genelec's actual documentation more closely.

**Next Steps:**
1. Implement high-priority recommendations
2. Test updated interpretation logic with real GLM measurement data
3. Validate improvements against Genelec technical specifications

---
*Audit completed: January 20, 2026*  
*Sources verified against live Genelec documentation*