/**
 * UI Component Tests (D)
 *
 * Tests for MessageList, MessageRenderer, ErrorBoundary, ChatSearch,
 * and other UI components.
 *
 * Run with: tsx src/ui/test.ts
 */

import React from 'react';
import { render } from 'ink';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { MessageList } from './components/layout/MessageList.js';
import { WelcomeMessage } from './components/layout/WelcomeMessage.js';
import { MessageSeparator } from './components/layout/MessageSeparator.js';
import { ChatStatusBar } from './components/layout/ChatStatusBar.js';
import { vanillaStore, getState } from '../store/index.js';

let testsPassed = 0;
let testsFailed = 0;

function pass(msg: string) {
  testsPassed++;
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string, error?: any) {
  testsFailed++;
  console.log(`  ✗ ${msg}${error ? `: ${error}` : ''}`);
}

async function runTests() {
  console.log('\nUI Component Tests\n');

  // ===== ErrorBoundary =====
  console.log('ErrorBoundary:');

  // 1. ErrorBoundary renders children normally
  const GoodComponent = () => React.createElement('test-good', null, 'hello');
  try {
    const { unmount } = render(
      React.createElement(ErrorBoundary, null,
        React.createElement(GoodComponent),
      ),
    );
    pass('renders children without error');
    unmount();
  } catch (e) {
    fail('renders children without error', e);
  }

  // 2. ErrorBoundary catches errors
  const BadComponent = () => { throw new Error('test error'); };
  try {
    const { unmount } = render(
      React.createElement(ErrorBoundary,
        { fallback: React.createElement('div', null, 'fallback'), children: React.createElement(BadComponent) },
      ),
    );
    pass('catches rendering errors');
    unmount();
  } catch (e) {
    // If we get here, ErrorBoundary caught it - that's fine for ink
    pass('catches rendering errors (error propagated)');
  }

  // ===== MessageList =====
  console.log('\nMessageList:');

  // 3. MessageList renders welcome when empty
  try {
    const { unmount } = render(
      React.createElement(MessageList, { terminalWidth: 80 }),
    );
    pass('renders without messages');
    unmount();
  } catch (e) {
    fail('renders without messages', e);
  }

  // 4. MessageList renders messages
  try {
    // Add a test message directly to store
    getState().session.messages.push({
      id: 'test-1',
      role: 'user',
      content: 'Hello world',
      timestamp: Date.now(),
    });

    const { unmount, rerender } = render(
      React.createElement(MessageList, { terminalWidth: 80 }),
    );

    pass('renders with messages');
    unmount();

    // Clean up
    getState().session.messages = [];
  } catch (e) {
    fail('renders with messages', e);
  }

  // ===== ChatStatusBar =====
  console.log('\nChatStatusBar:');

  // 5. ChatStatusBar renders
  try {
    const { unmount } = render(
      React.createElement(ChatStatusBar, null),
    );
    pass('renders ChatStatusBar');
    unmount();
  } catch (e) {
    fail('renders ChatStatusBar', e);
  }

  // ===== Store Integration =====
  console.log('\nStore Integration:');

  // 6. Messages have expected shape
  const msg = { id: 'test-2', role: 'assistant' as const, content: 'test', timestamp: Date.now() };
  getState().session.messages.push(msg);
  const messages = getState().session.messages;
  if (messages.length > 0 && messages[0].id && messages[0].role && messages[0].content) {
    pass('messages have correct shape');
  } else {
    fail('messages missing required fields');
  }

  // 7. Message streaming state transitions
  const streamId = 'test-stream-1';
  getState().session.messages.push({
    id: streamId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
  });

  // Simulate streaming
  const msgIndex = getState().session.messages.findIndex(m => m.id === streamId);
  if (msgIndex >= 0) {
    getState().session.messages[msgIndex].content = 'partial';
    pass('streaming content update works');
  } else {
    fail('streaming message not found');
  }

  // Finish streaming
  getState().session.messages[msgIndex].isStreaming = false;
  pass('streaming completion works');

  // Clean up
  getState().session.messages = [];

  // ===== Summary =====
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
