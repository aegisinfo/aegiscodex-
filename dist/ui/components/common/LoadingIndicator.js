import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * LoadingIndicator - 加载指示器组件
 */
import React from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
/**
 *
 */
export const LoadingIndicator = React.memo(({ isVisible = true, text = 'Thinking...', details, }) => {
    const theme = themeManager.getTheme();
    if (!isVisible) {
        return null;
    }
    return (_jsx(Box, { flexDirection: "row", paddingX: 1, marginY: 1, children: _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: theme.colors.warning, children: text }), details && (_jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: details }))] }) }));
});
LoadingIndicator.displayName = 'LoadingIndicator';
export default LoadingIndicator;
//# sourceMappingURL=LoadingIndicator.js.map