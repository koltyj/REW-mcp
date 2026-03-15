/**
 * EventLog component — bottom log panel.
 *
 * Displays the most recent events with timestamps,
 * color-coded event types, and summary text.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../hooks/use-tui-state.js';

export interface EventLogProps {
  entries: LogEntry[];
  maxVisible?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  workflow: 'blue',
  health: 'green',
  analysis: 'magenta',
  calibration: 'cyan',
  optimization: 'yellow',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function categoryOf(type: string): string {
  const colon = type.indexOf(':');
  return colon > 0 ? type.slice(0, colon) : type;
}

export function EventLog({ entries, maxVisible = 5 }: EventLogProps): React.ReactElement {
  const visible = entries.slice(0, maxVisible);

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold underline>
        Event Log
      </Text>
      {visible.length === 0 ? (
        <Text dimColor>No events yet.</Text>
      ) : (
        visible.map((entry, i) => {
          const cat = categoryOf(entry.type);
          const color = CATEGORY_COLORS[cat] ?? 'white';
          return (
            <Box key={i} gap={1}>
              <Text dimColor>{formatTime(entry.timestamp)}</Text>
              <Text color={color} bold>
                {entry.type}
              </Text>
              <Text>{entry.summary}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
