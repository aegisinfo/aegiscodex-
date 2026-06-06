/**
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { themeManager } from '../../themes/index.js';

interface LoadingIndicatorProps {
  
  isVisible?: boolean;
  
  text?: string;
  
  details?: string;
}

/**
 * 
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = React.memo(({
  isVisible = true,
  text = 'Thinking...',
  details,
}) => {
  const theme = themeManager.getTheme();

  if (!isVisible) {
    return null;
  }

  return (
    <Box flexDirection="row" paddingX={1} marginY={1}>
      <Box marginRight={1}>
        <Text color={theme.colors.warning}>
          <Spinner type="dots" />
        </Text>
      </Box>
      <Box flexDirection="column">
        <Text color={theme.colors.warning}>{text}</Text>
        {details && (
          <Text color={theme.colors.text.muted} dimColor>
            {details}
          </Text>
        )}
      </Box>
    </Box>
  );
});

LoadingIndicator.displayName = 'LoadingIndicator';

export default LoadingIndicator;
