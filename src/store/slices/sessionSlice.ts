/**
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, SessionSlice, SessionMessage, TokenUsage } from '../types.js';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const initialSessionState = {
  sessionId: generateId(),
  messages: [] as SessionMessage[],
  isThinking: false,
  isCompacting: false,
  currentCommand: null as string | null,
  error: null as string | null,
  isActive: true,
  tokenUsage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    maxContextTokens: 200000,
  } as TokenUsage,
};

export const createSessionSlice: StateCreator<
  ClawdStore,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  ...initialSessionState,

  actions: {
    /**
     * 
     */
    addMessage: (message: SessionMessage) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: [...state.session.messages, message],
          error: null,
        },
      }));
    },

    /**
     * 
     */
    addUserMessage: (content: string) => {
      const message: SessionMessage = {
        id: `user-${generateId()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      get().session.actions.addMessage(message);
    },

    /**
     * 
     */
    addAssistantMessage: (content: string) => {
      const message: SessionMessage = {
        id: `assistant-${generateId()}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
      };
      get().session.actions.addMessage(message);
    },

    /**
     * 
     */
    startStreamingMessage: () => {
      const id = `assistant-${generateId()}`;
      const message: SessionMessage = {
        id,
        role: 'assistant',
        content: '',
        thinking: '',
        timestamp: Date.now(),
        isStreaming: true,
      };
      set((state) => ({
        session: {
          ...state.session,
          messages: [...state.session.messages, message],
          error: null,
        },
      }));
      return id;
    },

    /**
     * 
     */
    appendToStreamingMessage: (id: string, contentDelta: string) => {
      const state = get();
      const messages = state.session.messages;
      const idx = messages.findIndex(m => m.id === id);
      if (idx !== -1) {
        // Optimize: only create new array + spread once instead of spread + map
        const updated = messages.slice();
        updated[idx] = { ...updated[idx], content: updated[idx].content + contentDelta };
        set((state) => ({
          session: { ...state.session, messages: updated },
        }));
      }
    },

    /**
     * 
     */
    appendThinkingToStreamingMessage: (id: string, thinkingDelta: string) => {
      const state = get();
      const messages = state.session.messages;
      const idx = messages.findIndex(m => m.id === id);
      if (idx !== -1) {
        const updated = messages.slice();
        updated[idx] = { ...updated[idx], thinking: (updated[idx].thinking || '') + thinkingDelta };
        set((state) => ({
          session: { ...state.session, messages: updated },
        }));
      }
    },

    /**
     * 
     */
    finishStreamingMessage: (id: string) => {
      const state = get();
      const messages = state.session.messages;
      const idx = messages.findIndex(m => m.id === id);
      if (idx !== -1 && messages[idx].isStreaming) {
        const updated = messages.slice();
        updated[idx] = { ...updated[idx], isStreaming: false };
        set((state) => ({
          session: { ...state.session, messages: updated },
        }));
      }
    },

    /**
     * 
     */
    setThinking: (isThinking: boolean) => {
      set((state) => ({
        session: { ...state.session, isThinking },
      }));
    },

    /**
     * 
     */
    setCompacting: (isCompacting: boolean) => {
      set((state) => ({
        session: { ...state.session, isCompacting },
      }));
    },

    /**
     * 
     */
    setCurrentCommand: (command: string | null) => {
      set((state) => ({
        session: { ...state.session, currentCommand: command },
      }));
    },

    /**
     * 
     */
    setError: (error: string | null) => {
      set((state) => ({
        session: { ...state.session, error },
      }));
    },

    /**
     * 
     */
    setSessionId: (sessionId: string) => {
      set((state) => ({
        session: {
          ...state.session,
          sessionId,
        },
      }));
    },

    /**
     * 
     */
    restoreSession: (sessionId: string, messages: SessionMessage[]) => {
      set((state) => ({
        session: {
          ...state.session,
          sessionId,
          messages,
          error: null,
          isActive: true,
        },
      }));
    },

    /**
     * 
     */
    updateTokenUsage: (usage: Partial<TokenUsage>) => {
      set((state) => ({
        session: {
          ...state.session,
          tokenUsage: { ...state.session.tokenUsage, ...usage },
        },
      }));
    },

    /**
     * 
     */
    clearMessages: () => {
      set((state) => ({
        session: {
          ...state.session,
          messages: [],
          error: null,
        },
      }));
    },

    /**
     * 
     */
    resetSession: () => {
      set((state) => ({
        session: {
          ...state.session,
          ...initialSessionState,
          sessionId: generateId(),
        },
      }));
    },
  },
});
