import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * WelcomeMessage - animated ink-flow reveal on startup
 *
 * The ASCII logo is swept character-by-character (left→right, top→bottom)
 * with a colour gradient: dim (unwritten) → white nib → wet teal → dry primary.
 * After the sweep, content phases in sequentially.
 */
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import pkg from '../../../../package.json' with { type: 'json' };
const LOGO_LINES = [
    ' ╔═╗  ╔═╗  ╔═╗  ╦  ╔═╗',
    ' ╠═╣  ║╣   ║ ╦  ║  ╚═╗',
    ' ╩ ╩  ╚═╝  ╚═╝  ╩  ╚═╝',
];
const LINE_LENGTHS = LOGO_LINES.map(l => l.length);
const TOTAL_LOGO_CHARS = LINE_LENGTHS.reduce((s, l) => s + l, 0);
const COMMANDS = [
    { cmd: '/help', desc: 'all commands' },
    { cmd: '/model', desc: 'switch AI model' },
    { cmd: '/theme', desc: 'change appearance' },
    { cmd: '/compact', desc: 'compress context' },
];
// Colour at each character relative to the sweep nib position
function charColor(globalPos, sweepPos, primary, muted) {
    if (sweepPos < 0)
        return { color: muted, dim: true, bold: false };
    if (globalPos > sweepPos)
        return { color: muted, dim: true, bold: false }; // unwritten
    if (globalPos === sweepPos)
        return { color: '#ffffff', dim: false, bold: true }; // nib
    if (globalPos >= sweepPos - 2)
        return { color: '#7dffd9', dim: false, bold: true }; // wet ink
    return { color: primary, dim: false, bold: true }; // dry ink
}
// A single logo line rendered char-by-char so each gets its own colour
const LogoLine = React.memo(({ line, lineStart, sweepPos }) => {
    const theme = themeManager.getTheme();
    return (_jsx(Box, { flexDirection: "row", children: Array.from(line).map((ch, ci) => {
            const gp = lineStart + ci;
            const { color, dim, bold } = charColor(gp, sweepPos, theme.colors.primary, theme.colors.text.muted);
            return (_jsx(Text, { color: color, dimColor: dim, bold: bold, children: ch }, ci));
        }) }));
});
LogoLine.displayName = 'LogoLine';
// Divider that draws itself from width 0 to full
const DrawingDivider = ({ targetWidth }) => {
    const theme = themeManager.getTheme();
    const [width, setWidth] = useState(0);
    useEffect(() => {
        if (width >= targetWidth)
            return;
        const id = setInterval(() => {
            setWidth(w => {
                if (w + 3 >= targetWidth) {
                    clearInterval(id);
                    return targetWidth;
                }
                return w + 3;
            });
        }, 12);
        return () => clearInterval(id);
    }, [targetWidth]);
    return (_jsx(Box, { children: _jsx(Text, { color: theme.colors.border.light, dimColor: true, children: '─'.repeat(width) }) }));
};
// A command row that fades in (dim → normal)
const FadeInCommand = ({ cmd, desc, delayMs }) => {
    const theme = themeManager.getTheme();
    const [visible, setVisible] = useState(false);
    const [bright, setBright] = useState(false);
    useEffect(() => {
        const t1 = setTimeout(() => setVisible(true), delayMs);
        const t2 = setTimeout(() => setBright(true), delayMs + 120);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [delayMs]);
    if (!visible)
        return null;
    return (_jsxs(Box, { children: [_jsx(Text, { color: bright ? theme.colors.primary : theme.colors.text.muted, bold: bright, children: cmd.padEnd(12) }), _jsx(Text, { color: theme.colors.text.muted, dimColor: !bright, children: desc })] }));
};
// A text row that fades in after a delay
const FadeInText = ({ children, delayMs }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delayMs);
        return () => clearTimeout(t);
    }, [delayMs]);
    if (!visible)
        return null;
    return _jsx(_Fragment, { children: children });
};
export const WelcomeMessage = React.memo(({ terminalWidth }) => {
    const theme = themeManager.getTheme();
    const dividerWidth = Math.min(terminalWidth - 6, 38);
    // sweepPos: which global char index the "nib" is currently at (-1 = not started)
    const [sweepPos, setSweepPos] = useState(-1);
    // Start sweep on mount
    useEffect(() => {
        let pos = -1;
        const id = setInterval(() => {
            pos += 1;
            setSweepPos(pos);
            if (pos >= TOTAL_LOGO_CHARS + 3)
                clearInterval(id);
        }, 15);
        return () => clearInterval(id);
    }, []);
    // After sweep, content phases in via individual FadeIn components.
    // sweepEnd ≈ 15ms × (54 + 3) = ~855ms from mount.
    const sweepEndMs = (TOTAL_LOGO_CHARS + 3) * 15;
    const nameT = sweepEndMs + 80;
    const taglineT = sweepEndMs + 220;
    const dividerT = sweepEndMs + 380;
    const cmdBaseT = sweepEndMs + 540;
    const footerT = cmdBaseT + COMMANDS.length * 120 + 100;
    // Precompute line start positions
    let lineStarts = [];
    let acc = 0;
    for (const len of LINE_LENGTHS) {
        lineStarts.push(acc);
        acc += len;
    }
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 1, children: [_jsxs(Box, { children: [_jsx(Box, { flexDirection: "column", children: LOGO_LINES.map((line, i) => (_jsx(LogoLine, { line: line, lineStart: lineStarts[i], sweepPos: sweepPos }, i))) }), _jsx(FadeInText, { delayMs: nameT, children: _jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsx(Box, { height: 1 }), _jsxs(Box, { children: [_jsx(Text, { color: theme.colors.primary, bold: true, children: '□ ' }), _jsx(Text, { color: theme.colors.text.primary, bold: true, children: "aegiscode" })] }), _jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: ['  ', "v", pkg.version] }) })] }) })] }), _jsx(FadeInText, { delayMs: taglineT, children: _jsx(Box, { marginTop: 1, marginLeft: 3, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "AI-powered terminal coding agent" }) }) }), _jsx(FadeInText, { delayMs: dividerT, children: _jsx(Box, { marginTop: 1, marginBottom: 1, marginLeft: 3, children: _jsx(DrawingDivider, { targetWidth: dividerWidth }) }) }), _jsx(Box, { flexDirection: "column", marginLeft: 3, marginBottom: 1, children: COMMANDS.map(({ cmd, desc }, i) => (_jsx(FadeInCommand, { cmd: cmd, desc: desc, delayMs: cmdBaseT + i * 120 }, cmd))) }), _jsx(FadeInText, { delayMs: footerT, children: _jsx(Box, { marginLeft: 3, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "Ctrl+C exit  \u00B7  Ctrl+F search" }) }) })] }));
});
WelcomeMessage.displayName = 'WelcomeMessage';
export default WelcomeMessage;
//# sourceMappingURL=WelcomeMessage.js.map