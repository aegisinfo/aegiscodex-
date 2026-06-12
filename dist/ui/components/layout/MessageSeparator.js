import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * MessageSeparator - visual divider between messages
 */
import React from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
export const MessageSeparator = React.memo(({ isLast }) => {
    if (isLast)
        return null;
    const theme = themeManager.getTheme();
    return (_jsx(Box, { marginY: 0, children: _jsxs(Text, { color: theme.colors.border.light, dimColor: true, children: ['\u2500', '\u00B7', '\u2500'] }) }));
});
MessageSeparator.displayName = 'MessageSeparator';
export default MessageSeparator;
//# sourceMappingURL=MessageSeparator.js.map