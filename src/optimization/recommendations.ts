/**
 * Recommendation Generation Functions
 *
 * Generates element-specific placement recommendations with physics-based reasoning
 * from detected acoustic issues.
 */

import type { PrioritizedIssue } from '../interpretation/types.js';
import type { RoomDimensions } from '../types/index.js';
import type {
  PlacementRecommendation,
  SubRecommendationDetail,
  OptimizationElement,
  RecommendationConfidence
} from './types.js';

interface PhaseInfo {
  is_inverted: boolean;
  phase_difference_deg: number;
  expected_improvement_db?: number;
}

/**
 * Determine which element should be adjusted based on issue category and frequency.
 */
export function determineElement(issue: PrioritizedIssue): OptimizationElement {
  const category = issue.category.toLowerCase();
  const freq = extractFrequency(issue.issue);

  // SBIR issues: always monitors
  if (category === 'sbir') {
    return 'monitors';
  }

  // Sub integration: always subwoofer
  if (category === 'sub_integration') {
    return 'subwoofer';
  }

  // L/R symmetry: always monitors
  if (category === 'lr_symmetry') {
    return 'monitors';
  }

  // Room modes: depends on frequency
  if (category === 'room_modes') {
    if (freq && freq < 80) {
      return 'subwoofer';
    } else if (freq && freq >= 80 && freq <= 200) {
      return 'listening_position';
    }
    return 'listening_position';
  }

  // Default to listening position for unknown categories
  return 'listening_position';
}

/**
 * Extract frequency from issue description (e.g., "125 Hz" or "125Hz")
 */
function extractFrequency(issueText: string): number | null {
  const match = issueText.match(/(\d+)\s*Hz/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Determine recommendation confidence based on issue category and details.
 */
function determineConfidence(issue: PrioritizedIssue, issueFreq: number | null): RecommendationConfidence {
  const category = issue.category.toLowerCase();

  // SBIR with high Q: high confidence
  if (category === 'sbir') {
    const qMatch = issue.issue.match(/Q[:\s]*(\d+\.?\d*)/i);
    if (qMatch) {
      const q = parseFloat(qMatch[1]);
      if (q > 10) return 'high';
      if (q > 5) return 'medium';
    }
    return 'medium';
  }

  // Room modes with specific frequency: medium confidence
  if (category === 'room_modes' && issueFreq) {
    return 'medium';
  }

  // Sub integration: medium confidence
  if (category === 'sub_integration') {
    return 'medium';
  }

  // Default: medium confidence
  return 'medium';
}

/**
 * Generate placement recommendation from a prioritized issue.
 *
 * Uses physics-based reasoning to provide actionable guidance:
 * - SBIR: Quarter-wavelength formula for boundary distance
 * - Room modes: Position adjustment to avoid mode nulls
 * - Peaks: Boundary distance changes
 * - Nulls: Repositioning (not EQ - can't boost nulls)
 */
export function generatePlacementRecommendation(issue: PrioritizedIssue): PlacementRecommendation {
  const element = determineElement(issue);
  const frequency = extractFrequency(issue.issue);
  const confidence = determineConfidence(issue, frequency);

  let action: string;
  let reason: string;
  let expectedImprovement: string;

  const category = issue.category.toLowerCase();

  if (category === 'sbir') {
    // SBIR: Use quarter-wavelength physics
    const freq = frequency || 125; // Default if not extracted
    const SPEED_OF_SOUND_FT_S = 1125;
    const distance = SPEED_OF_SOUND_FT_S / (4 * freq);

    action = `Move monitors away from boundary (estimated ${distance.toFixed(1)} ft distance causing ${freq} Hz null)`;
    reason = `SBIR null at ${freq} Hz from quarter-wavelength cancellation - reflected wave interferes with direct sound`;
    expectedImprovement = 'May reduce null by 3-10 dB (nulls cannot be boosted, only avoided through repositioning)';
  } else if (category === 'room_modes') {
    // Room modes: Position adjustment
    const freq = frequency || 50;
    if (freq < 80) {
      action = 'Reposition subwoofer to minimize room mode excitation';
      reason = `Low frequency room mode at ${freq} Hz - positioning affects modal coupling`;
      expectedImprovement = 'May reduce modal peak by 3-6 dB through position optimization';
    } else {
      action = 'Adjust listening position to avoid room mode null zones';
      reason = `Room mode at ${freq} Hz creates standing wave pattern - nulls occur at modal nodes`;
      expectedImprovement = 'May reduce modal null by 3-6 dB by moving away from null zones';
    }
  } else if (issue.issue.toLowerCase().includes('peak')) {
    // Peak: Boundary distance changes
    const freq = frequency || 100;
    action = 'Adjust speaker distance from boundaries to reduce boundary reinforcement';
    reason = `Peak at ${freq} Hz likely from boundary gain - proximity to walls increases bass output`;
    expectedImprovement = 'May reduce peak by 3-6 dB through boundary distance adjustment';
  } else if (issue.issue.toLowerCase().includes('null')) {
    // Null: Repositioning
    const freq = frequency || 100;
    action = 'Reposition speakers or listening position to minimize null depth';
    reason = `Null at ${freq} Hz from cancellation - cannot be boosted with EQ`;
    expectedImprovement = 'May reduce null depth by 3-6 dB through position changes';
  } else {
    // Generic recommendation
    action = 'Adjust element placement to address acoustic issue';
    reason = `${category} issue detected requiring position optimization`;
    expectedImprovement = 'Position changes may improve response by 3-6 dB';
  }

  return {
    element,
    action,
    reason,
    confidence,
    expected_improvement: expectedImprovement,
    issue_frequency_hz: frequency || 0,
    issue_severity: issue.severity,
    issue_category: category
  };
}

/**
 * Generate detailed subwoofer recommendation with phase, boundary, and crossover context.
 *
 * More detailed than monitor recommendations:
 * - Includes phase flip guidance if phase inversion detected
 * - Explains boundary loading physics (+3dB per boundary)
 * - Provides crossover-related context for integration
 */
export function generateSubRecommendation(
  issue: PrioritizedIssue,
  phaseInfo?: PhaseInfo
): SubRecommendationDetail {
  const baseRec = generatePlacementRecommendation(issue);
  const frequency = extractFrequency(issue.issue);

  const subRec: SubRecommendationDetail = {
    ...baseRec,
    element: 'subwoofer'
  };

  // Add phase suggestion if phase inversion detected
  if (phaseInfo?.is_inverted) {
    subRec.phase_suggestion = `Try phase flip (0° → 180° or vice versa) - current phase difference of ${phaseInfo.phase_difference_deg.toFixed(1)}° suggests polarity inversion. Expected improvement: ${phaseInfo.expected_improvement_db?.toFixed(1) || '3-6'} dB.`;
  }

  // Add boundary loading context
  subRec.boundary_loading = 'Corner placement adds +3 dB per boundary (corner = +9 dB total from 3 boundaries). Moving away from boundaries reduces low frequency output.';

  // Add crossover context if issue is near typical crossover range
  if (frequency && frequency >= 60 && frequency <= 100) {
    subRec.crossover_context = `Issue at ${frequency} Hz is near typical crossover range (60-100 Hz). Consider adjusting crossover frequency or sub level to improve integration with mains.`;
  }

  return subRec;
}

/**
 * Generate listening position recommendation with room dimension awareness.
 *
 * Uses 38% rule when dimensions available:
 * - Optimal listening position is ~38% of room length from front wall
 * - Avoids common modal nulls at 1/4, 1/2, 3/4 room positions
 *
 * Without dimensions: Generic guidance to move forward/backward.
 */
export function generateListeningPositionRecommendation(
  issue: PrioritizedIssue,
  roomDimensions?: RoomDimensions
): PlacementRecommendation {
  const baseRec = generatePlacementRecommendation(issue);
  const frequency = extractFrequency(issue.issue);

  if (roomDimensions) {
    // Use 38% rule for optimal position
    const optimalDistance = roomDimensions.length * 0.38;

    baseRec.action = `Move listening position to ~38% of room length (approximately ${optimalDistance.toFixed(1)} ft from front wall)`;
    baseRec.reason = `38% rule minimizes modal excitation - avoids common null zones at 1/4, 1/2, and 3/4 room length. ${frequency ? `Current issue at ${frequency} Hz` : 'Room mode issue'} suggests suboptimal positioning.`;
    baseRec.expected_improvement = 'May reduce modal issues by 3-6 dB through optimal positioning';
    baseRec.confidence = 'medium';
  } else {
    // Generic guidance without dimensions
    if (issue.issue.toLowerCase().includes('null')) {
      baseRec.action = 'Try moving listening position forward or backward to avoid modal null zone';
      baseRec.reason = `Modal nulls occur at specific positions in the room - repositioning can significantly reduce null depth`;
    } else {
      baseRec.action = 'Adjust listening position to optimize modal response';
      baseRec.reason = 'Room dimensions unknown - try 38% rule (38% of room length from front wall) as starting point';
    }
    baseRec.confidence = 'low';
  }

  return {
    ...baseRec,
    element: 'listening_position'
  };
}
