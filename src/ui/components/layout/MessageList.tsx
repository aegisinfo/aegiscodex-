/**
 * MessageList - RAF-driven polling renderer with zero store delta updates
 *
 * Does NOT subscribe to per-delta store updates. Instead, uses a RAF loop
 * that polls the store directly and only calls setMessages when content
 * actually changed (by reference of the relevant streaming message).
 *
 * During streaming, content deltas go to an external mutable buffer
 * (streaming-buffer.ts) instead of the zustand store. This means NO
 * store subscriber gets notified during streaming — zero cascade re-renders.
 *
 * The RAF loop reads BOTH the store and the streaming buffer, merging
 * them for display. This eliminates terminal flickering entirely.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import {
  getStreamingContent,
  isActiveStreamingMessage,
} from '../../../store/streaming-buffer.js';

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

  // showAllThinking from store subscription (only changes on user toggle)
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const val = state.app.showAllThinking;
      setShowAllThinking(prev => prev !== val ? val : prev);
    });
    return unsub;
  }, []);

  const startRafLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;

    // Track the last consumed buffer length so we don't re-append old content
    const lastConsumedLen = { content: 0, thinking: 0 };

    const poll = () => {
      // Re-check streaming state from the actual store each poll
      const currentMsgs = getState().session.messages;
      const stillStreaming = currentMsgs.some(m => m.isStreaming);
      if (!stillStreaming) {
        isStreamingRef.current = false;
        rafIdRef.current = null;
        return;
      }

      // Read from store AND merge with streaming buffer
      const msgs = getState().session.messages;
      const streamingIdx = msgs.findIndex(m => m.isStreaming);

      if (streamingIdx === -1) {
        // Streaming ended — store the latest
        messagesRef.current = msgs;
        setMessages([...msgs]);
        rafIdRef.current = requestAnimationFrame(poll);
        return;
      }

      // Merge: only append NEW buffer content (since last poll)
      const buf = getStreamingContent();
      let mergedMsgs = msgs;
      if (buf) {
        const newContent = buf.content.slice(lastConsumedLen.content);
        const newThinking = buf.thinking.slice(lastConsumedLen.thinking);

        if (newContent || newThinking) {
          lastConsumedLen.content = buf.content.length;
          lastConsumedLen.thinking = buf.thinking.length;

          mergedMsgs = msgs.map((msg, i) => {
            if (i === streamingIdx) {
              return {
                ...msg,
                content: msg.content + newContent,
                thinking: (msg.thinking || '') + newThinking,
              };
            }
            return msg;
          });

          messagesRef.current = mergedMsgs;
          setMessages([...mergedMsgs]);
        }
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

  // Lightweight subscription: only detect START/END of streaming and message count changes.
  // During streaming, content deltas go to the streaming buffer — not the store — so
  // this subscription only fires when streaming starts, stops, or a new message is added.
  useEffect(() => {
    let prevHasStreaming = false;

    const unsub = vanillaStore.subscribe((state) => {
      const msgs = state.session.messages;
      const len = msgs.length;

      // New message was added (user/assistant) — update immediately
      if (len !== lastLenRef.current) {
        lastLenRef.current = len;
        messagesRef.current = msgs;
        setMessages([...msgs]);
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
          // Final flush: grab latest content from the store
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
  }, [startRafLoop, stopRafLoop]);

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
