import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Completed messages go into Ink's <Static> (terminal scrollback, rendered once).
 * The active streaming message stays in the dynamic area so it updates live.
 * Input area is always visible at the bottom of the terminal.
 *
 * Why bypass the store for streaming content?
 *   vanillaStore.setState() triggers the subscription on every delta, forcing
 *   full Ink reconciliation and a visible terminal "blink" at every tick.
 *   The RAF loop polls the mutable buffer directly and only bumps a LOCAL
 *   counter (streamingVersion) — only MessageList re-renders, nothing else.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Static } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, resetConsumerPosition, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';
const RAF_INTERVAL_MS = 500; // 2fps redraws — reduces terminal blink significantly
const CONTENT_THRESHOLD = 15; // batch more chars before triggering repaint
export const MessageList = React.memo(({ terminalWidth }) => {
    const [messages, setMessages] = useState(() => getState().session.messages);
    const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
    const [streamingVersion, setStreamingVersion] = useState(0);
    const lastContentLenRef = useRef({});
    const messagesRef = useRef(messages);
    messagesRef.current = messages;
    const showAllThinkingRef = useRef(showAllThinking);
    showAllThinkingRef.current = showAllThinking;
    useEffect(() => {
        let rafId = null;
        let lastRafTime = 0;
        const pollBuffer = (now) => {
            if (now - lastRafTime < RAF_INTERVAL_MS) {
                rafId = requestAnimationFrame(pollBuffer);
                return;
            }
            lastRafTime = now;
            const buffer = getStreamingContent();
            const state = vanillaStore.getState();
            const streamingMsg = state.session.messages.find(m => m.isStreaming && isActiveStreamingMessage(m));
            if (buffer && streamingMsg) {
                const lastLen = lastContentLenRef.current[streamingMsg.id] || { content: 0, thinking: 0 };
                if (lastLen.content > buffer.content.length || lastLen.thinking > buffer.thinking.length) {
                    lastContentLenRef.current[streamingMsg.id] = { content: 0, thinking: 0 };
                }
                const updatedLastLen = lastContentLenRef.current[streamingMsg.id] || { content: 0, thinking: 0 };
                const deltaContent = buffer.content.length - updatedLastLen.content;
                const deltaThinking = buffer.thinking.length - updatedLastLen.thinking;
                if (deltaContent >= CONTENT_THRESHOLD || deltaThinking >= CONTENT_THRESHOLD) {
                    lastContentLenRef.current[streamingMsg.id] = {
                        content: buffer.content.length,
                        thinking: buffer.thinking.length,
                    };
                    resetConsumerPosition();
                    setStreamingVersion(v => v + 1);
                }
            }
            rafId = requestAnimationFrame(pollBuffer);
        };
        rafId = requestAnimationFrame(pollBuffer);
        const unsub = vanillaStore.subscribe((state) => {
            const newMessages = state.session.messages;
            const newShowAllThinking = state.app.showAllThinking;
            const prevMessages = messagesRef.current;
            let messagesChanged = false;
            if (newMessages.length !== prevMessages.length) {
                messagesChanged = true;
            }
            else {
                for (let i = 0; i < newMessages.length; i++) {
                    const a = prevMessages[i];
                    const b = newMessages[i];
                    if (a.id !== b.id || a.isStreaming !== b.isStreaming || a.content !== b.content || a.thinking !== b.thinking || a.contentBlocks !== b.contentBlocks) {
                        messagesChanged = true;
                        break;
                    }
                }
            }
            if (messagesChanged)
                setMessages([...newMessages]);
            if (newShowAllThinking !== showAllThinkingRef.current)
                setShowAllThinking(newShowAllThinking);
            newMessages.forEach(msg => {
                if (!msg.isStreaming)
                    delete lastContentLenRef.current[msg.id];
            });
        });
        return () => {
            if (rafId !== null)
                cancelAnimationFrame(rafId);
            unsub();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Layout strategy:
    //   During streaming: ALL completed messages → Static (scrollback).
    //     Only the streaming message is in the dynamic area, so Ink only
    //     repaints that one element every RAF tick — no blink from repainting
    //     large completed messages (e.g. /multi output).
    //   When idle (no streaming): last completed message stays in the dynamic
    //     area so slash command results (/multi etc.) are immediately visible
    //     instead of being swallowed into scrollback.
    const completedMessages = messages.filter(msg => !msg.isStreaming);
    const streamingMsg = messages.find(msg => msg.isStreaming && isActiveStreamingMessage(msg));
    const buffer = streamingMsg ? getStreamingContent() : null;
    // During streaming keep everything in Static; when idle surface the last message.
    const staticMessages = streamingMsg ? completedMessages : completedMessages.slice(0, -1);
    const lastCompleted = streamingMsg ? null : completedMessages.at(-1);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Static, { items: staticMessages, children: (msg, index) => (_jsx(MessageRenderer, { content: msg.content, role: msg.role, terminalWidth: terminalWidth, showPrefix: true, thinking: msg.thinking, isStreaming: false, showAllThinking: showAllThinking, contentBlocks: msg.contentBlocks }, msg.id || index)) }), lastCompleted && (_jsx(MessageRenderer, { content: lastCompleted.content, role: lastCompleted.role, terminalWidth: terminalWidth, showPrefix: true, thinking: lastCompleted.thinking, isStreaming: false, showAllThinking: showAllThinking, contentBlocks: lastCompleted.contentBlocks }, lastCompleted.id)), streamingMsg && (_jsx(MessageRenderer, { content: buffer ? streamingMsg.content + buffer.content : streamingMsg.content, role: streamingMsg.role, terminalWidth: terminalWidth, showPrefix: true, thinking: buffer ? (streamingMsg.thinking || '') + buffer.thinking : streamingMsg.thinking, isStreaming: true, showAllThinking: showAllThinking, contentBlocks: streamingMsg.contentBlocks }, streamingMsg.id))] }));
});
MessageList.displayName = 'MessageList';
export default MessageList;
//# sourceMappingURL=MessageList.js.map