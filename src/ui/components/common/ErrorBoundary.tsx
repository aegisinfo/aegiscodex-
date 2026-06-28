/**
 * ErrorBoundary - React 错误边界组件
 *
 * Enhanced with region name for logging and optional fallback render prop.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Region name for debug logging (e.g. 'MessageList', 'ThinkingPanel') */
  name?: string;
  /** Called when an error is caught, for telemetry */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
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
    const region = this.props.name || 'unknown';
    console.error(`[ErrorBoundary:${region}] Caught error:`, error);
    console.error(`[ErrorBoundary:${region}] Component stack:`, errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const region = this.props.name || 'application';

      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>
            ❌ {region} Error
          </Text>
          <Box marginTop={1}>
            <Text color="yellow">
              An unexpected error occurred in {region}. Please restart the application.
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
