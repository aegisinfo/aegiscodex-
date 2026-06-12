import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * CommandSuggestions - Dropdown autocomplete for slash commands
 *
 * Shows fuzzy-matched command suggestions when user types "/..."
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { getCommandCompletions } from '../../../slash-commands/index.js';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';
const MAX_SUGGESTIONS = 8;
export const CommandSuggestions = ({ input, cursorPosition, onSelectSuggestion, visible, }) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const theme = themeManager.getTheme();
    // Reset selection when suggestions change
    const lastInputRef = useRef(input);
    useEffect(() => {
        if (lastInputRef.current !== input) {
            setSelectedIndex(0);
            lastInputRef.current = input;
        }
    }, [input]);
    const suggestions = useMemo(() => {
        if (!visible || !input.startsWith('/'))
            return [];
        // Only suggest based on what's typed after / up to cursor
        const partial = input.slice(0, cursorPosition);
        const results = getCommandCompletions(partial);
        // Sort by matchScore descending
        results.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
        return results.slice(0, MAX_SUGGESTIONS);
    }, [input, cursorPosition, visible]);
    // Clamp selected index
    const clampedIndex = Math.min(selectedIndex, Math.max(0, suggestions.length - 1));
    // Tab key: cycle through suggestions
    useInput((_, key) => {
        if (!visible || suggestions.length === 0)
            return;
        if (focusManager.getCurrentFocus() !== FocusId.MAIN_INPUT)
            return;
        if (key.tab && !key.shift) {
            // Select next suggestion (cycle)
            const next = (clampedIndex + 1) % suggestions.length;
            setSelectedIndex(next);
            return;
        }
        if (key.tab && key.shift) {
            // Select previous suggestion
            const prev = clampedIndex <= 0 ? suggestions.length - 1 : clampedIndex - 1;
            setSelectedIndex(prev);
            return;
        }
        // Enter on a suggestion: select it
        if (key.return && suggestions.length > 0) {
            const selected = suggestions[clampedIndex];
            if (selected) {
                // Replace the command part of the input
                const beforeCursor = input.slice(0, cursorPosition);
                const afterCursor = input.slice(cursorPosition);
                const slashIdx = beforeCursor.lastIndexOf('/');
                if (slashIdx !== -1) {
                    const newBefore = beforeCursor.slice(0, slashIdx);
                    const completed = `${newBefore}${selected.command} `;
                    onSelectSuggestion(completed + afterCursor);
                }
            }
        }
    }, { isActive: visible && suggestions.length > 0 });
    if (!visible || suggestions.length === 0)
        return null;
    return (_jsxs(Box, { flexDirection: "column", marginLeft: 1, marginBottom: 0, borderStyle: "round", borderColor: theme.colors.border.light, paddingX: 1, paddingY: 0, children: [_jsxs(Text, { dimColor: true, children: ["Commands (", suggestions.length, "):"] }), suggestions.map((s, i) => {
                const isSelected = i === clampedIndex;
                const scoreColor = (s.matchScore ?? 0) >= 90
                    ? theme.colors.success
                    : (s.matchScore ?? 0) >= 60
                        ? theme.colors.warning
                        : theme.colors.text.muted;
                return (_jsx(Box, { flexDirection: "row", children: _jsxs(Text, { children: [isSelected ? (_jsx(Text, { color: theme.colors.primary, bold: true, children: '>' })) : (_jsx(Text, { children: " " })), ' ', _jsx(Text, { color: isSelected ? theme.colors.primary : undefined, bold: isSelected, children: s.command }), _jsxs(Text, { color: theme.colors.text.muted, children: [" \u2014 ", s.description] }), _jsxs(Text, { color: scoreColor, children: [" (", s.matchScore ?? 0, ")"] })] }) }, s.command));
            }), _jsx(Text, { dimColor: true, children: "Tab/Shift+Tab to navigate \u00B7 Enter to select" })] }));
};
export default CommandSuggestions;
//# sourceMappingURL=CommandSuggestions.js.map