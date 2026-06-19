import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ChatStatusBar — Claude Code style minimal status bar
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useShallow } from 'zustand/react/shallow';
import { themeManager } from '../../themes/index.js';
import { useClawdStore } from '../../../store/index.js';
function formatTokens(count) {
    if (count >= 1000000)
        return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000)
        return `${(count / 1000).toFixed(1)}k`;
    return String(count);
}
export const ChatStatusBar = React.memo(({ model, modelIsAuto = false, isVisible = true, isScrolledUp = false, renderLatency = 0, routerEnabled = false, onToggleRouter, }) => {
    const theme = themeManager.getTheme();
    const displayModel = model;
    const { messageCount, queuedCommands } = useClawdStore(useShallow((state) => ({
        messageCount: state.session.messages.length,
        queuedCommands: state.command.pendingCommands.length,
    })));
    if (!isVisible)
        return null;
    const items = [];
    if (displayModel) {
        const truncated = displayModel.length > 24 ? displayModel.slice(0, 24) + '…' : displayModel;
        items.push(modelIsAuto ? `${truncated} (auto)` : truncated);
    }
    if (renderLatency > 50) {
        items.push(`lag: ${renderLatency}ms`);
    }
    if (messageCount !== undefined) {
        items.push(`${messageCount} msgs`);
    }
    if (isScrolledUp) {
        items.push('↑ scrolled');
    }
    if (queuedCommands > 0) {
        items.push(`queue: ${queuedCommands}`);
    }
    if (items.length === 0)
        return null;
    return (_jsx(Box, { flexDirection: "row", paddingX: 0, marginTop: 0, children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [items.join(' · '), _jsx(Text, { children: " \u00B7 " }), _jsxs(Text, { color: routerEnabled ? theme.colors.success : theme.colors.text.muted, bold: routerEnabled, children: ["R:", routerEnabled ? 'ON' : 'OFF'] }), _jsx(Text, { dimColor: true, children: " alt+r" })] }) }));
});
ChatStatusBar.displayName = 'ChatStatusBar';
export default ChatStatusBar;
//# sourceMappingURL=ChatStatusBar.js.map