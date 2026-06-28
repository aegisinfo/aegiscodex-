/**
 * Store 模块测试
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
  console.log(`✅ ${msg}`);
}

function fail(msg: string, error?: any) {
  testsFailed++;
  console.log(`❌ ${msg}`);
  if (error) console.log(`   错误: ${error}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Store 模块测试');
  console.log('='.repeat(60));
  console.log();

  // ========== 测试 1: Store 实
  console.log('📝 测试 1: Store 实例');
  console.log('-'.repeat(40));

  if (vanillaStore && typeof vanillaStore.getState === 'function') {
    pass('vanillaStore 实例存在');
  } else {
    fail('vanillaStore 实例不存在');
  }

  const state = getState();
  if (state.session && state.config && state.app && state.focus && state.command) {
    pass('Store 包含所有 5 个 Slice');
  } else {
    fail('Store 缺少 Slice');
  }
  console.log();

  // ========== 测
  console.log('📝 测试 2: Session Slice');
  console.log('-'.repeat(40));

  const initialSessionId = getState().session.sessionId;
  if (initialSessionId && typeof initialSessionId === 'string') {
    pass(`初始 sessionId: ${initialSessionId.slice(0, 20)}...`);
  } else {
    fail('sessionId 无效');
  }

  // 添加消
  sessionActions().addUserMessage('Hello, test!');
  const messages = getState().session.messages;
  if (messages.length === 1 && messages[0].content === 'Hello, test!') {
    pass('addUserMessage 正常');
  } else {
    fail('addUserMessage 失败');
  }

  // 设
  sessionActions().setThinking(true);
  if (getState().session.isThinking === true) {
    pass('setThinking(true) 正常');
  } else {
    fail('setThinking 失败');
  }

  sessionActions().setThinking(false);

  // 清空消
  sessionActions().clearMessages();
  if (getState().session.messages.length === 0) {
    pass('clearMessages 正常');
  } else {
    fail('clearMessages 失败');
  }
  console.log();

  // ========== 测
  console.log('📝 测试 3: Config Slice');
  console.log('-'.repeat(40));

  // 初始状态 config 
  if (getConfig() === null) {
    pass('初始 config 为 null');
  } else {
    fail('初始 config 不为 null');
  }

  // 设置配
  const testConfig: RuntimeConfig = {
    default: { model: 'test-model' },
    theme: 'dark',
    defaultPermissionMode: 'default',
  };
  configActions().setConfig(testConfig);

  if (getConfig()?.default?.model === 'test-model') {
    pass('setConfig 正常');
  } else {
    fail('setConfig 失败');
  }

  // 更新配
  configActions().updateConfig({ theme: 'light' });
  if (getConfig()?.theme === 'light') {
    pass('updateConfig 正常');
  } else {
    fail('updateConfig 失败');
  }
  console.log();

  // ========== 测
  console.log('📝 测试 4: App Slice');
  console.log('-'.repeat(40));

  if (getState().app.initializationStatus === 'pending') {
    pass('初始 initializationStatus 为 pending');
  } else {
    fail('初始 initializationStatus 不正确');
  }

  appActions().setInitializationStatus('ready');
  if (getState().app.initializationStatus === 'ready') {
    pass('setInitializationStatus 正常');
  } else {
    fail('setInitializationStatus 失败');
  }

  // Todos
  appActions().addTodo({ id: '1', title: 'Test todo', status: 'pending', createdAt: Date.now() });
  if (getState().app.todos.length === 1) {
    pass('addTodo 正常');
  } else {
    fail('addTodo 失败');
  }

  appActions().updateTodo('1', { status: 'completed' });
  if (getState().app.todos[0].status === 'completed') {
    pass('updateTodo 正常');
  } else {
    fail('updateTodo 失败');
  }

  appActions().removeTodo('1');
  if (getState().app.todos.length === 0) {
    pass('removeTodo 正常');
  } else {
    fail('removeTodo 失败');
  }
  console.log();

  // ========== 测
  console.log('📝 测试 5: Focus Slice');
  console.log('-'.repeat(40));

  if (getState().focus.currentFocus === 'input') {
    pass('初始焦点为 input');
  } else {
    fail('初始焦点不正确');
  }

  focusActions().setFocus('messages');
  if (getState().focus.currentFocus === 'messages') {
    pass('setFocus 正常');
  } else {
    fail('setFocus 失败');
  }

  if (getState().focus.previousFocus === 'input') {
    pass('previousFocus 记录正确');
  } else {
    fail('previousFocus 记录不正确');
  }

  focusActions().restoreFocus();
  if (getState().focus.currentFocus === 'input') {
    pass('restoreFocus 正常');
  } else {
    fail('restoreFocus 失败');
  }
  console.log();

  // ========== 测
  console.log('📝 测试 6: Command Slice');
  console.log('-'.repeat(40));

  if (getState().command.isProcessing === false) {
    pass('初始 isProcessing 为 false');
  } else {
    fail('初始 isProcessing 不正确');
  }

  commandActions().setProcessing(true);
  if (getState().command.isProcessing === true) {
    pass('setProcessing 正常');
  } else {
    fail('setProcessing 失败');
  }

  // 命令队
  commandActions().enqueueCommand('command1');
  commandActions().enqueueCommand('command2');
  if (getState().command.pendingCommands.length === 2) {
    pass('enqueueCommand 正常');
  } else {
    fail('enqueueCommand 失败');
  }

  const cmd = commandActions().dequeueCommand();
  if (cmd === 'command1' && getState().command.pendingCommands.length === 1) {
    pass('dequeueCommand 正常');
  } else {
    fail('dequeueCommand 失败');
  }

  commandActions().clearQueue();
  if (getState().command.pendingCommands.length === 0) {
    pass('clearQueue 正常');
  } else {
    fail('clearQueue 失败');
  }

  // AbortController
  const controller = commandActions().createAbortController();
  if (controller instanceof AbortController) {
    pass('createAbortController 正常');
  } else {
    fail('createAbortController 失败');
  }

  commandActions().abort();
  if (getState().command.isProcessing === false && getState().command.abortController === null) {
    pass('abort 正常');
  } else {
    fail('abort 失败');
  }
  console.log();

  // ========== 测试 7: 订阅功
  console.log('📝 测试 7: 订阅功能');
  console.log('-'.repeat(40));

  let subscriptionTriggered = false;
  const unsubscribe = subscribeToMessages((messages) => {
    subscriptionTriggered = true;
  });

  sessionActions().addUserMessage('Trigger subscription');
  
  // 等待一下让订阅触
  await new Promise((resolve) => setTimeout(resolve, 10));

  if (subscriptionTriggered) {
    pass('subscribeToMessages 正常触发');
  } else {
    fail('subscribeToMessages 未触发');
  }

  unsubscribe();
  console.log();

  // ========== 测试总
  console.log('='.repeat(60));
  console.log(`测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// 运行测
runTests().catch((error) => {
  console.error('测试出错:', error);
  process.exit(1);
});
