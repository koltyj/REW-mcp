/**
 * Unit tests for recommendation generation
 *
 * Tests physics-based recommendations for all element types:
 * - generatePlacementRecommendation (SBIR, room modes, peaks, nulls)
 * - generateSubRecommendation (phase, boundary, crossover context)
 * - generateListeningPositionRecommendation (38% rule, dimensions)
 * - determineElement (category-based routing)
 */

import { describe, it, expect } from 'vitest';
import {
  generatePlacementRecommendation,
  generateSubRecommendation,
  generateListeningPositionRecommendation,
  determineElement
} from './recommendations.js';
import type { PrioritizedIssue } from '../interpretation/types.js';
import type { RoomDimensions } from '../types/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockIssue(
  category: string,
  issue: string,
  severity: 'significant' | 'moderate' | 'minor' | 'negligible' = 'moderate'
): PrioritizedIssue {
  return {
    issue,
    severity,
    fixability: 'placement',
    category,
    priority_score: 80
  };
}

// ============================================================================
// generatePlacementRecommendation Tests
// ============================================================================

describe('generatePlacementRecommendation', () => {
  it('should return high confidence for SBIR with Q>10', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 125 Hz (Q: 12)', 'significant');
    const result = generatePlacementRecommendation(issue);

    expect(result.confidence).toBe('high');
    expect(result.element).toBe('monitors');
  });

  it('should return medium confidence for SBIR with Q=6', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 125 Hz (Q: 6)', 'moderate');
    const result = generatePlacementRecommendation(issue);

    expect(result.confidence).toBe('medium');
  });

  it('should calculate quarter-wavelength distance for SBIR', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 125 Hz (Q: 8)', 'significant');
    const result = generatePlacementRecommendation(issue);

    // 1125 / (4 * 125) = 2.25 ft (rounds to 2.3)
    expect(result.action).toContain('2.3');
    expect(result.action).toContain('125 Hz');
    expect(result.reason).toContain('quarter-wavelength');
  });

  it('should include physics context in reason field for SBIR', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 100 Hz (Q: 10)', 'significant');
    const result = generatePlacementRecommendation(issue);

    expect(result.reason).toContain('quarter-wavelength');
    expect(result.reason).toContain('cancellation');
    expect(result.reason).toContain('reflected wave');
  });

  it('should include expected improvement estimate for SBIR', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 125 Hz (Q: 10)', 'significant');
    const result = generatePlacementRecommendation(issue);

    expect(result.expected_improvement).toContain('3-10 dB');
    expect(result.expected_improvement.toLowerCase()).toContain('null');
    expect(result.expected_improvement.toLowerCase()).toContain('repositioning');
  });

  it('should recommend subwoofer for room mode <80Hz', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 63 Hz', 'moderate');
    const result = generatePlacementRecommendation(issue);

    expect(result.element).toBe('subwoofer');
    expect(result.action).toContain('subwoofer');
    expect(result.reason).toContain('63 Hz');
  });

  it('should recommend listening position for room mode >80Hz', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 125 Hz', 'moderate');
    const result = generatePlacementRecommendation(issue);

    expect(result.element).toBe('listening_position');
    expect(result.action).toContain('listening position');
    expect(result.reason).toContain('standing wave');
  });

  it('should recommend repositioning for null (not EQ)', () => {
    const issue = createMockIssue('null', 'Null at 100 Hz (-8 dB)', 'significant');
    const result = generatePlacementRecommendation(issue);

    expect(result.action.toLowerCase()).toContain('reposition');
    expect(result.reason.toLowerCase()).toContain('cannot be boosted');
    expect(result.reason.toLowerCase()).toContain('eq');
  });

  it('should provide boundary distance guidance for peak', () => {
    const issue = createMockIssue('peak', 'Peak at 80 Hz (+6 dB)', 'moderate');
    const result = generatePlacementRecommendation(issue);

    expect(result.action).toContain('boundary');
    expect(result.reason).toContain('boundary gain');
    expect(result.expected_improvement).toContain('3-6 dB');
  });

  it('should extract frequency from issue text', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 250 Hz (Q: 8)', 'moderate');
    const result = generatePlacementRecommendation(issue);

    expect(result.issue_frequency_hz).toBe(250);
    expect(result.action).toContain('250 Hz');
  });

  it('should handle issue without frequency', () => {
    const issue = createMockIssue('generic', 'Generic acoustic issue', 'moderate');
    const result = generatePlacementRecommendation(issue);

    expect(result.issue_frequency_hz).toBe(0);
    expect(result.action).toBeTruthy();
  });
});

// ============================================================================
// generateSubRecommendation Tests
// ============================================================================

describe('generateSubRecommendation', () => {
  it('should include phase suggestion when phase inversion detected', () => {
    const issue = createMockIssue('sub_integration', 'Phase inversion (180° difference)', 'significant');
    const phaseInfo = {
      is_inverted: true,
      phase_difference_deg: 175,
      expected_improvement_db: 6
    };

    const result = generateSubRecommendation(issue, phaseInfo);

    expect(result.phase_suggestion).toBeTruthy();
    expect(result.phase_suggestion).toContain('phase flip');
    expect(result.phase_suggestion).toContain('175');
    expect(result.phase_suggestion).toContain('6');
  });

  it('should include boundary loading context', () => {
    const issue = createMockIssue('sub_integration', 'Sub integration issue', 'moderate');
    const result = generateSubRecommendation(issue);

    expect(result.boundary_loading).toBeTruthy();
    expect(result.boundary_loading).toContain('+3 dB per boundary');
    expect(result.boundary_loading).toContain('corner');
    expect(result.boundary_loading).toContain('+9 dB');
  });

  it('should include crossover context for issue near 80Hz', () => {
    const issue = createMockIssue('sub_integration', 'Crossover dip at 80 Hz', 'moderate');
    const result = generateSubRecommendation(issue);

    expect(result.crossover_context).toBeTruthy();
    expect(result.crossover_context).toContain('80 Hz');
    expect(result.crossover_context).toContain('crossover');
  });

  it('should include crossover context for issue at 70Hz', () => {
    const issue = createMockIssue('sub_integration', 'Issue at 70 Hz', 'moderate');
    const result = generateSubRecommendation(issue);

    expect(result.crossover_context).toBeTruthy();
    expect(result.crossover_context).toContain('70 Hz');
  });

  it('should omit crossover context for issue at 50Hz', () => {
    const issue = createMockIssue('sub_integration', 'Issue at 50 Hz', 'moderate');
    const result = generateSubRecommendation(issue);

    expect(result.crossover_context).toBeUndefined();
  });

  it('should omit crossover context for issue at 110Hz', () => {
    const issue = createMockIssue('sub_integration', 'Issue at 110 Hz', 'moderate');
    const result = generateSubRecommendation(issue);

    expect(result.crossover_context).toBeUndefined();
  });

  it('should be more detailed than generic placement recommendation', () => {
    const issue = createMockIssue('sub_integration', 'Sub issue at 80 Hz', 'moderate');
    const phaseInfo = {
      is_inverted: true,
      phase_difference_deg: 180,
      expected_improvement_db: 5
    };

    const subRec = generateSubRecommendation(issue, phaseInfo);
    const genericRec = generatePlacementRecommendation(issue);

    // Sub recommendation should have additional fields
    expect(subRec.phase_suggestion).toBeTruthy();
    expect(subRec.boundary_loading).toBeTruthy();

    // Generic recommendation should not have these
    expect((genericRec as any).phase_suggestion).toBeUndefined();
    expect((genericRec as any).boundary_loading).toBeUndefined();
  });

  it('should always set element to subwoofer', () => {
    const issue = createMockIssue('sub_integration', 'Sub issue', 'moderate');
    const result = generateSubRecommendation(issue);

    expect(result.element).toBe('subwoofer');
  });
});

// ============================================================================
// generateListeningPositionRecommendation Tests
// ============================================================================

describe('generateListeningPositionRecommendation', () => {
  const roomDimensions: RoomDimensions = {
    length: 20,
    width: 15,
    height: 9
  };

  it('should use 38% rule when dimensions provided', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 50 Hz', 'moderate');
    const result = generateListeningPositionRecommendation(issue, roomDimensions);

    // 20 * 0.38 = 7.6 ft
    expect(result.action).toContain('38%');
    expect(result.action).toContain('7.6 ft');
  });

  it('should explain 38% rule in reason when dimensions provided', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 50 Hz', 'moderate');
    const result = generateListeningPositionRecommendation(issue, roomDimensions);

    expect(result.reason).toContain('38% rule');
    expect(result.reason).toContain('1/4, 1/2, and 3/4');
    expect(result.confidence).toBe('medium');
  });

  it('should provide generic guidance without dimensions', () => {
    const issue = createMockIssue('room_modes', 'Room mode issue', 'moderate');
    const result = generateListeningPositionRecommendation(issue);

    expect(result.action).toContain('position');
    expect(result.confidence).toBe('low');
  });

  it('should suggest avoiding null zone for null issue without dimensions', () => {
    const issue = createMockIssue('null', 'Null at 50 Hz', 'significant');
    const result = generateListeningPositionRecommendation(issue);

    expect(result.action).toContain('forward or backward');
    expect(result.action).toContain('null zone');
    expect(result.reason).toContain('repositioning');
  });

  it('should always set element to listening_position', () => {
    const issue = createMockIssue('room_modes', 'Room mode issue', 'moderate');
    const result = generateListeningPositionRecommendation(issue, roomDimensions);

    expect(result.element).toBe('listening_position');
  });
});

// ============================================================================
// determineElement Tests
// ============================================================================

describe('determineElement', () => {
  it('should return monitors for SBIR category', () => {
    const issue = createMockIssue('sbir', 'SBIR null at 125 Hz', 'significant');
    const element = determineElement(issue);

    expect(element).toBe('monitors');
  });

  it('should return subwoofer for sub_integration category', () => {
    const issue = createMockIssue('sub_integration', 'Sub issue', 'moderate');
    const element = determineElement(issue);

    expect(element).toBe('subwoofer');
  });

  it('should return monitors for lr_symmetry category', () => {
    const issue = createMockIssue('lr_symmetry', 'L/R imbalance', 'moderate');
    const element = determineElement(issue);

    expect(element).toBe('monitors');
  });

  it('should return subwoofer for room_modes <80Hz', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 50 Hz', 'moderate');
    const element = determineElement(issue);

    expect(element).toBe('subwoofer');
  });

  it('should return listening_position for room_modes 80-200Hz', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 125 Hz', 'moderate');
    const element = determineElement(issue);

    expect(element).toBe('listening_position');
  });

  it('should return listening_position for room_modes >200Hz', () => {
    const issue = createMockIssue('room_modes', 'Room mode at 250 Hz', 'moderate');
    const element = determineElement(issue);

    expect(element).toBe('listening_position');
  });

  it('should return listening_position for unknown category', () => {
    const issue = createMockIssue('unknown', 'Unknown issue', 'moderate');
    const element = determineElement(issue);

    expect(element).toBe('listening_position');
  });
});
