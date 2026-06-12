/**
 * ErrorBoundary - React 错误边界组件
 *
 *
 *
 */
import React from 'react';
interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
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