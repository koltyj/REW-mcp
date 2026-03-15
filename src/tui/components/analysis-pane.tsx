/**
 * AnalysisPane component — right pane.
 *
 * Shows overall severity, top recommendations with fixability tags,
 * decay summary, and optimization zone with should_stop indicator.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Severity } from '../../events/types.js';
import type {
  AnalysisRoomCompletePayload,
  AnalysisDecayCompletePayload,
  OptimizationRecommendationPayload,
  OptimizationProgressPayload,
} from '../../events/types.js';

export interface AnalysisPaneProps {
  roomAnalysis: AnalysisRoomCompletePayload | null;
  decayAnalysis: AnalysisDecayCompletePayload | null;
  recommendation: OptimizationRecommendationPayload | null;
  progress: OptimizationProgressPayload | null;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  significant: 'red',
  moderate: 'yellow',
  minor: 'cyan',
  negligible: 'green',
};

const FIXABILITY_COLORS: Record<string, string> = {
  placement: 'green',
  settings: 'cyan',
  treatment: 'yellow',
  unfixable: 'red',
};

const ZONE_COLORS: Record<string, string> = {
  good: 'green',
  acceptable: 'yellow',
  needs_work: 'red',
};

export function AnalysisPane({
  roomAnalysis,
  decayAnalysis,
  recommendation,
  progress,
}: AnalysisPaneProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} width="50%">
      <Text bold underline>
        Analysis
      </Text>

      {/* Overall severity */}
      {roomAnalysis ? (
        <Box flexDirection="column" marginTop={1}>
          <Box gap={1}>
            <Text dimColor>Severity:</Text>
            <Text color={SEVERITY_COLORS[roomAnalysis.overall_severity]} bold>
              {roomAnalysis.overall_severity.toUpperCase()}
            </Text>
          </Box>
          <Text>{roomAnalysis.overall_summary}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>No room analysis yet.</Text>
        </Box>
      )}

      {/* Top 3 recommendations */}
      {roomAnalysis && roomAnalysis.top_recommendations.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor>
            Top Recommendations
          </Text>
          {roomAnalysis.top_recommendations.slice(0, 3).map((rec, i) => (
            <Box key={i} gap={1}>
              <Text>{i + 1}.</Text>
              <Text>{rec.action}</Text>
              <Text color={FIXABILITY_COLORS[rec.fixability] ?? 'white'}>
                [{rec.fixability}]
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Decay summary */}
      {decayAnalysis && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor>
            Decay Summary
          </Text>
          {decayAnalysis.frequency_band_summary.map((band, i) => (
            <Box key={i} gap={1}>
              <Text dimColor>{band.band}:</Text>
              <Text>
                T60={band.avg_t60_seconds.toFixed(2)}s (target {band.target_t60_seconds.toFixed(2)}s)
              </Text>
            </Box>
          ))}
          {decayAnalysis.problematic_frequencies.length > 0 && (
            <Text color="yellow">
              {decayAnalysis.problematic_frequencies.length} problematic freq(s)
            </Text>
          )}
        </Box>
      )}

      {/* Current recommendation */}
      {recommendation && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor>
            Current Recommendation
          </Text>
          <Text>
            <Text bold>{recommendation.element}:</Text> {recommendation.action}
          </Text>
          <Text dimColor>{recommendation.reason}</Text>
        </Box>
      )}

      {/* Optimization progress */}
      {progress && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor>
            Optimization
          </Text>
          <Box gap={1}>
            <Text dimColor>Zone:</Text>
            <Text color={ZONE_COLORS[progress.overall_zone] ?? 'white'} bold>
              {progress.overall_zone.toUpperCase()}
            </Text>
            {progress.should_stop && (
              <Text color="green" bold>
                STOP
              </Text>
            )}
          </Box>
          <Text>{progress.progress_summary}</Text>
        </Box>
      )}
    </Box>
  );
}
