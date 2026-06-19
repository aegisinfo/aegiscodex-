import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';
const SUGGESTIONS = [
    { label: 'Explain codebase', text: 'Explain this codebase — what does it do and how is it structured?' },
    { label: 'Fix a bug', text: 'Find and fix the bug: ' },
    { label: 'Write tests', text: 'Write tests for ' },
    { label: 'Refactor', text: 'Refactor this to be cleaner and more maintainable: ' },
    { label: 'Review changes', text: 'Review my recent git changes and flag any issues' },
    { label: 'Add feature', text: 'Implement a new feature: ' },
];
export const PromptSuggestions = ({ onSelect, visible }) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const theme = themeManager.getTheme();
    useInput((_, key) => {
        if (!visible)
            return;
        if (focusManager.getCurrentFocus() !== FocusId.MAIN_INPUT)
            return;
        if (key.tab && !key.shift) {
            setSelectedIndex(i => (i + 1) % SUGGESTIONS.length);
            return;
        }
        if (key.tab && key.shift) {
            setSelectedIndex(i => (i <= 0 ? SUGGESTIONS.length - 1 : i - 1));
            return;
        }
        if (key.return) {
            onSelect(SUGGESTIONS[selectedIndex].text);
        }
    }, { isActive: visible });
    if (!visible)
        return null;
    return (_jsx(Box, { flexDirection: "row", paddingX: 2, marginTop: 0, flexWrap: "wrap", children: SUGGESTIONS.map((s, i) => {
            const isSelected = i === selectedIndex;
            return (_jsx(Box, { marginRight: 2, children: _jsxs(Text, { color: isSelected ? theme.colors.primary : theme.colors.text.muted, bold: isSelected, dimColor: !isSelected, children: [isSelected ? '▸ ' : '  ', s.label] }) }, s.label));
        }) }));
};
export default PromptSuggestions;
//# sourceMappingURL=PromptSuggestions.js.map