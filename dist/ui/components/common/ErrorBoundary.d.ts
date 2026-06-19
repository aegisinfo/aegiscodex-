/**
 * ErrorBoundary - React 错误边界组件
 *
 * Enhanced with region name for logging and optional fallback render prop.
 */
import React from 'react';
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
export declare class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props);
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
    render(): React.ReactNode;
}
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.d.ts.map