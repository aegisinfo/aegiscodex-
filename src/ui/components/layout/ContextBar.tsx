/**
 * ContextBar — shows current workflow phase with step progress
 * Inspired by VSCode / Claude Code context bars
 */

import React from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import type { WorkflowState } from '../../../store/types.js';

const PHASE_COLORS: Record<string, string> = {
  building:   '#22c55e', // green
  refactoring:'#f59e0b', // amber
  debugging:  '#ef4444', // red
  testing:    '#3b82f6', // blue
  planning:   '#7c6fd4', // purple
};

function getPhaseColor(phase: string): string {
  const key = phase.toLowerCase().trim();
  for (const [k, v] of Object.entries(PHASE_COLORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return themeManager.getTheme().colors.primary;
}

interface ContextBarProps {
  workflow: WorkflowState;
}

export const ContextBar: React.FC<ContextBarProps> = React.memo(({ workflow }) => {
  const theme = themeManager.getTheme();

  if (!workflow.visible) return null;

  const phaseColor = getPhaseColor(workflow.phase);
  const indicator = `● ${workflow.phase} ${workflow.target}`;
  const progress = `${workflow.currentStepIndex}/${workflow.totalSteps}`;

  // Step indicators: ● active  ◉ done  ○ pending
  const stepIndicators = workflow.steps.map((s, i) => {
    const dot = s.status === 'active' ? '◉' : s.status === 'done' ? '●' : '○';
    const color = s.status === 'active' ? phaseColor
                : s.status === 'done' ? theme.colors.success
                : theme.colors.text.muted;
    return (
      <Text key={i} color={color}>
        {dot} {s.label}
        {i < workflow.steps.length - 1 && (
          <Text color={theme.colors.text.muted}> · </Text>
        )}
      </Text>
    );
  });

  // Separator line
  const sepColor = theme.colors.border.light;

  return (
    <Box flexDirection="column" marginTop={0} marginBottom={0}>
      <Box>
        <Text color={sepColor}>─</Text>
        <Text> </Text>
        <Text color={phaseColor} bold>{indicator}</Text>
        <Text color={theme.colors.text.muted}> · {progress}</Text>
      </Box>
      <Box marginLeft={1}>
        {stepIndicators}
      </Box>
      <Box>
        <Text color={sepColor}>─</Text>
      </Box>
    </Box>
  );
});

ContextBar.displayName = 'ContextBar';

export default ContextBar;
