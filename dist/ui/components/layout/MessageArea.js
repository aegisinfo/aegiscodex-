import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { useTerminalWidth } from '../../hooks/index.js';
import { themeManager } from '../../themes/index.js';
/**
 *
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
}
/**
 *
 */
export const MessageArea = ({ messages, maxMessages = 50, showTimestamp = false, }) => {
    const terminalWidth = useTerminalWidth();
    const theme = themeManager.getTheme();
    // 限制显示的消息数
    const displayMessages = messages.slice(-maxMessages);
    if (displayMessages.length === 0) {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "No messages yet. Start a conversation!" }) }));
    }
    return (_jsx(Box, { flexDirection: "column", paddingX: 1, children: displayMessages.map((message, index) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [showTimestamp && message.timestamp && (_jsx(Box, { marginBottom: 0, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: formatTimestamp(message.timestamp) }) })), _jsx(MessageRenderer, { content: message.content, role: message.role, terminalWidth: terminalWidth - 2, showPrefix: true })] }, index))) }));
};
export default MessageArea;
//# sourceMappingURL=MessageArea.js.map