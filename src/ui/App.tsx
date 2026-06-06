/**
 * App.tsx - rooted UI with stable references
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import pkg from '../../package.json' with { type: 'json' };
import { UpdatePrompt } from './components/dialog/UpdatePrompt.js';
import { AegisInterface } from './components/AegisInterface.js';
import { themeManager } from './themes/index.js';
import type { PermissionMode } from '../cli/types.js';
import type { VersionCheckResult } from '../services/VersionChecker.js';
import type { RuntimeConfig, ClawdConfig } from '../config/types.js';
import { DEFAULT_CONFIG } from '../config/types.js';
import {
  ensureStoreInitialized,
  appActions,
  configActions,
  getConfig,
  useInitializationStatus,
} from '../store/index.js';

export interface AppProps {
  apiKey: string;
  baseURL?: string;
  model?: string;
  initialMessage?: string;
  debug?: boolean;
  permissionMode?: PermissionMode;
  versionCheckPromise?: Promise<VersionCheckResult | null>;
  resumeSessionId?: string;
}

function mergeRuntimeConfig(baseConfig: ClawdConfig, props: AppProps): RuntimeConfig {
  const runtimeConfig: RuntimeConfig = { ...baseConfig };

  if (props.initialMessage) runtimeConfig.initialMessage = props.initialMessage;
  if (props.resumeSessionId) runtimeConfig.resumeSessionId = props.resumeSessionId;
  if (props.permissionMode) runtimeConfig.defaultPermissionMode = props.permissionMode;
  if (props.model) runtimeConfig.currentModelId = props.model;

  return runtimeConfig;
}

function initializeStoreState(config: RuntimeConfig): void {
  configActions().setConfig(config);

  const hasDefaultConfig = config.default?.apiKey;
  const hasModelsConfig = config.models && config.models.length > 0;

  if (!hasDefaultConfig && !hasModelsConfig) {
    appActions().setInitializationStatus('needsSetup');
  } else {
    appActions().setInitializationStatus('ready');
  }
}

const AppWrapper: React.FC<AppProps> = (props) => {
  const { versionCheckPromise, permissionMode, ...mainProps } = props;
  
  const initializationStatus = useInitializationStatus();
  
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const initDoneRef = useRef(false);

  // Stable initializeApp using ref to avoid re-creating on every render
  const propsRef = useRef(props);
  propsRef.current = props;
  const initializeApp = useCallback(async () => {
    const p = propsRef.current;
    if (p.debug) console.log('[DEBUG] Initializing application and Store...');
    
    try {
      appActions().setInitializationStatus('loading');
      
      await ensureStoreInitialized();
      
      const baseConfig = getConfig() ?? DEFAULT_CONFIG;
      const mergedConfig = mergeRuntimeConfig(baseConfig, p);
      initializeStoreState(mergedConfig);
      
      initDoneRef.current = true;
      if (p.debug) console.log('[DEBUG] Store initialized successfully');
    } catch (error) {
      appActions().setInitializationError(
        error instanceof Error ? error.message : 'Unknown initialization error'
      );
      if (propsRef.current.debug) console.log('[DEBUG] Store initialization failed:', error);
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
          if (props.debug) console.log('[DEBUG] Version check failed:', error);
        });
    }

    // Keep the lint happy — both are used
    void initPromise;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionCheckPromise, props.debug]);

  if (showUpdatePrompt && versionInfo) {
    return (
      <UpdatePrompt
        versionInfo={versionInfo}
        onComplete={async () => {
          setShowUpdatePrompt(false);
          await initializeApp();
        }}
      />
    );
  }

  if (initializationStatus === 'pending' || initializationStatus === 'loading') {
    return (
      <Box padding={1}>

      </Box>
    );
  }

  if (initializationStatus === 'error') {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">❌ Initialization failed</Text>
        <Text color="gray">Please check your configuration and try again.</Text>
      </Box>
    );
  }

  return <AegisInterface {...mainProps} />;
};

export const App: React.FC<AppProps> = (props) => {
  return (
    <ErrorBoundary>
      <AppWrapper {...props} />
    </ErrorBoundary>
  );
};
