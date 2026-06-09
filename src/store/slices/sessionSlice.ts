/**
 * Session Slice - 会话状态管理
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, SessionSlice, SessionMessage, TokenUsage } from '../types.js';
import { appendToBuffer, appendThinkingToBuffer, initStreamingBuffer, clearBuffer, peekBuffer, resetConsumerPosition } from '../streaming-buffer.js';

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
      // Initialize the streaming buffer for this message
      initStreamingBuffer(id);
      return id;
    },

    /**
     * Append content delta WITHOUT calling set() on the store.
     *
     * Instead of notifying all store subscribers on every delta (which causes
     * cascading React re-renders and terminal flickering), we write directly
     * to an external mutable buffer. The RAF-driven MessageList reads from
     * this buffer directly, bypassing the store entirely.
     *
     * The store is only updated when streaming starts/finishes or when a
     * forced flush is needed (tool calls, explicit flushes).
     */
    appendToStreamingMessage: (_id: string, contentDelta: string) => {
      appendToBuffer(contentDelta);
    },

    /**
     * 
     */
    appendThinkingToStreamingMessage: (_id: string, thinkingDelta: string) => {
      if (thinkingDelta) {
        appendThinkingToBuffer(thinkingDelta);
      }
    },

    /**
     * Force-flush the streaming buffer to the store.
     * This syncs the mutable buffer content to the actual message object
     * and notifies store subscribers, then clears the buffer.
     * Used by tool call handlers to show content before a tool invocation.
     */
    flushStreamBuffer: (id: string) => {
      const bufferContent = peekBuffer();
      if (!bufferContent.content && !bufferContent.thinking) return;
      clearBuffer();

      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === id
              ? {
                  ...msg,
                  content: msg.content + bufferContent.content,
                  thinking: (msg.thinking || '') + bufferContent.thinking,
                }
              : msg
          ),
        },
      }));
      // Reset RAF consumer position so the MessageList RAF loop doesn't
      // re-append old buffer content that was just flushed to the store.
      resetConsumerPosition();
    },

    /**
     * Write directly to the store message, bypassing the streaming buffer.
     * Used for tool call events that must appear immediately.
     */
    forceAppendToMessage: (id: string, contentDelta: string) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === id
              ? { ...msg, content: msg.content + contentDelta }
              : msg
          ),
        },
      }));
    },

    /**
     * Finalize streaming: sync remaining buffer content to the store
     * and mark message as no longer streaming.
     */
    finishStreamingMessage: (id: string) => {
      const bufferContent = peekBuffer();
      clearBuffer();
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === id
              ? {
                  ...msg,
                  content: msg.content + bufferContent.content,
                  thinking: (msg.thinking || '') + bufferContent.thinking,
                  isStreaming: false,
                }
              : msg
          ),
        },
      }));
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
