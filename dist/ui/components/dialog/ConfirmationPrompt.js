import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ConfirmationPrompt - 权限确认组件
 *
 *
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { FocusId, useIsFocused } from '../../focus/index.js';
export const ConfirmationPrompt = ({ details, onResponse, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const theme = themeManager.getTheme();
    const isFocused = useIsFocused(FocusId.CONFIRMATION_PROMPT);
    const options = [
        { key: 'y', label: 'allow', scope: 'once', approved: true },
        { key: 'a', label: 'always', scope: 'session', approved: true },
        { key: 'n', label: 'deny', scope: 'once', approved: false },
    ];
    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        }
        else if (key.downArrow) {
            setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        }
        else if (key.return) {
            const sel = options[selectedIndex];
            onResponse({ approved: sel.approved, scope: sel.scope });
        }
        else if (input === 'y' || input === 'Y') {
            onResponse({ approved: true, scope: 'once' });
        }
        else if (input === 'a' || input === 'A') {
            onResponse({ approved: true, scope: 'session' });
        }
        else if (input === 'n' || input === 'N') {
            onResponse({ approved: false, reason: 'denied' });
        }
    }, { isActive: isFocused });
    // Extract tool name from title (e.g. "Permission Required: Bash" -> "Bash")
    const toolName = details.title.replace(/^.*:\s*/, '');
    // Skip showing the tool name header for tools where the label+highlight is self-explanatory
    const hideHeader = ['Bash', 'Shell'].includes(toolName) && details.details?.includes('**Command:**');
    // Extract the primary content to highlight (command, file path, etc.)
    const { label, highlight, extra } = extractHighlight(details.details);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [!hideHeader && (_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.warning, bold: true, children: "? " }), _jsx(Text, { bold: true, children: toolName }), details.message && details.message !== details.title && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [" \u00B7 ", details.message] }))] })), hideHeader && highlight && (_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.warning, bold: true, children: "? " }), label && _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [label, " "] }), _jsx(Text, { color: theme.colors.accent, wrap: "wrap", children: highlight })] })), !hideHeader && highlight && (_jsxs(Box, { marginLeft: 2, children: [label && _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [label, " "] }), _jsx(Text, { color: theme.colors.accent, wrap: "wrap", children: highlight })] })), extra.length > 0 && (_jsx(Box, { flexDirection: "column", marginLeft: 2, children: extra.map((line, i) => (_jsx(Text, { color: theme.colors.text.muted, dimColor: true, wrap: "wrap", children: line }, i))) })), details.affectedFiles && details.affectedFiles.length > 0 && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: theme.colors.info, dimColor: true, children: details.affectedFiles.join(', ') }) })), details.risks && details.risks.length > 0 && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: details.risks.join(' · ') }) })), _jsx(Box, { flexDirection: "column", marginLeft: 2, marginTop: 1, children: options.map((opt, i) => {
                    const active = i === selectedIndex;
                    return (_jsxs(Box, { children: [_jsxs(Text, { color: active ? theme.colors.success : theme.colors.text.muted, bold: active, dimColor: !active, children: [active ? '> ' : '  ', opt.label] }), _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: ["  (", opt.key, ")"] })] }, opt.key));
                }) })] }));
};
/**
 *
 *
 */
function extractHighlight(details) {
    if (!details)
        return { label: '', highlight: '', extra: [] };
    const strip = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
    const lines = details.split('\n').filter(l => l.trim());
    let label = '';
    let highlight = '';
    const extra = [];
    for (const raw of lines) {
        const line = strip(raw);
        // Primary highlight: Command / File path
        if (/^Command:\s*/.test(line)) {
            label = 'Command:';
            highlight = line.replace(/^Command:\s*/, '');
        }
        else if (/^File:\s*/.test(line)) {
            label = 'File:';
            highlight = line.replace(/^File:\s*/, '');
        }
        else if (/^(Directory|Content Preview|Before|After):\s*/.test(line)) {
            extra.push(line);
        }
        else if (line === '```' || line.startsWith('```')) {
            // skip code fences
        }
        else if (line) {
            extra.push(line);
        }
    }
    return { label, highlight, extra };
}
/**
 *
 *
 */
export function createAutoConfirmationHandler(mode = 'deny') {
    return async () => ({
        approved: mode.startsWith('approve'),
        scope: mode === 'approve_session' ? 'session' : 'once',
        reason: `Auto-${mode} by non-interactive mode`,
    });
}
export default ConfirmationPrompt;
//# sourceMappingURL=ConfirmationPrompt.js.map