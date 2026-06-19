import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ExitMessage - visar session-info och synkar till aegiscloud.org vid exit
 */
import { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { themeManager } from '../../themes/index.js';
import { getState } from '../../../store/index.js';
export const ExitMessage = ({ sessionId, exitDelay = 800, }) => {
    const { exit } = useApp();
    const theme = themeManager.getTheme();
    const [syncStatus, setSyncStatus] = useState('syncing');
    useEffect(() => {
        const doExit = async () => {
            const { appendToLocalMemory, syncConversation } = await import('../../../services/CloudSync.js');
            const { sharedMemory } = await import('../../../memory/SharedMemory.js');
            const storeMessages = getState().session.messages;
            if (storeMessages?.length > 0) {
                const messages = storeMessages.map((m) => ({
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                }));
                // Local memory + episodic summary
                await appendToLocalMemory(sessionId, messages).catch(() => { });
                let model;
                try {
                    const fs = await import('fs');
                    const path = await import('path');
                    const os = await import('os');
                    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.aegiscode', 'config.json'), 'utf8'));
                    model = cfg?.default?.model || cfg?.models?.find((m) => m.id === cfg.currentModelId)?.model;
                    if (sharedMemory.isEnabled()) {
                        const apiKey = cfg?.default?.apiKey || cfg?.models?.find((m) => m.id === cfg.currentModelId)?.apiKey;
                        const baseURL = cfg?.default?.baseURL || cfg?.models?.find((m) => m.id === cfg.currentModelId)?.baseURL;
                        await sharedMemory.summarizeAndStoreSession(sessionId, apiKey, baseURL, model);
                    }
                }
                catch { }
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const result = await syncConversation(sessionId, messages, model);
                        if (result.reason === 'uploaded') {
                            setSyncStatus('done');
                            break;
                        }
                        else if (result.reason === 'error' && attempt < 2) {
                            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                            continue;
                        }
                        else {
                            setSyncStatus(result.reason === 'error' ? 'error' : 'skip');
                            break;
                        }
                    }
                    catch {
                        if (attempt < 2) {
                            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                            continue;
                        }
                        setSyncStatus('error');
                    }
                }
            }
            else {
                setSyncStatus('skip');
            }
            setTimeout(() => { exit(); setTimeout(() => process.exit(0), 50); }, 300);
        };
        doExit();
    }, [exit, sessionId]);
    const shortId = sessionId.length > 16
        ? `${sessionId.slice(0, 8)}..${sessionId.slice(-6)}`
        : sessionId;
    return (_jsxs(Box, { flexDirection: "column", paddingY: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: theme.colors.text.muted, children: "\u2500 " }), _jsx(Text, { color: theme.colors.warning, children: "session saved" }), _jsx(Text, { color: theme.colors.text.muted, children: " [" }), _jsx(Text, { color: theme.colors.info, children: shortId }), _jsx(Text, { color: theme.colors.text.muted, children: "]" }), syncStatus === 'syncing' && (_jsx(Text, { color: theme.colors.text.muted, children: " \u00B7 syncing\u2026" })), syncStatus === 'done' && (_jsx(Text, { color: theme.colors.success, children: " \u00B7 synced \u2191" })), syncStatus === 'error' && (_jsx(Text, { color: theme.colors.warning, children: " \u00B7 sync failed" })), syncStatus === 'skip' && (_jsx(Text, { color: theme.colors.text.muted, children: " \u00B7 local only" }))] }), _jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsx(Text, { color: theme.colors.text.muted, children: "resume: " }), _jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: theme.colors.success, children: "aegis --continue" }) }), _jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { color: theme.colors.success, children: "aegis --resume " }), _jsx(Text, { color: theme.colors.info, children: sessionId })] })] })] }));
};
export default ExitMessage;
//# sourceMappingURL=ExitMessage.js.map