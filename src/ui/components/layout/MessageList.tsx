/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * KEY DESIGN: Streaming content NEVER goes through the zustand store.
 * The store holds committed (non-streaming) messages + the message stub
 * from startStreamingMessage (with isStreaming flag). Content deltas are
 * appended to the mutable streaming buffer (streaming-buffer.ts).
 *
 * The RAF loop polls the buffer for new content and triggers a LOCAL
 * re-render (via streamingVersion counter) without touching the store.
 * During render, we merge store message content with live buffer content
 * for the active streaming message.
 *
 * Why bypass the store for streaming?
 *   vanillaStore.setState() triggers the store subscription, which calls
 *   setMessages([...state.session.messages]) — a NEW ARRAY EVERY TIME.
 *   This forces Ink to reconcile the entire tree and repaint the terminal,
   *   causing a visible "blink" at every RAF tick (~20fps).
 *
 *   By reading the buffer directly in render and using local state for
 *   re-render signalling, we eliminate store→subscription→re-render
 *   cascades. Only MessageList re-renders, and React.memo on MessageRenderer
 *   prevents re-processing unchanged messages.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, resetConsumerPosition, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';

interface MessageListProps {
  terminalWidth: number;
}

const RAF_INTERVAL_MS = 200; // ~5fps — fewer repaints = less blink; still responsive for terminal
const CONTENT_THRESHOLD = 5; // min chars accumulated before triggering re-render (reduces flicker on small deltas)

export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  // Local counter bumped by the RAF loop when buffer content grows.
  // Triggers a re-render that reads fresh content from the buffer directly.
  const [streamingVersion, setStreamingVersion] = useState(0);

  // Track last-seen content & thinking length per streaming message to avoid dupes
  // Separate tracking is needed because thinking often arrives ahead of content (DeepSeek, etc.)
  const lastContentLenRef = useRef<Record<string, { content: number; thinking: number }>>({});

  useEffect(() => {
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    let lastRafTime = 0;

    /**
     * RAF loop: poll the mutable streaming buffer for new content.
     * When content is found, bump streamingVersion to trigger a local
     * re-render. NEVER writes to the zustand store — the store is only
     * updated when streaming starts/finishes or on explicit flushes
     * (flushStreamBuffer, finishStreamingMessage).
     */
    const pollBuffer = (now: number) => {
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

        // Detect buffer re-initialization (after flushStreamBuffer) — reset tracking
        // so new content after a tool call triggers re-renders correctly.
        if (lastLen.content > buffer.content.length || lastLen.thinking > buffer.thinking.length) {
          lastContentLenRef.current[streamingMsg.id] = { content: 0, thinking: 0 };
        }

        const updatedLastLen = lastContentLenRef.current[streamingMsg.id] || { content: 0, thinking: 0 };
        const deltaContent = buffer.content.length - updatedLastLen.content;
        const deltaThinking = buffer.thinking.length - updatedLastLen.thinking;

        // Only re-render when enough new content accumulates (threshold)
        // or when streaming finishes (final flush). Small character-by-character
        // arrivals are batched — reduces visible terminal flickering.
        if (deltaContent >= CONTENT_THRESHOLD || deltaThinking >= CONTENT_THRESHOLD) {
          lastContentLenRef.current[streamingMsg.id] = {
            content: buffer.content.length,
            thinking: buffer.thinking.length,
          };
          // Keep consumer position in sync so finishStreamingMessage only
          // flushes content the RAF loop hasn't already displayed.
          resetConsumerPosition();
          // Trigger local re-render — does NOT touch the store, so no
          // cascading subscription callbacks across the app.
          setStreamingVersion(v => v + 1);
        }
      }

      rafId = requestAnimationFrame(pollBuffer);
    };

    // Start RAF loop
    rafId = requestAnimationFrame(pollBuffer);

    // Store subscription for non-streaming updates only (new messages,
    // streaming flag changes, showAllThinking toggle, etc.)
    const unsub = vanillaStore.subscribe((state) => {
      setMessages([...state.session.messages]);
      setShowAllThinking(state.app.showAllThinking);

      // Clean up position tracking for finished messages
      state.session.messages.forEach(msg => {
        if (!msg.isStreaming) {
          delete lastContentLenRef.current[msg.id];
        }
      });
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsub();
    };
    // streamingVersion is intentionally NOT in deps — it's set by the RAF loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box flexDirection="column">
      {messages.map((msg, index) => {
        // For the active streaming message, MERGE store content (committed
        // by flushStreamBuffer/finishStreamingMessage) with live buffer
        // content (uncommitted streaming deltas). This avoids
        // store→subscription→re-render cascades.
        if (msg.isStreaming && isActiveStreamingMessage(msg)) {
          const buffer = getStreamingContent();
          if (buffer) {
            // msg.content has base content from flushStreamBuffer or initial '';
            // buffer.content has deltas since last flush/init.
            // Merge them so flushed content doesn't disappear.
            return (
              <MessageRenderer
                key={msg.id || index}
                content={msg.content + buffer.content}
                role={msg.role}
                terminalWidth={terminalWidth}
                showPrefix={true}
                thinking={(msg.thinking || '') + buffer.thinking}
                isStreaming={true}
                showAllThinking={showAllThinking}
                contentBlocks={msg.contentBlocks}
              />
            );
          }
        }

        return (
          <MessageRenderer
            key={msg.id || index}
            content={msg.content}
            role={msg.role}
            terminalWidth={terminalWidth}
            showPrefix={true}
            thinking={msg.thinking}
            isStreaming={msg.isStreaming}
            showAllThinking={showAllThinking}
            contentBlocks={msg.contentBlocks}
          />
        );
      })}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
