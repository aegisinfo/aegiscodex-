/**
 * MCP Tool 转换器
 *
 */
import type { McpToolDefinition, McpClientInterface } from './types.js';
/**
 *
 */
export declare function createMcpTool(mcpClient: McpClientInterface, serverName: string, toolDef: McpToolDefinition, customName?: string): import("../tools/types.js").Tool<any>;
/**
 *
 */
export declare function createMcpTools(mcpClient: McpClientInterface, serverName: string, toolDefs: McpToolDefinition[], namePrefix?: string): import("../tools/types.js").Tool<any>[];
//# sourceMappingURL=createMcpTool.d.ts.map