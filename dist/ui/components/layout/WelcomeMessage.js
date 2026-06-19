import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * WelcomeMessage — ASCII art logo + available commands.
 */
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import pkg from '../../../../package.json' with { type: 'json' };
const COMMANDS = [
    { cmd: '/help', desc: 'all commands' },
    { cmd: '/model', desc: 'switch AI model' },
    { cmd: '/theme', desc: 'change appearance' },
    { cmd: '/copy', desc: 'copy code/text to clipboard' },
    { cmd: '/compact', desc: 'compress context' },
];
/** Keeps fade-in state alive across remounts (e.g. selector closing) */
const fadePlayedRef = { current: false };
const FadeInCommand = ({ cmd, desc, delayMs }) => {
    const theme = themeManager.getTheme();
    const [visible, setVisible] = useState(fadePlayedRef.current);
    useEffect(() => {
        if (fadePlayedRef.current)
            return;
        const t = setTimeout(() => {
            fadePlayedRef.current = true;
            setVisible(true);
        }, delayMs);
        return () => clearTimeout(t);
    }, [delayMs]);
    if (!visible)
        return null;
    return (_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [cmd.padEnd(12), desc] }) }));
};
export const WelcomeMessage = React.memo(({ terminalWidth }) => {
    const theme = themeManager.getTheme();
    const cmdBaseT = 80;
    const footerT = cmdBaseT + COMMANDS.length * 100 + 80;
    return (_jsxs(Box, { flexDirection: "column", paddingX: 0, paddingY: 0, marginBottom: 1, children: [_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: theme.colors.primary, bold: true, children: `
  ╔═╗╔═╗╔═╗╦╔═╗
  ╠═╣║╣ ║ ╦║╚═╗
  ╩ ╩╚═╝╚═╝╩╚═╝` }), _jsx(Box, { marginLeft: 2, children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: ["v", pkg.version] }) }), _jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { color: theme.colors.primary, bold: true, children: "\u00C6GIS  " }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "\u00B7  terminal coding agent" })] }), _jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) })] }), _jsx(Box, { flexDirection: "column", marginTop: 0, marginLeft: 2, children: COMMANDS.map(({ cmd, desc }, i) => (_jsx(FadeInCommand, { cmd: cmd, desc: desc, delayMs: cmdBaseT + i * 100 }, cmd))) }), _jsx(Box, { marginTop: 0, marginLeft: 2, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "Ctrl+Z exit  \u00B7  Ctrl+F search  \u00B7  Alt+C copy last" }) }), !process.env.CLAUDE_CODE_OAUTH_TOKEN && (_jsx(Box, { marginTop: 0, marginLeft: 2, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "Have Claude Pro/Max? Run aegis login --claude-pro to use your subscription" }) }))] }));
});
WelcomeMessage.displayName = 'WelcomeMessage';
export default WelcomeMessage;
//# sourceMappingURL=WelcomeMessage.js.map