import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ErrorBoundary - React 错误边界组件
 *
 *
 *
 */
import React from 'react';
import { Box, Text } from 'ink';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        // 更新 state 以便下次渲染显示备
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        // 可以在这里记录错误到日志服
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
    render() {
        if (this.state.hasError) {
            // 如果提供了自定义 fallback，使用
            if (this.props.fallback) {
                return this.props.fallback;
            }
            // 默认错
            return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { color: "red", bold: true, children: "\u274C Application Error" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "yellow", children: "An unexpected error occurred. Please restart the application." }) }), this.state.error && (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Error: ", this.state.error.message] }), this.state.error.stack && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: this.state.error.stack.split('\n').slice(0, 5).join('\n') }) }))] })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Press Ctrl+C to exit" }) })] }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.js.map