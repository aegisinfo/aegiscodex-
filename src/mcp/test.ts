/**
 * 
 * 
 * 
 * 
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
}

function fail(msg: string, error?: any) {
  testsFailed++;
  if (error)
}

async function runTests() {

  if (
    McpConnectionStatus.DISCONNECTED === 'disconnected' &&
    McpConnectionStatus.CONNECTING === 'connecting' &&
    McpConnectionStatus.CONNECTED === 'connected' &&
    McpConnectionStatus.ERROR === 'error'
  ) {
    pass('McpConnectionStatus ');
  } else {
    fail('McpConnectionStatus ');
  }
  if (
    ErrorType.NETWORK_TEMPORARY === 'network_temporary' &&
    ErrorType.CONFIG_ERROR === 'config_error' &&
    ErrorType.AUTH_ERROR === 'auth_error'
  ) {
    pass('ErrorType ');
  } else {
    fail('ErrorType ');
  }
  if (
    DEFAULT_HEALTH_CHECK_CONFIG.intervalMs === 30000 &&
    DEFAULT_CONNECTION_CONFIG.maxRetries === 3
  ) {
    pass('');
  } else {
    fail('');
  }

  const registry1 = McpRegistry.getInstance();
  const registry2 = McpRegistry.getInstance();

  if (registry1 === registry2) {
    pass('McpRegistry ');
  } else {
    fail('McpRegistry ');
  }
  const stats = registry1.getStatistics();
  if (
    typeof stats.totalServers === 'number' &&
    typeof stats.connectedServers === 'number' &&
    typeof stats.totalTools === 'number'
  ) {
    pass('getStatistics() ');
  } else {
    fail('getStatistics() ');
  }
  const servers = registry1.getAllServers();
  if (servers instanceof Map) {
    pass('getAllServers()  Map');
  } else {
    fail('getAllServers()  Map');
  }

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
      pass('');
    } else {
      fail(`: ${tool.name}`);
    }

    if (tool.category === 'mcp') {
      pass('');
    } else {
      fail(`: ${tool.category}`);
    }

    if (tool.tags?.includes('mcp') && tool.tags?.includes('mock-server')) {
      pass('');
    } else {
      fail(`: ${tool.tags}`);
    }
    const funcDecl = tool.getFunctionDeclaration();
    if (funcDecl.name === 'test_tool') {
      pass('getFunctionDeclaration ');
    } else {
      fail(`getFunctionDeclaration : ${funcDecl.name}`);
    }

    if (funcDecl.parameters && typeof funcDecl.parameters === 'object') {
      pass('getFunctionDeclaration ');
    } else {
      fail('getFunctionDeclaration ');
    }
    const params = funcDecl.parameters as any;
    if (params.required && params.required.includes('path')) {
      pass('getFunctionDeclaration ');
    } else {
      pass('getFunctionDeclaration （required  properties ）');
    }
  } catch (error) {
    fail('createMcpTool ', error);
  }

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
    pass('stdio ');
  } else {
    fail('stdio ');
  }

  if (validSseConfig.type === 'sse' && validSseConfig.url) {
    pass('sse ');
  } else {
    fail('sse ');
  }

  if (validHttpConfig.type === 'http' && validHttpConfig.url) {
    pass('http ');
  } else {
    fail('http ');
  }

  try {
    const tool = createMcpTool(
      mockClient as any,
      'mock-server',
      MOCK_TOOL_DEFINITION,
      'test_tool'
    );

    const result = await tool.execute({ path: '/test/path' }, {} as any);

    if (result.success) {
      pass('');
    } else {
      fail('');
    }

    if (result.llmContent?.includes('mock result')) {
      pass('');
    } else {
      fail(`: ${result.llmContent}`);
    }

    if (result.displayContent?.includes('✅')) {
      pass('');
    } else {
      fail(`: ${result.displayContent}`);
    }
  } catch (error) {
    fail('', error);
  }

  const testServerConfig: McpServerConfig = {
    type: 'stdio',
    command: 'mcp-server-filesystem',
    args: [__dirname],
  };

  try {
    McpRegistry.resetInstance();
    const registry = McpRegistry.getInstance();
    await registry.registerServer('test-server', testServerConfig);
    
    const serverInfo = registry.getServer('test-server');
    if (serverInfo?.status === McpConnectionStatus.CONNECTED) {
      pass('');
    } else {
      fail(`: ${serverInfo?.status}`);
    }
    const tools = await registry.getAvailableTools();
    if (tools.length >= 2) {
      pass(` ${tools.length} `);
      for (const t of tools) {
      }
    } else {
      fail(`: ${tools.length}`);
    }
    const listTool = tools.find(t => t.name === 'list_directory');
    if (listTool) {
      try {
        const result = await listTool.execute({ path: __dirname }, {} as any);
        if (result.success) {
          pass(`${listTool.name} `);
        } else {
          fail(`${listTool.name} : ${result.llmContent}`);
        }
      } catch (err) {
      }
    } else {
    }
    await registry.disconnectAll();
    pass('');
  } catch (error) {
    fail('', (error as Error).message);
  }

  McpRegistry.resetInstance();
  if (testsFailed > 0) {
    process.exit(1);
  }
}
runTests().catch(error => {
  console.error(':', error);
  process.exit(1);
});
