/**
 * MessageList — renders messages with RAF-throttled streaming content.
 *
 * SCROLL FIX:
 *   During streaming, Ink must not render a growing message body in its
 *   dynamic area. A growing render area forces Ink to erase+redraw more
 *   lines on every RAF tick, and the cursor movement auto-scrolls the
 *   terminal back to the bottom — preventing the user from scrolling up.
 *
 *   Solution:
 *     - Committed messages → <Static> (terminal scrollback, rendered once)
 *     - Active streaming → a FIXED-HEIGHT 1-line indicator only
 *     - Streaming text is flushed to a second <Static> list as completed
 *       lines accumulate, so the user can scroll up to read it
 *     - When streaming finishes, the full message goes to committed Static
 *       (with markdown) and the streaming chunks are superseded
 *
 *   Result: Ink's total dynamic area is ~4–5 lines (indicator + input +
 *   status bar). Cursor movement is minimal; terminal scroll works freely.
 *
 * STREAMING TEXT:
 *   Streaming content bypasses the zustand store (see streaming-buffer.ts).
 *   The RAF loop polls the buffer and flushes completed lines to
 *   streamingChunks, which renders via its own <Static> list.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Static } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, resetConsumerPosition, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';
import { themeManager } from '../../themes/index.js';

interface MessageListProps {
  terminalWidth: number;
}

// How often to flush streaming chunks to Static (ms)
const FLUSH_INTERVAL_MS = 400;
// Min new chars before flushing a chunk to Static
const FLUSH_THRESHOLD = 80;

interface StreamChunk {
  id: string;
  text: string;
}

export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  // Chunks of completed streaming lines flushed to Static progressively
  const [streamingChunks, setStreamingChunks] = useState<StreamChunk[]>([]);
  // Char count shown in the streaming indicator
  const [streamedChars, setStreamedChars] = useState(0);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const showAllThinkingRef = useRef(showAllThinking);
  showAllThinkingRef.current = showAllThinking;

  // Track flushed position in the buffer content string per streaming message
  const flushedPosRef = useRef<Record<string, number>>({});
  const chunkCountRef = useRef(0);
  const lastFlushTimeRef = useRef(Date.now());
  // Track which message IDs were progressively flushed (skip them in committed Static)
  const streamFlushedIdsRef = useRef<Set<string>>(new Set());

  const resetStreamState = useCallback((msgId: string) => {
    delete flushedPosRef.current[msgId];
  }, []);

  useEffect(() => {
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    let lastRafTime = 0;

    const pollBuffer = (_now: number) => {
      // Use Date.now() instead of the RAF timestamp — the Node.js RAF polyfill
      // calls cb() with no arguments, making `now` undefined (NaN), which breaks
      // all time-based comparisons like (now - lastRafTime < FLUSH_INTERVAL_MS).
      const now = Date.now();
      if (now - lastRafTime < FLUSH_INTERVAL_MS) {
        rafId = requestAnimationFrame(pollBuffer);
        return;
      }
      lastRafTime = now;

      const buffer = getStreamingContent();
      const state = vanillaStore.getState();
      const streamingMsg = state.session.messages.find(m => m.isStreaming && isActiveStreamingMessage(m));

      if (buffer && streamingMsg) {
        // Full content so far = committed store content + live buffer deltas
        const fullContent = (streamingMsg.content ?? '') + buffer.content;
        const flushedPos = flushedPosRef.current[streamingMsg.id] ?? 0;

        // Find the last newline in content after the already-flushed position
        const unflushed = fullContent.slice(flushedPos);
        const lastNewline = unflushed.lastIndexOf('\n');

        if (lastNewline >= FLUSH_THRESHOLD || (now - lastFlushTimeRef.current > 2000 && unflushed.length > 0)) {
          // Flush completed lines (up to and including the last \n)
          const toFlush = lastNewline >= 0 ? unflushed.slice(0, lastNewline + 1) : unflushed;
          if (toFlush.trim()) {
            const newFlushedPos = flushedPos + toFlush.length;
            flushedPosRef.current[streamingMsg.id] = newFlushedPos;
            lastFlushTimeRef.current = now;
            chunkCountRef.current++;
            const chunkId = `${streamingMsg.id}-chunk-${chunkCountRef.current}`;
            streamFlushedIdsRef.current.add(streamingMsg.id);
            setStreamingChunks(prev => [...prev, { id: chunkId, text: toFlush }]);
          }
        }

        // Update char count for the indicator
        const total = fullContent.length;
        setStreamedChars(total);
        resetConsumerPosition();
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
      } else {
        for (let i = 0; i < newMessages.length; i++) {
          const a = prevMessages[i];
          const b = newMessages[i];
          if (
            a.id !== b.id ||
            a.isStreaming !== b.isStreaming ||
            a.content !== b.content ||
            a.thinking !== b.thinking ||
            a.contentBlocks !== b.contentBlocks
          ) {
            messagesChanged = true;
            break;
          }
        }
      }

      if (messagesChanged) {
        setMessages([...newMessages]);
        // When streaming finishes, flush any remaining content not yet in chunks.
        // Short responses (< FLUSH_THRESHOLD, no newlines, fast arrival) may complete
        // before the RAF loop runs — the committed msg.content has the full text,
        // so we flush it here as a final chunk to guarantee it appears on screen.
        newMessages.forEach(msg => {
          const wasStreaming = prevMessages.find(m => m.id === msg.id)?.isStreaming;
          if (!msg.isStreaming && wasStreaming && !streamFlushedIdsRef.current.has(msg.id)) {
            // Mark as flushed immediately to prevent duplicate flushes when the
            // subscription fires multiple times before React re-renders (e.g.
            // finishStreamingMessage followed by setThinking in the same tick).
            streamFlushedIdsRef.current.add(msg.id);
            const flushedPos = flushedPosRef.current[msg.id] ?? 0;
            const fullContent = msg.content ?? '';
            const remaining = fullContent.slice(flushedPos);
            if (remaining.trim()) {
              chunkCountRef.current++;
              const chunkId = `${msg.id}-chunk-${chunkCountRef.current}`;
              setStreamingChunks(prev => [...prev, { id: chunkId, text: remaining }]);
            }
            delete flushedPosRef.current[msg.id];
          } else if (!msg.isStreaming && flushedPosRef.current[msg.id] !== undefined) {
            resetStreamState(msg.id);
          }
        });
      }
      if (newShowAllThinking !== showAllThinkingRef.current) {
        setShowAllThinking(newShowAllThinking);
      }
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = themeManager.getTheme();
  const streamingMsg = messages.find(m => m.isStreaming && isActiveStreamingMessage(m));

  // Committed messages: exclude ones progressively flushed to streamingChunks Static
  // (they're already in the scrollback as plain text; adding them again would duplicate)
  const committedMessages = messages.filter(
    m => !m.isStreaming && !streamFlushedIdsRef.current.has(m.id)
  );

  return (
    <Box flexDirection="column">
      {/* Committed messages — rendered once with full markdown into terminal scrollback */}
      <Static items={committedMessages}>
        {(msg) => (
          <MessageRenderer
            key={msg.id}
            content={msg.content}
            role={msg.role}
            terminalWidth={terminalWidth}
            showPrefix={true}
            thinking={msg.thinking}
            isStreaming={false}
            showAllThinking={showAllThinking}
            contentBlocks={msg.contentBlocks}
          />
        )}
      </Static>

      {/* Progressive streaming chunks — plain text lines flushed as they complete */}
      <Static items={streamingChunks}>
        {(chunk) => (
          <Text key={chunk.id} color={theme.colors.text.primary}>{chunk.text}</Text>
        )}
      </Static>

      {/* FIXED-HEIGHT streaming indicator — replaces the growing message render.
          Ink's dynamic area stays ~4–5 lines regardless of response length. */}
      {streamingMsg && (
        <Box marginLeft={2} marginBottom={0}>
          <Text color={theme.colors.primary}>◆</Text>
          <Text color={theme.colors.text.muted} dimColor>
            {`  generating${streamedChars > 0 ? `  ${streamedChars.toLocaleString()} chars` : ''}`}
          </Text>
        </Box>
      )}
    </Box>
  );
});

MessageList.displayName = 'MessageList';
export default MessageList;
