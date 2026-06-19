import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * InteractiveSelector - 交互式选择器组件
 */
import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';
export function InteractiveSelector({ title, options, onSelect, onCancel, initialIndex = 0, focusId = FocusId.SELECTOR, maxVisible = 10, }) {
    const theme = themeManager.getTheme();
    const [selectedIndex, setSelectedIndex] = useState(() => {
        // Start at current item if one is marked
        const currentIdx = options.findIndex(o => o.isCurrent);
        return currentIdx >= 0 ? currentIdx : initialIndex;
    });
    const [scrollTop, setScrollTop] = useState(0);
    const selectFiredRef = useRef(false);
    useEffect(() => { selectFiredRef.current = false; }, [options]);
    // Keep viewport window in sync with cursor
    useEffect(() => {
        setScrollTop(prev => {
            if (selectedIndex < prev)
                return selectedIndex;
            if (selectedIndex >= prev + maxVisible)
                return selectedIndex - maxVisible + 1;
            return prev;
        });
    }, [selectedIndex, maxVisible]);
    useInput((input, key) => {
        if (focusManager.getCurrentFocus() !== focusId)
            return;
        if (key.upArrow || input === 'k') {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        }
        else if (key.downArrow || input === 'j') {
            setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        }
        else if (key.pageUp) {
            setSelectedIndex(prev => Math.max(0, prev - maxVisible));
        }
        else if (key.pageDown) {
            setSelectedIndex(prev => Math.min(options.length - 1, prev + maxVisible));
        }
        else if (key.return) {
            if (!selectFiredRef.current) {
                selectFiredRef.current = true;
                onSelect(options[selectedIndex].value);
            }
        }
        else if (key.escape || input === 'q') {
            onCancel();
        }
    });
    useEffect(() => {
        if (selectedIndex >= options.length)
            setSelectedIndex(0);
    }, [options.length, selectedIndex]);
    const visibleOptions = options.slice(scrollTop, scrollTop + maxVisible);
    const hasAbove = scrollTop > 0;
    const hasBelow = scrollTop + maxVisible < options.length;
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.colors.primary, paddingX: 2, paddingY: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "row", justifyContent: "space-between", children: [_jsx(Text, { bold: true, color: theme.colors.primary, children: title }), options.length > maxVisible && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [selectedIndex + 1, "/", options.length] }))] }), hasAbove && (_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: ["  \u2191 ", scrollTop, " more"] }) })), _jsx(Box, { flexDirection: "column", children: visibleOptions.map((option, i) => {
                    const absIndex = scrollTop + i;
                    const isSelected = absIndex === selectedIndex;
                    return (_jsxs(Box, { flexDirection: "row", children: [_jsxs(Text, { color: isSelected ? theme.colors.primary : theme.colors.text.primary, bold: isSelected, children: [isSelected ? '▸ ' : '  ', option.label, option.isCurrent ? ' ✓' : ''] }), option.description && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [' - ', option.description] }))] }, String(option.value)));
                }) }), hasBelow && (_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: ['  ↓ ', options.length - scrollTop - maxVisible, " more"] }) })), _jsx(Box, { marginTop: 1, borderStyle: "single", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, borderColor: theme.colors.border.light, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "\u2191/\u2193 navigate  PgUp/PgDn page  Enter confirm  Esc cancel" }) })] }));
}
export default InteractiveSelector;
//# sourceMappingURL=InteractiveSelector.js.map