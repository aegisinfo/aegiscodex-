/**
 * MessageList - RAF-driven polling renderer
 *
 * Does NOT subscribe to per-delta store updates. Instead, uses a RAF loop
 * that polls the store directly and only calls setMessages when content
 * actually changed (by reference of the relevant streaming message).
 *
 * This avoids cascading re-renders from per-delta zustand subscription
 * callbacks (which fire on every tiny content append because the messages
 * array is always a new reference).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';

interface MessageListProps {
  terminalWidth: number;
}

/**
 * MessageList - polls at ~60fps only when streaming is active.
 */
export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const messagesRef = useRef(messages);
  const rafIdRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const lastLenRef = useRef(messages.length);

  // showAllThinking from store subscription
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const val = state.app.showAllThinking;
      setShowAllThinking(prev => prev !== val ? val : prev);
    });
    return unsub;
  }, []);

  // Lightweight subscription: only detect START/END of streaming and message count changes.
  // Uses a direct equality check with messagesRef to avoid firing on every delta
  // (zustand creates new arrays on appendToStreamingMessage, but the RAF poll handles
  // those — we only need to know when streaming state transitions happen).
  useEffect(() => {
    let prevHasStreaming = false;

    const unsub = vanillaStore.subscribe((state) => {
      const msgs = state.session.messages;
      const len = msgs.length;

      // New message was added (user/assistant) — update immediately
      if (len !== lastLenRef.current) {
        lastLenRef.current = len;
        messagesRef.current = msgs;
        setMessages(msgs);
        return;
      }

      // Check if streaming just started or stopped
      const hasStreaming = msgs.some(m => m.isStreaming);
      if (hasStreaming !== prevHasStreaming) {
        prevHasStreaming = hasStreaming;
        isStreamingRef.current = hasStreaming;
        if (hasStreaming) {
          startRafLoop();
        } else {
          stopRafLoop();
          // Final flush: grab latest content from store directly
          const fresh = getState().session.messages;
          messagesRef.current = fresh;
          setMessages([...fresh]);
        }
      }
    });

    return () => {
      unsub();
      stopRafLoop();
    };
  }, []);

  const startRafLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;

    // Track the last known streaming message content length to detect real changes.
    // Since we mutate in-place (no new object refs), we compare content length.
    const lastStreamingLen = { content: 0, thinking: 0 };

    const poll = () => {
      if (!isStreamingRef.current) {
        rafIdRef.current = null;
        return;
      }

      // ALWAYS read from store directly — messagesRef is stale during in-place mutation
      const msgs = getState().session.messages;
      const streamingIdx = msgs.findIndex(m => m.isStreaming);

      if (streamingIdx === -1) {
        // Streaming ended — store the latest
        messagesRef.current = msgs;
        setMessages([...msgs]);
        rafIdRef.current = requestAnimationFrame(poll);
        return;
      }

      const streaming = msgs[streamingIdx];
      const cLen = streaming.content.length;
      const tLen = (streaming.thinking || '').length;

      if (cLen !== lastStreamingLen.content || tLen !== lastStreamingLen.thinking) {
        lastStreamingLen.content = cLen;
        lastStreamingLen.thinking = tLen;
        messagesRef.current = msgs;
        // Spread to trigger React re-render (new array reference)
        setMessages([...msgs]);
      }

      rafIdRef.current = requestAnimationFrame(poll);
    };

    rafIdRef.current = requestAnimationFrame(poll);
  }, []);

  const stopRafLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopRafLoop();
  }, [stopRafLoop]);

  return (
    <Box flexDirection="column">
      {messages.map((msg, index) => (
        <MessageRenderer
          key={msg.id || index}
          content={msg.content}
          role={msg.role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={msg.thinking}
          isStreaming={msg.isStreaming}
          showAllThinking={showAllThinking}
        />
      ))}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
