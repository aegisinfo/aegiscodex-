/**
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, CommandSlice } from '../types.js';

const initialCommandState = {
  isProcessing: false,
  abortController: null as AbortController | null,
  pendingCommands: [] as string[],
};

export const createCommandSlice: StateCreator<
  ClawdStore,
  [],
  [],
  CommandSlice
> = (set, get) => ({
  ...initialCommandState,

  actions: {
    /**
     * 
     */
    setProcessing: (isProcessing: boolean) => {
      set((state) => ({
        command: { ...state.command, isProcessing },
      }));
    },

    /**
     * 
     */
    createAbortController: () => {
      const controller = new AbortController();
      set((state) => ({
        command: { ...state.command, abortController: controller },
      }));
      return controller;
    },

    /**
     * 
     */
    abort: () => {
      const { abortController } = get().command;

      if (abortController && !abortController.signal.aborted) {
        abortController.abort();
      }
      get().session.actions.setThinking(false);
      set((state) => ({
        command: {
          ...state.command,
          isProcessing: false,
          abortController: null,
          pendingCommands: [],
        },
      }));
    },

    /**
     * 
     */
    enqueueCommand: (command: string) => {
      set((state) => ({
        command: {
          ...state.command,
          pendingCommands: [...state.command.pendingCommands, command],
        },
      }));
    },

    /**
     * 
     */
    dequeueCommand: () => {
      const { pendingCommands } = get().command;
      if (pendingCommands.length === 0) {
        return undefined;
      }

      const [nextCommand, ...rest] = pendingCommands;
      set((state) => ({
        command: {
          ...state.command,
          pendingCommands: rest,
        },
      }));

      return nextCommand;
    },

    /**
     * 
     */
    clearQueue: () => {
      set((state) => ({
        command: {
          ...state.command,
          pendingCommands: [],
        },
      }));
    },
  },
});
