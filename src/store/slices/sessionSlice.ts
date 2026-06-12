/**
 * Session Slice - 会话状态管理
 *
 * Streaming Architecture (Buffer + Store):
 *
 * During streaming, content deltas arrive at high frequency (per-character).
 * Writing each delta to the zustand store triggers cascading re-renders
 * across ALL subscribers — causing visible terminal "blink".
 *
 * Solution: External mutable buffer (streaming-buffer.ts).
 *   - deltas → appendToBuffer() — O(1), no store update
 *   - MessageList RAF loop polls buffer directly — only MessageList re-renders
 *   - Store updated only at: start, flush (tool calls), finish
 *
 * flushStreamBuffer → drainBuffer() → store.set() → initStreamingBuffer()
 *   Used mid-streaming (e.g., before a tool call) to persist content to store
 *   while keeping the buffer alive for subsequent deltas.
 *
 * finishStreamingMessage → drainBuffer() → store.set() (isStreaming=false)
 *   Finalizes the message. No re-init — streaming is done.
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, SessionSlice, SessionMessage, TokenUsage, ContentBlock, ToolCallStatus } from '../types.js';
import { appendToBuffer, appendThinkingToBuffer, initStreamingBuffer, drainBuffer, clearBuffer } from '../streaming-buffer.js';

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
    modelBreakdown: {},
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
     * Append a fully-formed message (no streaming).
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
     * Create and append a user message from plain text.
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
     * Create and append a fully-formed assistant message.
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
     * Start a new streaming assistant message.
     * Creates an empty placeholder in the store and initializes the buffer.
     * Returns the message ID for subsequent delta/flush/finish calls.
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
      initStreamingBuffer(id);
      return id;
    },

    /**
     * Append content delta to the mutable buffer ONLY.
     * No store update — the RAF loop picks up content from the buffer.
     */
    appendToStreamingMessage: (_id: string, contentDelta: string) => {
      appendToBuffer(contentDelta);
    },

    /**
     * Append thinking delta to the mutable buffer ONLY.
     * No store update — same reasoning as appendToStreamingMessage.
     */
    appendThinkingToStreamingMessage: (_id: string, thinkingDelta: string) => {
      if (thinkingDelta) {
        appendThinkingToBuffer(thinkingDelta);
      }
    },

    /**
     * Force-flush buffer content to the store, then re-init the buffer.
     *
     * Used before tool calls so preceding text is persisted to the message
     * while the buffer stays alive for tool call arguments and subsequent text.
     *
     * drainBuffer() atomically reads + clears the buffer (but keeps messageId).
     * Then initStreamingBuffer() re-initializes with the same ID so
     * isActiveStreamingMessage() still resolves correctly.
     */
    flushStreamBuffer: (id: string) => {
      const drained = drainBuffer();
      if (!drained || (!drained.content && !drained.thinking && drained.toolCalls.length === 0)) return;

      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === id
              ? {
                  ...msg,
                  content: msg.content + drained.content,
                  thinking: (msg.thinking || '') + drained.thinking,
                }
              : msg
          ),
        },
      }));

      // Re-init so subsequent deltas are tracked under the same message ID.
      initStreamingBuffer(id);
    },

    /**
     * Write directly to the store message, bypassing the buffer.
     * Used for immediate content (errors, forced updates) during streaming.
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
     * Finalize streaming: drain buffer to store, mark message as complete.
     *
     * drainBuffer() reads and clears the buffer atomically. The content
     * is appended to the store message and isStreaming is set to false.
     * The RAF loop stops polling this message (isStreaming check fails).
     *
     * No re-init needed — streaming is done.
     */
    finishStreamingMessage: (id: string) => {
      const drained = drainBuffer();
      // Clear messageId so getStreamingContent() returns null immediately.
      // Without this, the stale React state window sees a non-null buffer
      // and keeps rendering the streaming cursor.
      clearBuffer();

      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === id
              ? {
                  ...msg,
                  content: msg.content + (drained ? drained.content : ''),
                  thinking: (msg.thinking || '') + (drained ? drained.thinking : ''),
                  isStreaming: false,
                }
              : msg
          ),
        },
      }));
    },

    // ===== Content Block Operations =====

    addContentBlock: (messageId: string, block: ContentBlock) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  contentBlocks: [...(msg.contentBlocks || []), block],
                }
              : msg
          ),
        },
      }));
    },

    updateToolCallInput: (messageId: string, toolCallId: string, partialJson: string) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === messageId && msg.contentBlocks
              ? {
                  ...msg,
                  contentBlocks: msg.contentBlocks.map(block =>
                    block.type === 'tool_use' && block.id === toolCallId
                      ? { ...block, input: block.input + partialJson } as ContentBlock
                      : block
                  ),
                }
              : msg
          ),
        },
      }));
    },

    setToolCallInput: (messageId: string, toolCallId: string, fullInput: string) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === messageId && msg.contentBlocks
              ? {
                  ...msg,
                  contentBlocks: msg.contentBlocks.map(block =>
                    block.type === 'tool_use' && block.id === toolCallId
                      ? { ...block, input: fullInput } as ContentBlock
                      : block
                  ),
                }
              : msg
          ),
        },
      }));
    },

    updateToolCallStatus: (messageId: string, toolCallId: string, status: ToolCallStatus, completedAt?: number) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === messageId && msg.contentBlocks
              ? {
                  ...msg,
                  contentBlocks: msg.contentBlocks.map(block =>
                    block.type === 'tool_use' && block.id === toolCallId
                      ? { ...block, status, ...(completedAt ? { completedAt } : {}) } as ContentBlock
                      : block
                  ),
                }
              : msg
          ),
        },
      }));
    },

    addToolResultBlock: (messageId: string, toolUseId: string, content: string, isError: boolean) => {
      set((state) => ({
        session: {
          ...state.session,
          messages: state.session.messages.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  contentBlocks: [
                    ...(msg.contentBlocks || []),
                    { type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError } as ContentBlock,
                  ],
                }
              : msg
          ),
        },
      }));
    },

    /**
     * Set thinking state indicator.
     */
    setThinking: (isThinking: boolean) => {
      set((state) => ({
        session: { ...state.session, isThinking },
      }));
    },

    /**
     * Set compacting indicator (context compaction in progress).
     */
    setCompacting: (isCompacting: boolean) => {
      set((state) => ({
        session: { ...state.session, isCompacting },
      }));
    },

    /**
     * Set the current command being processed.
     */
    setCurrentCommand: (command: string | null) => {
      set((state) => ({
        session: { ...state.session, currentCommand: command },
      }));
    },

    /**
     * Set error state.
     */
    setError: (error: string | null) => {
      set((state) => ({
        session: { ...state.session, error },
      }));
    },

    /**
     * Set session ID.
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
     * Restore a session with messages from persistence.
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
     * Update token usage counters.
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
     * Clear all messages (new session within same session ID).
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
     * Full session reset with a new session ID.
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
