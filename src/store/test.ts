/**
 * 
 * 
 */

import {
  vanillaStore,
  getState,
  sessionActions,
  configActions,
  appActions,
  focusActions,
  commandActions,
  getConfig,
  ensureStoreInitialized,
  subscribeToMessages,
} from './index.js';
import type { RuntimeConfig } from '../config/types.js';

let testsPassed = 0;
let testsFailed = 0;

function pass(msg: string) {
  testsPassed++;
}

function fail(msg: string, error?: any) {
  testsFailed++;
  if (error)
}

async function runTests() {

  if (vanillaStore && typeof vanillaStore.getState === 'function') {
    pass('vanillaStore ');
  } else {
    fail('vanillaStore ');
  }

  const state = getState();
  if (state.session && state.config && state.app && state.focus && state.command) {
    pass('Store  5  Slice');
  } else {
    fail('Store  Slice');
  }

  const initialSessionId = getState().session.sessionId;
  if (initialSessionId && typeof initialSessionId === 'string') {
    pass(` sessionId: ${initialSessionId.slice(0, 20)}...`);
  } else {
    fail('sessionId ');
  }
  sessionActions().addUserMessage('Hello, test!');
  const messages = getState().session.messages;
  if (messages.length === 1 && messages[0].content === 'Hello, test!') {
    pass('addUserMessage ');
  } else {
    fail('addUserMessage ');
  }
  sessionActions().setThinking(true);
  if (getState().session.isThinking === true) {
    pass('setThinking(true) ');
  } else {
    fail('setThinking ');
  }

  sessionActions().setThinking(false);
  sessionActions().clearMessages();
  if (getState().session.messages.length === 0) {
    pass('clearMessages ');
  } else {
    fail('clearMessages ');
  }

  if (getConfig() === null) {
    pass(' config  null');
  } else {
    fail(' config  null');
  }
  const testConfig: RuntimeConfig = {
    default: { model: 'test-model' },
    theme: 'dark',
    defaultPermissionMode: 'default',
  };
  configActions().setConfig(testConfig);

  if (getConfig()?.default?.model === 'test-model') {
    pass('setConfig ');
  } else {
    fail('setConfig ');
  }
  configActions().updateConfig({ theme: 'light' });
  if (getConfig()?.theme === 'light') {
    pass('updateConfig ');
  } else {
    fail('updateConfig ');
  }

  if (getState().app.initializationStatus === 'pending') {
    pass(' initializationStatus  pending');
  } else {
    fail(' initializationStatus ');
  }

  appActions().setInitializationStatus('ready');
  if (getState().app.initializationStatus === 'ready') {
    pass('setInitializationStatus ');
  } else {
    fail('setInitializationStatus ');
  }

  // Todos
  appActions().addTodo({ id: '1', title: 'Test todo', status: 'pending', createdAt: Date.now() });
  if (getState().app.todos.length === 1) {
    pass('addTodo ');
  } else {
    fail('addTodo ');
  }

  appActions().updateTodo('1', { status: 'completed' });
  if (getState().app.todos[0].status === 'completed') {
    pass('updateTodo ');
  } else {
    fail('updateTodo ');
  }

  appActions().removeTodo('1');
  if (getState().app.todos.length === 0) {
    pass('removeTodo ');
  } else {
    fail('removeTodo ');
  }

  if (getState().focus.currentFocus === 'input') {
    pass(' input');
  } else {
    fail('');
  }

  focusActions().setFocus('messages');
  if (getState().focus.currentFocus === 'messages') {
    pass('setFocus ');
  } else {
    fail('setFocus ');
  }

  if (getState().focus.previousFocus === 'input') {
    pass('previousFocus ');
  } else {
    fail('previousFocus ');
  }

  focusActions().restoreFocus();
  if (getState().focus.currentFocus === 'input') {
    pass('restoreFocus ');
  } else {
    fail('restoreFocus ');
  }

  if (getState().command.isProcessing === false) {
    pass(' isProcessing  false');
  } else {
    fail(' isProcessing ');
  }

  commandActions().setProcessing(true);
  if (getState().command.isProcessing === true) {
    pass('setProcessing ');
  } else {
    fail('setProcessing ');
  }
  commandActions().enqueueCommand('command1');
  commandActions().enqueueCommand('command2');
  if (getState().command.pendingCommands.length === 2) {
    pass('enqueueCommand ');
  } else {
    fail('enqueueCommand ');
  }

  const cmd = commandActions().dequeueCommand();
  if (cmd === 'command1' && getState().command.pendingCommands.length === 1) {
    pass('dequeueCommand ');
  } else {
    fail('dequeueCommand ');
  }

  commandActions().clearQueue();
  if (getState().command.pendingCommands.length === 0) {
    pass('clearQueue ');
  } else {
    fail('clearQueue ');
  }

  // AbortController
  const controller = commandActions().createAbortController();
  if (controller instanceof AbortController) {
    pass('createAbortController ');
  } else {
    fail('createAbortController ');
  }

  commandActions().abort();
  if (getState().command.isProcessing === false && getState().command.abortController === null) {
    pass('abort ');
  } else {
    fail('abort ');
  }

  let subscriptionTriggered = false;
  const unsubscribe = subscribeToMessages((messages) => {
    subscriptionTriggered = true;
  });

  sessionActions().addUserMessage('Trigger subscription');
  await new Promise((resolve) => setTimeout(resolve, 10));

  if (subscriptionTriggered) {
    pass('subscribeToMessages ');
  } else {
    fail('subscribeToMessages ');
  }

  unsubscribe();

  if (testsFailed > 0) {
    process.exit(1);
  }
}
runTests().catch((error) => {
  console.error(':', error);
  process.exit(1);
});
