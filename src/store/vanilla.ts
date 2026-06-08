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
 * - devtools: 开发工具支持
 * - subscribeWithSelector: 支持选择器订阅
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

// ========== 便捷访问

/**
 * 
 */
export const getState = () => vanillaStore.getState();

/**
 * 
 */
export const subscribe = vanillaStore.subscribe;

// ========== Actions 快捷访

export const sessionActions = () => getState().session.actions;
export const configActions = () => getState().config.actions;
export const appActions = () => getState().app.actions;
export const focusActions = () => getState().focus.actions;
export const commandActions = () => getState().command.actions;

// ========== 配置便捷访

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

  // 优先使
  if (config.currentModelId && config.models) {
    const model = config.models.find((m) => m.id === config.currentModelId);
    if (model) return model;
  }

  // 回退
  if (config.models && config.models.length > 0) {
    return config.models[0];
  }

  // 回退
  return config.default;
};

/**
 * 
 */
export const getPermissionMode = () => {
  const config = getConfig();
  return config?.defaultPermissionMode || 'default';
};

// ========== 初始化机

let initializationPromise: Promise<void> | null = null;

/**
 * 
 *
 * 
 * - 幂等：已初始化直接返回
 * - 并发安全：共享 Promise
 * - 失败重试：下次调用重新尝试
 */
export async function ensureStoreInitialized(): Promise<void> {
  // 1. 快速路径：已初始
  const config = getConfig();
  if (config !== null) {
    return;
  }

  // 2. 并发保护：等待共
  if (initializationPromise) {
    return initializationPromise;
  }

  // 3. 开始初始
  initializationPromise = (async () => {
    try {
      // 动态导入避免循环依
      const { ConfigManager } = await import('../config/ConfigManager.js');
      const configManager = ConfigManager.getInstance();
      const loadedConfig = await configManager.initialize();
      getState().config.actions.setConfig(loadedConfig as RuntimeConfig);
    } catch (error) {
      initializationPromise = null; // 允许重
      throw new Error(
        `❌ Store 初始化失败\n\n` +
          `原因: ${error instanceof Error ? error.message : '未知错误'}`
      );
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

// ========== 订阅工

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
