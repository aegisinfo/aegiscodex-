import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ChatStatusBar - 聊天状态栏组件
 *
 *
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useShallow } from 'zustand/react/shallow';
import { themeManager } from '../../themes/index.js';
import { useClawdStore, } from '../../../store/index.js';
/**
 *
 */
function formatTokens(count) {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
}
/**
 *
 */
export const ChatStatusBar = React.memo(({ model, isVisible = true, }) => {
    const theme = themeManager.getTheme();
    const displayModel = model;
    // Single store subscription with shallow comparison — avoids cascading
    // re-renders when unrelated store slices change (e.g. isThinking during streaming).
    // The 4 individual selectors were causing 4 separate subscriptions.
    const { sessionId, tokenUsage, messageCount, queuedCommands } = useClawdStore(useShallow((state) => ({
        sessionId: state.session.sessionId,
        tokenUsage: state.session.tokenUsage,
        messageCount: state.session.messages.length,
        queuedCommands: state.command.pendingCommands.length,
    })));
    if (!isVisible) {
        return null;
    }
    // 构建状态项（使用简洁的文字标
    const segments = [];
    // Model - 核心信息，高亮显
    if (displayModel) {
        segments.push({
            content: (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.text.muted, children: "model:" }), _jsx(Text, { color: theme.colors.primary, bold: true, children: displayModel.length > 24 ? displayModel.slice(0, 24) + '…' : displayModel })] })),
        });
    }
    // Messages count
    if (messageCount !== undefined) {
        segments.push({
            content: (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.text.muted, children: "msgs:" }), _jsx(Text, { color: theme.colors.text.secondary, children: messageCount })] })),
        });
    }
    // Queue (only if > 0)
    if (queuedCommands > 0) {
        segments.push({
            content: (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.text.muted, children: "queue:" }), _jsx(Text, { color: theme.colors.warning, children: queuedCommands })] })),
        });
    }
    // Tokens - input/output format
    if (tokenUsage && (tokenUsage.inputTokens + tokenUsage.outputTokens) > 0) {
        segments.push({
            content: (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.text.muted, children: "tokens:" }), _jsxs(Text, { color: theme.colors.info, children: [formatTokens(tokenUsage.inputTokens), "/", formatTokens(tokenUsage.outputTokens)] })] })),
        });
    }
    // Session ID
    if (sessionId) {
        segments.push({
            content: (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.text.muted, children: "sid:" }), _jsx(Text, { color: theme.colors.info, dimColor: true, children: sessionId.slice(0, 8) })] })),
        });
    }
    if (segments.length === 0) {
        return null;
    }
    return (_jsxs(Box, { flexDirection: "row", justifyContent: "flex-start", paddingX: 0, marginTop: 0, children: [_jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "\u2500 " }), segments.map((seg, index) => (_jsxs(React.Fragment, { children: [index > 0 && (_jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: " \u00B7 " })), _jsx(Text, { dimColor: seg.dimmed, children: seg.content })] }, index))), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: " \u2500" })] }));
});
ChatStatusBar.displayName = 'ChatStatusBar';
export default ChatStatusBar;
//# sourceMappingURL=ChatStatusBar.js.map