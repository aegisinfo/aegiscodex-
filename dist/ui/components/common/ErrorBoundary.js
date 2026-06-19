import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * ErrorBoundary - React 错误边界组件
 *
 * Enhanced with region name for logging and optional fallback render prop.
 */
import React from 'react';
import { Box, Text } from 'ink';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        const region = this.props.name || 'unknown';
        console.error(`[ErrorBoundary:${region}] Caught error:`, error);
        console.error(`[ErrorBoundary:${region}] Component stack:`, errorInfo.componentStack);
        this.props.onError?.(error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            const region = this.props.name || 'application';
            return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Text, { color: "red", bold: true, children: ["\u274C ", region, " Error"] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "yellow", children: ["An unexpected error occurred in ", region, ". Please restart the application."] }) }), this.state.error && (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Error: ", this.state.error.message] }), this.state.error.stack && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: this.state.error.stack.split('\n').slice(0, 5).join('\n') }) }))] })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Press Ctrl+C to exit" }) })] }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.js.map