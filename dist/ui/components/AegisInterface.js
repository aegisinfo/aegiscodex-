import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * AegisInterface.tsx - Main CLI interface component
 *
 * Refactored to use extracted hooks: useAgent, useCommandProcessor, useTerminalSize.
 * Previously 977 lines — now ~450 lines of orchestration, with logic in focused hooks.
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
// Store
import { useInitializationStatus, useActiveModal, useMessages, usePendingCommands, useAutoRouterActiveModel, useRouterEnabled, sessionActions, configActions, commandActions, getState, subscribe, } from '../../store/index.js';
// Hooks
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler.js';
import { useConfirmation } from '../hooks/useConfirmation.js';
import { useAgent } from '../hooks/useAgent.js';
import { useCommandProcessor } from '../hooks/useCommandProcessor.js';
// Components
import { MessageRenderer } from './markdown/MessageRenderer.js';
import { InputArea } from './input/InputArea.js';
import { ChatStatusBar } from './layout/ChatStatusBar.js';
import { WelcomeMessage } from './layout/WelcomeMessage.js';
import { MessageList } from './layout/MessageList.js';
import { ConfirmationPrompt } from './dialog/ConfirmationPrompt.js';
import { InteractiveSelector } from './dialog/InteractiveSelector.js';
import { SetupWizard } from './dialog/SetupWizard.js';
import { ExitMessage } from './common/ExitMessage.js';
import { ErrorBoundary } from './common/ErrorBoundary.js';
// Focus
import { FocusId, focusActions } from '../focus/index.js';
// Theme
import { themeManager } from '../themes/index.js';
// ========== Memoized Sub-Components ==========
const QueuedCommands = React.memo(() => {
    const pendingCommands = usePendingCommands();
    const theme = themeManager.getTheme();
    if (pendingCommands.length === 0)
        return null;
    return (_jsx(Box, { flexDirection: "column", marginTop: 0, marginBottom: 0, children: pendingCommands.map((cmd, i) => (_jsx(Box, { flexDirection: "row", marginLeft: 1, children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [_jsxs(Text, { color: theme.colors.primary, children: ["#", i + 1] }), " ", cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd] }) }, i))) }));
});
QueuedCommands.displayName = 'QueuedCommands';
const RecentMessagesPreview = React.memo(({ terminalWidth, count = 3 }) => {
    const messages = getState().session.messages;
    const recentMessages = messages.slice(-count);
    return (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: recentMessages.map((msg, index) => (_jsx(MessageRenderer, { content: msg.content, role: msg.role, terminalWidth: terminalWidth, showPrefix: true }, msg.id || index))) }));
});
RecentMessagesPreview.displayName = 'RecentMessagesPreview';
// ========== Main Component ==========
export const AegisInterface = ({ apiKey, baseURL, model, initialMessage, debug, resumeSessionId, }) => {
    // ==================== Terminal Size ====================
    const { width: terminalWidth, height: terminalHeight } = useTerminalSize();
    // ==================== Store State ====================
    const initializationStatus = useInitializationStatus();
    const activeModal = useActiveModal();
    const messages = useMessages();
    const getMessages = useCallback(() => getState().session.messages, []);
    // ==================== Agent Hook ====================
    const { agentRef, contextManagerRef, isInitializing, initError, currentModel, handleSetupComplete, } = useAgent({ apiKey, baseURL, model, debug, resumeSessionId });
    const autoRouterActiveModel = useAutoRouterActiveModel();
    const routerEnabled = useRouterEnabled();
    // ==================== Stable Refs ====================
    const debugRef = useRef(debug);
    debugRef.current = debug;
    const modelRef = useRef(model);
    modelRef.current = model;
    const getMessagesRef = useRef(getMessages);
    getMessagesRef.current = getMessages;
    // ==================== Local State ====================
    const [isExiting, setIsExiting] = useState(false);
    const [exitSessionId, setExitSessionId] = useState(null);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const [renderLatency, setRenderLatency] = useState(0);
    const renderLatencyTimerRef = useRef(null);
    const handleRenderLatency = useCallback((ms) => {
        // Debounce: only update state at most every 500ms
        if (renderLatencyTimerRef.current)
            return;
        renderLatencyTimerRef.current = setTimeout(() => {
            renderLatencyTimerRef.current = null;
        }, 500);
        setRenderLatency(ms);
    }, []);
    // Clean up latency debounce timer on unmount
    useEffect(() => {
        return () => {
            if (renderLatencyTimerRef.current)
                clearTimeout(renderLatencyTimerRef.current);
        };
    }, []);
    const [selectorState, setSelectorState] = useState({
        isVisible: false,
        title: '',
        options: [],
        handler: null,
    });
    // ==================== Hooks ====================
    const { confirmationState, confirmationHandler, handleResponse } = useConfirmation();
    const confirmationHandlerRef = useRef(confirmationHandler);
    confirmationHandlerRef.current = confirmationHandler;
    // Command processor — extracted hook
    const { processCommand, handleSubmit, processQueue } = useCommandProcessor({
        agentRef,
        contextManagerRef,
        modelRef,
        debugRef,
        getMessagesRef,
        confirmationHandlerRef,
        onSelectorRequest: (state) => {
            setSelectorState({
                isVisible: true,
                title: state.title,
                options: state.options,
                handler: state.handler,
            });
            focusActions.setFocus(FocusId.SELECTOR);
        },
    });
    // ESC interrupt (scrolling handled by MessageList internally)
    useInput((_input, key) => {
        if (key.escape && getState().session.isThinking) {
            commandActions().abort();
            sessionActions().setThinking(false);
        }
    });
    // ==================== Alt+C: Copy last assistant reply ====================
    useInput((_input, key) => {
        if (key.meta && _input === 'c') {
            const msgs = getState().session.messages.filter(m => m.role === 'assistant');
            if (msgs.length === 0)
                return;
            const last = msgs[msgs.length - 1];
            // Strip markdown for clean copy
            const plain = last.content
                .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/, '').replace(/\n?```/, ''))
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/~~(.+?)~~/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^#{1,6}\s+/gm, '')
                .replace(/^>\s+/gm, '')
                .trim();
            if (!plain)
                return;
            import('child_process').then(({ execSync }) => {
                const platform = process.platform;
                try {
                    if (platform === 'darwin')
                        execSync('pbcopy', { input: plain });
                    else if (platform === 'linux') {
                        try {
                            execSync('xclip -selection clipboard', { input: plain });
                        }
                        catch {
                            execSync('xsel --clipboard --input', { input: plain });
                        }
                    }
                    else if (platform === 'win32')
                        execSync('clip', { input: plain });
                }
                catch { }
            }).catch(() => { });
        }
    });
    // ==================== Alt+R: Toggle auto-router ====================
    useInput((_input, key) => {
        if (key.meta && _input === 'r') {
            const isEnabled = getState().config.config?.autoRouter?.enabled ?? false;
            handleSubmit(isEnabled ? '/router off' : '/router on');
        }
    });
    // ==================== Ctrl+C Handler ====================
    useCtrlCHandler({
        onInterrupt: () => {
            commandActions().abort();
            sessionActions().setThinking(false);
        },
        onBeforeExit: () => {
            const currentMessageCount = getState().session.messages.length;
            const currentSessionId = contextManagerRef.current?.getCurrentSessionId() || getState().session.sessionId;
            if (currentSessionId && currentMessageCount > 0) {
                // Flush pending saves before exit so the last messages are persisted
                contextManagerRef.current?.flush().catch(() => { });
                setExitSessionId(currentSessionId);
                setIsExiting(true);
                return true;
            }
            return false;
        },
    });
    // ==================== Focus Management ====================
    useEffect(() => {
        if (confirmationState.isVisible)
            return;
        if (selectorState.isVisible) {
            focusActions.setFocus(FocusId.SELECTOR);
        }
        else if (activeModal === 'themeSelector') {
            focusActions.setFocus(FocusId.THEME_SELECTOR);
        }
        else {
            focusActions.setFocus(FocusId.MAIN_INPUT);
        }
    }, [confirmationState.isVisible, selectorState.isVisible, activeModal]);
    // ==================== Selector Handlers ====================
    const handleSelectorSelect = useCallback(async (value) => {
        const { handler } = selectorState;
        focusActions.setFocus(FocusId.MAIN_INPUT);
        setSelectorState({ isVisible: false, title: '', options: [], handler: null });
        if (handler === 'theme') {
            themeManager.setTheme(value);
            sessionActions().addAssistantMessage('✓ ' + value);
        }
        else if (handler === 'model') {
            if (value.startsWith('__ollama__')) {
                const modelName = value.slice('__ollama__'.length);
                const id = modelName.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
                try {
                    const fs = await import('fs');
                    const path = await import('path');
                    const os = await import('os');
                    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
                    try {
                        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                        cfg.models = cfg.models || [];
                        if (!cfg.models.find((m) => m.id === id)) {
                            cfg.models.push({ id, name: modelName, model: modelName, baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' });
                        }
                        cfg.currentModelId = id;
                        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
                    }
                    catch { /* non-fatal */ }
                }
                catch { /* non-fatal */ }
                configActions().updateConfig({ currentModelId: id });
            }
            else {
                configActions().updateConfig({ currentModelId: value });
            }
        }
    }, [selectorState]);
    const handleSelectorCancel = useCallback(() => {
        setSelectorState({ isVisible: false, title: '', options: [], handler: null });
        focusActions.setFocus(FocusId.MAIN_INPUT);
    }, []);
    // ==================== Queue Processor ====================
    useEffect(() => {
        let prevIsThinking = getState().session.isThinking;
        const unsubscribe = subscribe((state) => {
            const currentIsThinking = state.session.isThinking;
            const hasPending = state.command.pendingCommands.length > 0;
            if (prevIsThinking && !currentIsThinking && hasPending) {
                processQueue();
            }
            prevIsThinking = currentIsThinking;
        });
        return unsubscribe;
    }, [processQueue]);
    // ==================== Initial Message ====================
    const initialMessageSent = useRef(false);
    useEffect(() => {
        if (initialMessage && !initialMessageSent.current && !isInitializing && agentRef.current) {
            initialMessageSent.current = true;
            handleSubmit(initialMessage);
        }
    }, [initialMessage, handleSubmit, isInitializing]);
    // ==================== Scroll State Notification ====================
    const handleScrolledUpChange = useCallback((scrolledUp) => {
        setIsScrolledUp(scrolledUp);
    }, []);
    // ==================== Render ====================
    if (isInitializing) {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsx(Box, { children: _jsx(Text, { color: "yellow", children: " Initializing..." }) }) }));
    }
    if (initError) {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { color: "red", children: "Agent initialization failed:" }), _jsx(Text, { color: "red", children: initError })] }));
    }
    if (initializationStatus === 'needsSetup') {
        return _jsx(SetupWizard, { onComplete: handleSetupComplete });
    }
    const hasPendingInitialMessage = !!(initialMessage && !initialMessageSent.current);
    return (_jsxs(Box, { flexDirection: "column", width: "100%", paddingX: 0, flexGrow: 1, children: [messages.length === 0 && _jsx(WelcomeMessage, { terminalWidth: terminalWidth - 2 }), selectorState.isVisible ? (_jsxs(_Fragment, { children: [_jsx(RecentMessagesPreview, { terminalWidth: terminalWidth - 2, count: 3 }), _jsx(InteractiveSelector, { title: selectorState.title, options: selectorState.options, onSelect: handleSelectorSelect, onCancel: handleSelectorCancel, focusId: FocusId.SELECTOR })] })) : (_jsxs(_Fragment, { children: [messages.length > 0 && (_jsx(ErrorBoundary, { name: "MessageList", fallback: _jsx(Text, { color: "red", children: "Message list error" }), children: _jsx(Box, { flexGrow: 1, minHeight: 0, children: _jsx(MessageList, { terminalWidth: terminalWidth - 2, terminalHeight: terminalHeight, onScrolledUpChange: handleScrolledUpChange, onRenderLatency: handleRenderLatency }) }) })), _jsx(QueuedCommands, {}), confirmationState.isVisible && confirmationState.details && (_jsx(ErrorBoundary, { name: "ConfirmationPrompt", fallback: null, children: _jsx(ConfirmationPrompt, { details: confirmationState.details, onResponse: handleResponse }) })), _jsx(ErrorBoundary, { name: "InputArea", fallback: _jsx(Text, { color: "red", children: "Input error \u2014 restart app" }), children: _jsx(InputArea, { onSubmit: handleSubmit }) }), _jsx(ChatStatusBar, { model: autoRouterActiveModel || currentModel, modelIsAuto: !!autoRouterActiveModel, isScrolledUp: messages.length > 0 && isScrolledUp, renderLatency: renderLatency, routerEnabled: routerEnabled })] })), isExiting && exitSessionId && (_jsx(ExitMessage, { sessionId: exitSessionId }))] }));
};
//# sourceMappingURL=AegisInterface.js.map