/**
 * Zustand Vanilla Store
 * 
 * 
 */

import { createStore } from 'zustand/vanilla';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import type { ClawdStore } from './types.js';
import type { RuntimeConfig } from '../config/types.js';
import {
  createSessionSlice,
  createConfigSlice,
  createAppSlice,
  createFocusSlice,
  createCommandSlice,
} from './slices/index.js';

/**
 * 
 *
 * 
 */
export const vanillaStore = createStore<ClawdStore>()(
  devtools(
    subscribeWithSelector((...a) => ({
      session: createSessionSlice(...a),
      config: createConfigSlice(...a),
      app: createAppSlice(...a),
      focus: createFocusSlice(...a),
      command: createCommandSlice(...a),
    })),
    {
      name: 'ClawdStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

/**
 * 
 */
export const getState = () => vanillaStore.getState();

/**
 * 
 */
export const subscribe = vanillaStore.subscribe;

export const sessionActions = () => getState().session.actions;
export const configActions = () => getState().config.actions;
export const appActions = () => getState().app.actions;
export const focusActions = () => getState().focus.actions;
export const commandActions = () => getState().command.actions;

/**
 * 
 */
export const getConfig = (): RuntimeConfig | null => getState().config.config;

/**
 * 
 */
export const getCurrentModel = () => {
  const config = getConfig();
  if (!config) return undefined;
  if (config.currentModelId && config.models) {
    const model = config.models.find((m) => m.id === config.currentModelId);
    if (model) return model;
  }
  if (config.models && config.models.length > 0) {
    return config.models[0];
  }
  return config.default;
};

/**
 * 
 */
export const getPermissionMode = () => {
  const config = getConfig();
  return config?.defaultPermissionMode || 'default';
};

let initializationPromise: Promise<void> | null = null;

/**
 * 
 *
 * 
 */
export async function ensureStoreInitialized(): Promise<void> {
  const config = getConfig();
  if (config !== null) {
    return;
  }
  if (initializationPromise) {
    return initializationPromise;
  }
  initializationPromise = (async () => {
    try {
      const { ConfigManager } = await import('../config/ConfigManager.js');
      const configManager = ConfigManager.getInstance();
      const loadedConfig = await configManager.initialize();
      getState().config.actions.setConfig(loadedConfig as RuntimeConfig);
    } catch (error) {
      initializationPromise = null;
      throw new Error(
        `❌ Store \n\n` +
          `: ${error instanceof Error ? error.message : ''}`
      );
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * 
 */
export function subscribeToState<T>(
  selector: (state: ClawdStore) => T,
  callback: (value: T, prevValue: T) => void
): () => void {
  return vanillaStore.subscribe((state, prevState) => {
    const value = selector(state);
    const prevValue = selector(prevState);
    if (value !== prevValue) {
      callback(value, prevValue);
    }
  });
}

/**
 * 
 */
export function subscribeToTodos(
  callback: (todos: ClawdStore['app']['todos']) => void
): () => void {
  return subscribeToState((state) => state.app.todos, callback);
}

/**
 * 
 */
export function subscribeToMessages(
  callback: (messages: ClawdStore['session']['messages']) => void
): () => void {
  return subscribeToState((state) => state.session.messages, callback);
}
