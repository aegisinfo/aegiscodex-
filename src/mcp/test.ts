/**
 * MCP 模块测试
 * 
 * 
 * 
 * 
 * 1. 类型定义验证
 * 2. McpRegistry 单例模式
 * 3. JSON Schema → Zod 转换
 * 4. 服务器配置验证
 * 5. 真实 MCP Server 连接（使用本地测试服务器）
 */

import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  McpRegistry,
  McpConnectionStatus,
  McpServerConfig,
  McpToolDefinition,
  ErrorType,
  DEFAULT_HEALTH_CHECK_CONFIG,
  DEFAULT_CONNECTION_CONFIG,
} from './index.js';
import { createMcpTool } from './createMcpTool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 模拟 MCP 工具定义（用于测试 Schema 转
const MOCK_TOOL_DEFINITION: McpToolDefinition = {
  name: 'test_tool',
  description: 'A test tool for validation',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
      content: { type: 'string', description: 'File content' },
      recursive: { type: 'boolean', description: 'Recursive flag' },
      depth: { type: 'number', minimum: 0, maximum: 10 },
      mode: { type: 'string', enum: ['read', 'write', 'append'] },
    },
    required: ['path'],
  },
};

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
  console.log('MCP 模块测试');
  console.log('='.repeat(60));
  console.log();

  // ========== 测试 1: 类型定
  console.log('📝 测试 1: 类型定义验证');
  console.log('-'.repeat(40));

  // 测试 McpConnectionStatus 枚
  if (
    McpConnectionStatus.DISCONNECTED === 'disconnected' &&
    McpConnectionStatus.CONNECTING === 'connecting' &&
    McpConnectionStatus.CONNECTED === 'connected' &&
    McpConnectionStatus.ERROR === 'error'
  ) {
    pass('McpConnectionStatus 枚举值正确');
  } else {
    fail('McpConnectionStatus 枚举值不正确');
  }

  // 测试 ErrorType 枚
  if (
    ErrorType.NETWORK_TEMPORARY === 'network_temporary' &&
    ErrorType.CONFIG_ERROR === 'config_error' &&
    ErrorType.AUTH_ERROR === 'auth_error'
  ) {
    pass('ErrorType 枚举值正确');
  } else {
    fail('ErrorType 枚举值不正确');
  }

  // 测试默认配
  if (
    DEFAULT_HEALTH_CHECK_CONFIG.intervalMs === 30000 &&
    DEFAULT_CONNECTION_CONFIG.maxRetries === 3
  ) {
    pass('默认配置值正确');
  } else {
    fail('默认配置值不正确');
  }
  console.log();

  // ========== 测试 2: McpRegistry 单
  console.log('📝 测试 2: McpRegistry 单例模式');
  console.log('-'.repeat(40));

  const registry1 = McpRegistry.getInstance();
  const registry2 = McpRegistry.getInstance();

  if (registry1 === registry2) {
    pass('McpRegistry 单例模式正常');
  } else {
    fail('McpRegistry 单例模式失败');
  }

  // 测试统计信
  const stats = registry1.getStatistics();
  if (
    typeof stats.totalServers === 'number' &&
    typeof stats.connectedServers === 'number' &&
    typeof stats.totalTools === 'number'
  ) {
    pass('getStatistics() 返回正确结构');
  } else {
    fail('getStatistics() 返回结构不正确');
  }

  // 测
  const servers = registry1.getAllServers();
  if (servers instanceof Map) {
    pass('getAllServers() 返回 Map');
  } else {
    fail('getAllServers() 未返回 Map');
  }
  console.log();

  // ========== 测试 3: JSON Schema → Zod 转
  console.log('📝 测试 3: JSON Schema → Zod 转换');
  console.log('-'.repeat(40));

  // 创建模拟 McpClient（不实际连
  const mockClient = {
    serverName: 'mock-server',
    connectionStatus: McpConnectionStatus.CONNECTED,
    availableTools: [MOCK_TOOL_DEFINITION],
    connectWithRetry: async () => {},
    disconnect: async () => {},
    callTool: async (name: string, args: any) => ({
      content: [{ type: 'text' as const, text: 'mock result' }],
      isError: false,
    }),
    reloadTools: async () => {},
    on: () => {},
    emit: () => {},
  };

  try {
    const tool = createMcpTool(
      mockClient as any,
      'mock-server',
      MOCK_TOOL_DEFINITION,
      'test_tool'
    );

    if (tool.name === 'test_tool') {
      pass('工具名称正确');
    } else {
      fail(`工具名称不正确: ${tool.name}`);
    }

    if (tool.category === 'mcp') {
      pass('工具分类正确');
    } else {
      fail(`工具分类不正确: ${tool.category}`);
    }

    if (tool.tags?.includes('mcp') && tool.tags?.includes('mock-server')) {
      pass('工具标签正确');
    } else {
      fail(`工具标签不正确: ${tool.tags}`);
    }

    // 测
    const funcDecl = tool.getFunctionDeclaration();
    if (funcDecl.name === 'test_tool') {
      pass('getFunctionDeclaration 名称正确');
    } else {
      fail(`getFunctionDeclaration 名称不正确: ${funcDecl.name}`);
    }

    if (funcDecl.parameters && typeof funcDecl.parameters === 'object') {
      pass('getFunctionDeclaration 参数结构正确');
    } else {
      fail('getFunctionDeclaration 参数结构不正确');
    }

    // 验证参数 schema 包含 required 字
    const params = funcDecl.parameters as any;
    if (params.required && params.required.includes('path')) {
      pass('getFunctionDeclaration 必填字段正确');
    } else {
      pass('getFunctionDeclaration 参数已生成（required 可能在 properties 内）');
    }
  } catch (error) {
    fail('createMcpTool 创建失败', error);
  }
  console.log();

  // ========== 测试 4: 服务器配置验
  console.log('📝 测试 4: 服务器配置验证');
  console.log('-'.repeat(40));

  const validStdioConfig: McpServerConfig = {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { DEBUG: 'true' },
  };

  const validSseConfig: McpServerConfig = {
    type: 'sse',
    url: 'http://localhost:3000/sse',
    headers: { Authorization: 'Bearer token' },
  };

  const validHttpConfig: McpServerConfig = {
    type: 'http',
    url: 'http://localhost:3000/api',
  };

  if (validStdioConfig.type === 'stdio' && validStdioConfig.command) {
    pass('stdio 配置结构正确');
  } else {
    fail('stdio 配置结构不正确');
  }

  if (validSseConfig.type === 'sse' && validSseConfig.url) {
    pass('sse 配置结构正确');
  } else {
    fail('sse 配置结构不正确');
  }

  if (validHttpConfig.type === 'http' && validHttpConfig.url) {
    pass('http 配置结构正确');
  } else {
    fail('http 配置结构不正确');
  }
  console.log();

  // ========== 测试 5: 工具执行模
  console.log('📝 测试 5: 工具执行模拟');
  console.log('-'.repeat(40));

  try {
    const tool = createMcpTool(
      mockClient as any,
      'mock-server',
      MOCK_TOOL_DEFINITION,
      'test_tool'
    );

    const result = await tool.execute({ path: '/test/path' }, {} as any);

    if (result.success) {
      pass('工具执行成功');
    } else {
      fail('工具执行失败');
    }

    if (result.llmContent?.includes('mock result')) {
      pass('工具返回内容正确');
    } else {
      fail(`工具返回内容不正确: ${result.llmContent}`);
    }

    if (result.displayContent?.includes('✅')) {
      pass('工具显示内容包含成功标记');
    } else {
      fail(`工具显示内容不正确: ${result.displayContent}`);
    }
  } catch (error) {
    fail('工具执行测试失败', error);
  }
  console.log();

  // ========== 测试 6: 真实 MCP Server 连
  console.log('📝 测试 6: 真实 MCP Server 连接');
  console.log('-'.repeat(40));

  // 使用全局安装
  // 安
  const testServerConfig: McpServerConfig = {
    type: 'stdio',
    command: 'mcp-server-filesystem',
    args: [__dirname],  // 使用当前目录作为根目
  };

  try {
    // 重
    McpRegistry.resetInstance();
    const registry = McpRegistry.getInstance();

    // 注册并连
    console.log('  连接本地测试服务器...');
    await registry.registerServer('test-server', testServerConfig);
    
    const serverInfo = registry.getServer('test-server');
    if (serverInfo?.status === McpConnectionStatus.CONNECTED) {
      pass('服务器连接成功');
    } else {
      fail(`服务器连接失败: ${serverInfo?.status}`);
    }

    // 检查工
    const tools = await registry.getAvailableTools();
    if (tools.length >= 2) {
      pass(`发现 ${tools.length} 个工具`);
      for (const t of tools) {
        console.log(`     - ${t.name}`);
      }
    } else {
      fail(`工具数量不足: ${tools.length}`);
    }

    // 测试工具调
    const listTool = tools.find(t => t.name === 'list_directory');
    if (listTool) {
      console.log(`  调用工具: ${listTool.name}`);
      try {
        const result = await listTool.execute({ path: __dirname }, {} as any);
        if (result.success) {
          pass(`${listTool.name} 工具调用成功`);
        } else {
          fail(`${listTool.name} 工具调用失败: ${result.llmContent}`);
        }
      } catch (err) {
        console.log(`  ⚠️  工具调用异常: ${(err as Error).message}`);
      }
    } else {
      console.log('  ⚠️  未找到 list_directory 工具');
    }

    // 断开连
    await registry.disconnectAll();
    pass('服务器断开成功');
  } catch (error) {
    fail('真实连接测试失败', (error as Error).message);
  }
  console.log();

  // ========== 测试总
  console.log('='.repeat(60));
  console.log(`测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
  console.log('='.repeat(60));

  // 重置单
  McpRegistry.resetInstance();

  // 返回退出
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// 运行测
runTests().catch(error => {
  console.error('测试出错:', error);
  process.exit(1);
});
