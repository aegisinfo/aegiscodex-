/**
 * 
 * 
 * 
 */

import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>
            ❌ Application Error
          </Text>
          <Box marginTop={1}>
            <Text color="yellow">
              An unexpected error occurred. Please restart the application.
            </Text>
          </Box>
          {this.state.error && (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray">Error: {this.state.error.message}</Text>
              {this.state.error.stack && (
                <Box marginTop={1}>
                  <Text color="gray" dimColor>
                    {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                  </Text>
                </Box>
              )}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="cyan">Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
