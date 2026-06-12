import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * InteractiveSelector - 交互式选择器组件
 *
 *
 */
import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';
/**
 *
 */
export function InteractiveSelector({ title, options, onSelect, onCancel, initialIndex = 0, focusId = FocusId.SELECTOR, }) {
    const theme = themeManager.getTheme();
    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    // Fire-once guard: prevents Enter key-repeat from calling onSelect multiple times.
    // Ink's useInput listener stays registered until the component unmounts, but
    // React may not re-render (and unmount) until after several key events have
    // already queued. Resetting on options change handles re-use of the same component.
    const selectFiredRef = useRef(false);
    useEffect(() => { selectFiredRef.current = false; }, [options]);
    // 处理键盘输
    useInput((input, key) => {
        // Imperative focus check — avoids stale React closure
        if (focusManager.getCurrentFocus() !== focusId)
            return;
        if (key.upArrow || input === 'k') {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        }
        else if (key.downArrow || input === 'j') {
            setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
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
    // 当 options 变化时重置索
    useEffect(() => {
        if (selectedIndex >= options.length) {
            setSelectedIndex(0);
        }
    }, [options.length, selectedIndex]);
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.colors.primary, paddingX: 2, paddingY: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: theme.colors.primary, children: title }) }), _jsx(Box, { flexDirection: "column", children: options.map((option, index) => {
                    const isSelected = index === selectedIndex;
                    const indicator = isSelected ? '▸ ' : '  ';
                    const currentMarker = option.isCurrent ? ' ✓' : '';
                    return (_jsxs(Box, { flexDirection: "row", children: [_jsxs(Text, { color: isSelected ? theme.colors.primary : theme.colors.text.primary, bold: isSelected, children: [indicator, option.label, currentMarker] }), option.description && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [' - ', option.description] }))] }, String(option.value)));
                }) }), _jsx(Box, { marginTop: 1, borderStyle: "single", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, borderColor: theme.colors.border.light, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "\u2191/\u2193 navigate  Enter confirm  Esc cancel" }) })] }));
}
export default InteractiveSelector;
//# sourceMappingURL=InteractiveSelector.js.map