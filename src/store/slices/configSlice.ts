/**
 * Config Slice - 配置状态管理
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, ConfigSlice } from '../types.js';
import type { RuntimeConfig } from '../../config/types.js';

export const createConfigSlice: StateCreator<
  ClawdStore,
  [],
  [],
  ConfigSlice
> = (set) => ({
  config: null,

  actions: {
    /**
     * 
     */
    setConfig: (config: RuntimeConfig) => {
      set((state) => ({
        config: { ...state.config, config },
      }));
    },

    /**
     * 
     */
    updateConfig: (partial: Partial<RuntimeConfig>) => {
      set((state) => {
        if (!state.config.config) {
          console.warn('[ConfigSlice] Config not initialized, cannot update');
          return state;
        }

        return {
          config: {
            ...state.config,
            config: { ...state.config.config, ...partial },
          },
        };
      });
    },
  },
});
