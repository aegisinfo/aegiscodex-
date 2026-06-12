/**
 * Session Slice - 会话状态管理
 */
import { appendToBuffer, appendThinkingToBuffer, initStreamingBuffer, clearBuffer, peekBuffer, resetConsumerPosition } from '../streaming-buffer.js';
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const initialSessionState = {
    sessionId: generateId(),
    messages: [],
    isThinking: false,
    isCompacting: false,
    currentCommand: null,
    error: null,
    isActive: true,
    tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        maxContextTokens: 200000,
    },
};
export const createSessionSlice = (set, get) => ({
    ...initialSessionState,
    actions: {
        /**
         *
         */
        addMessage: (message) => {
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
        addUserMessage: (content) => {
            const message = {
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
        addAssistantMessage: (content) => {
            const message = {
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
            const message = {
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
         * to an external mutable buffer. The MessageList RAF/throttled loop reads
         * from this buffer directly, bypassing the store entirely.
         *
         * The store is only updated when streaming starts/finishes or when a
         * forced flush is needed (tool calls, explicit flushes).
         */
        appendToStreamingMessage: (_id, contentDelta) => {
            appendToBuffer(contentDelta);
        },
        /**
         * Append thinking delta WITHOUT calling set() on the store.
         * Same reasoning as appendToStreamingMessage — writes go only to the
         * mutable streaming buffer, not to the store.
         */
        appendThinkingToStreamingMessage: (_id, thinkingDelta) => {
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
        flushStreamBuffer: (id) => {
            const bufferContent = peekBuffer();
            if (!bufferContent.content && !bufferContent.thinking)
                return;
            clearBuffer();
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === id
                        ? {
                            ...msg,
                            content: msg.content + bufferContent.content,
                            thinking: (msg.thinking || '') + bufferContent.thinking,
                        }
                        : msg),
                },
            }));
            // Reset RAF consumer position so the MessageList RAF loop doesn't
            // re-append old buffer content that was just flushed to the store.
            resetConsumerPosition();
            // Re-init buffer with the same messageId so subsequent streaming
            // deltas (after tool calls) are picked up by the RAF loop.
            initStreamingBuffer(id);
        },
        /**
         * Write directly to the store message, bypassing the streaming buffer.
         * Used for tool call events that must appear immediately.
         */
        forceAppendToMessage: (id, contentDelta) => {
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === id
                        ? { ...msg, content: msg.content + contentDelta }
                        : msg),
                },
            }));
        },
        /**
         * Finalize streaming: sync all buffer content to the store and mark
         * message as no longer streaming.
         *
         * The RAF loop in MessageList now reads the buffer directly and does
         * NOT write to the store during streaming. This means the store's
         * message.content is still the initial empty string (plus any
         * flushStreamBuffer calls). We must write ALL buffer content here.
         */
        finishStreamingMessage: (id) => {
            const bufferContent = peekBuffer();
            clearBuffer();
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === id
                        ? {
                            ...msg,
                            content: msg.content + bufferContent.content,
                            thinking: (msg.thinking || '') + bufferContent.thinking,
                            isStreaming: false,
                        }
                        : msg),
                },
            }));
        },
        // ===== Content Block Operations =====
        addContentBlock: (messageId, block) => {
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === messageId
                        ? {
                            ...msg,
                            contentBlocks: [...(msg.contentBlocks || []), block],
                        }
                        : msg),
                },
            }));
        },
        updateToolCallInput: (messageId, toolCallId, partialJson) => {
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === messageId && msg.contentBlocks
                        ? {
                            ...msg,
                            contentBlocks: msg.contentBlocks.map(block => block.type === 'tool_use' && block.id === toolCallId
                                ? { ...block, input: block.input + partialJson }
                                : block),
                        }
                        : msg),
                },
            }));
        },
        setToolCallInput: (messageId, toolCallId, fullInput) => {
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === messageId && msg.contentBlocks
                        ? {
                            ...msg,
                            contentBlocks: msg.contentBlocks.map(block => block.type === 'tool_use' && block.id === toolCallId
                                ? { ...block, input: fullInput }
                                : block),
                        }
                        : msg),
                },
            }));
        },
        updateToolCallStatus: (messageId, toolCallId, status, completedAt) => {
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === messageId && msg.contentBlocks
                        ? {
                            ...msg,
                            contentBlocks: msg.contentBlocks.map(block => block.type === 'tool_use' && block.id === toolCallId
                                ? { ...block, status, ...(completedAt ? { completedAt } : {}) }
                                : block),
                        }
                        : msg),
                },
            }));
        },
        addToolResultBlock: (messageId, toolUseId, content, isError) => {
            set((state) => ({
                session: {
                    ...state.session,
                    messages: state.session.messages.map(msg => msg.id === messageId
                        ? {
                            ...msg,
                            contentBlocks: [
                                ...(msg.contentBlocks || []),
                                { type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError },
                            ],
                        }
                        : msg),
                },
            }));
        },
        /**
         *
         */
        setThinking: (isThinking) => {
            set((state) => ({
                session: { ...state.session, isThinking },
            }));
        },
        /**
         *
         */
        setCompacting: (isCompacting) => {
            set((state) => ({
                session: { ...state.session, isCompacting },
            }));
        },
        /**
         *
         */
        setCurrentCommand: (command) => {
            set((state) => ({
                session: { ...state.session, currentCommand: command },
            }));
        },
        /**
         *
         */
        setError: (error) => {
            set((state) => ({
                session: { ...state.session, error },
            }));
        },
        /**
         *
         */
        setSessionId: (sessionId) => {
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
        restoreSession: (sessionId, messages) => {
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
        updateTokenUsage: (usage) => {
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
//# sourceMappingURL=sessionSlice.js.map