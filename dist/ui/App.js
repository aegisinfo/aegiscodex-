import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * App.tsx - rooted UI with stable references
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { UpdatePrompt } from './components/dialog/UpdatePrompt.js';
import { AegisInterface } from './components/AegisInterface.js';
import { DEFAULT_CONFIG } from '../config/types.js';
import { ensureStoreInitialized, appActions, configActions, getConfig, useInitializationStatus, } from '../store/index.js';
function mergeRuntimeConfig(baseConfig, props) {
    const runtimeConfig = { ...baseConfig };
    if (props.initialMessage)
        runtimeConfig.initialMessage = props.initialMessage;
    if (props.resumeSessionId)
        runtimeConfig.resumeSessionId = props.resumeSessionId;
    if (props.permissionMode)
        runtimeConfig.defaultPermissionMode = props.permissionMode;
    if (props.routerEnabled) {
        runtimeConfig.autoRouter = { ...runtimeConfig.autoRouter, enabled: true };
    }
    if (props.model) {
        // Try to map model name to model ID first
        const models = baseConfig.models || [];
        const matched = models.find((m) => m.model === props.model || m.id === props.model);
        runtimeConfig.currentModelId = matched ? matched.id : props.model;
    }
    return runtimeConfig;
}
function initializeStoreState(config) {
    configActions().setConfig(config);
    const isRealKey = (key) => !!key && !key.startsWith('YOUR_');
    const hasRealDefault = isRealKey(config.default?.apiKey);
    const hasRealModel = config.models?.some(m => isRealKey(m.apiKey));
    if (!hasRealDefault && !hasRealModel) {
        appActions().setInitializationStatus('needsSetup');
    }
    else {
        appActions().setInitializationStatus('ready');
    }
}
const AppWrapper = (props) => {
    const { versionCheckPromise, permissionMode, ...mainProps } = props;
    const initializationStatus = useInitializationStatus();
    const [versionInfo, setVersionInfo] = useState(null);
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
    const initDoneRef = useRef(false);
    // Stable initializeApp using ref to avoid re-creating on every render
    const propsRef = useRef(props);
    propsRef.current = props;
    const initializeApp = useCallback(async () => {
        const p = propsRef.current;
        if (p.debug)
            console.log('[DEBUG] Initializing application and Store...');
        try {
            appActions().setInitializationStatus('loading');
            await ensureStoreInitialized();
            const baseConfig = getConfig() ?? DEFAULT_CONFIG;
            const mergedConfig = mergeRuntimeConfig(baseConfig, p);
            initializeStoreState(mergedConfig);
            initDoneRef.current = true;
            if (p.debug)
                console.log('[DEBUG] Store initialized successfully');
        }
        catch (error) {
            appActions().setInitializationError(error instanceof Error ? error.message : 'Unknown initialization error');
            if (propsRef.current.debug)
                console.log('[DEBUG] Store initialization failed:', error);
        }
    }, []);
    useEffect(() => {
        // Start initialization immediately — don't wait for version check
        const initPromise = initializeApp();
        if (versionCheckPromise) {
            // Run version check in parallel; only show prompt if init hasn't finished
            versionCheckPromise
                .then((versionResult) => {
                if (versionResult && versionResult.shouldPrompt && !initDoneRef.current) {
                    setVersionInfo(versionResult);
                    setShowUpdatePrompt(true);
                }
            })
                .catch((error) => {
                if (props.debug)
                    console.log('[DEBUG] Version check failed:', error);
            });
        }
        // Keep the lint happy — both are used
        void initPromise;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [versionCheckPromise, props.debug]);
    if (showUpdatePrompt && versionInfo) {
        return (_jsx(UpdatePrompt, { versionInfo: versionInfo, onComplete: async () => {
                setShowUpdatePrompt(false);
                await initializeApp();
            } }));
    }
    if (initializationStatus === 'pending' || initializationStatus === 'loading') {
        return (_jsx(Box, { padding: 1 }));
    }
    if (initializationStatus === 'error') {
        return (_jsxs(Box, { padding: 1, flexDirection: "column", children: [_jsx(Text, { color: "red", children: "\u274C Initialization failed" }), _jsx(Text, { color: "gray", children: "Please check your configuration and try again." })] }));
    }
    return _jsx(AegisInterface, { ...mainProps });
};
export const App = (props) => {
    return (_jsx(ErrorBoundary, { children: _jsx(AppWrapper, { ...props }) }));
};
//# sourceMappingURL=App.js.map