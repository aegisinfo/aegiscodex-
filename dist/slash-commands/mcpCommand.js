/**
 * /mcp 命令 - 显示 MCP 服务器状态和工具
 */
import { McpRegistry, McpConnectionStatus } from '../mcp/index.js';
/**
 *
 */
function getStatusMark(status) {
    switch (status) {
        case McpConnectionStatus.CONNECTED:
            return '+';
        case McpConnectionStatus.CONNECTING:
            return '~';
        case McpConnectionStatus.ERROR:
            return 'x';
        case McpConnectionStatus.DISCONNECTED:
        default:
            return '-';
    }
}
/**
 *
 */
function formatTime(date) {
    if (!date)
        return '-';
    return date.toLocaleTimeString();
}
/**
 * /mcp 命令实现
 */
export const mcpCommand = {
    name: 'mcp',
    description: 'Show MCP server status and tools',
    usage: '/mcp [tools|<server-name>]',
    async handler(args) {
        const mcpRegistry = McpRegistry.getInstance();
        const stats = mcpRegistry.getStatistics();
        const servers = mcpRegistry.getAllServers();
        // 没有配置任何 MCP 服务
        if (stats.totalServers === 0) {
            return {
                success: true,
                type: 'info',
                content: `## mcp

no servers configured.

add \`mcpServers\` to config:

\`\`\`json
// ~/.aegis/config.json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "\${GITHUB_TOKEN}"
      }
    }
  }
}
\`\`\`
`,
            };
        }
        const trimmedArgs = args.trim().toLowerCase();
        // /mcp tools - 列出所有工具
        if (trimmedArgs === 'tools') {
            return await handleToolsSubcommand(mcpRegistry);
        }
        // /mcp <server-name> - 显示特定服务器详情
        if (trimmedArgs && trimmedArgs !== '') {
            const serverInfo = mcpRegistry.getServer(trimmedArgs);
            if (serverInfo) {
                return handleServerDetail(trimmedArgs, serverInfo);
            }
            // 服务器不存在，显示概
        }
        // 默认：显示概
        let output = '## mcp\n\n';
        output += `| key | value |\n`;
        output += `|-----|-------|\n`;
        output += `| servers | ${stats.totalServers} |\n`;
        output += `| connected | ${stats.connectedServers} |\n`;
        output += `| errors | ${stats.errorServers} |\n`;
        output += `| tools | ${stats.totalTools} |\n`;
        output += '\n';
        output += '### servers\n\n';
        output += '| st | server | tools | connected |\n';
        output += '|----|--------|-------|-----------|\n';
        for (const [name, info] of servers) {
            const mark = getStatusMark(info.status);
            const toolCount = info.status === McpConnectionStatus.CONNECTED ? info.tools.length : '-';
            const connectedAt = formatTime(info.connectedAt);
            output += `| ${mark} | ${name} | ${toolCount} | ${connectedAt} |\n`;
        }
        output += `\n\`/mcp tools\` to list all tools · \`/mcp <name>\` for details\n`;
        return {
            success: true,
            type: 'success',
            content: output,
        };
    },
};
/**
 *
 */
async function handleToolsSubcommand(registry) {
    const tools = await registry.getAvailableTools();
    if (tools.length === 0) {
        return {
            success: true,
            type: 'info',
            content: '## mcp tools\n\nno tools available. ensure at least one server is connected.',
        };
    }
    let output = `## mcp tools (${tools.length})\n\n`;
    output += '| tool | description | type |\n';
    output += '|------|-------------|------|\n';
    for (const tool of tools) {
        const description = tool.description?.short || '-';
        const category = tool.category || 'mcp';
        const shortDesc = description.length > 50 ? description.slice(0, 47) + '...' : description;
        output += `| \`${tool.name}\` | ${shortDesc} | ${category} |\n`;
    }
    return {
        success: true,
        type: 'success',
        content: output,
    };
}
/**
 *
 */
function handleServerDetail(name, info) {
    let output = `## mcp: ${name}\n\n`;
    output += `| key | value |\n`;
    output += `|-----|-------|\n`;
    output += `| status | ${info.status} |\n`;
    output += `| type | ${info.config.type} |\n`;
    if (info.serverName) {
        output += `| name | ${info.serverName} |\n`;
    }
    if (info.serverVersion) {
        output += `| version | ${info.serverVersion} |\n`;
    }
    if (info.connectedAt) {
        output += `| connected | ${info.connectedAt.toLocaleString()} |\n`;
    }
    if (info.lastError) {
        output += `| error | ${info.lastError.message} |\n`;
    }
    output += '\n### config\n\n';
    output += '```json\n';
    output += JSON.stringify({
        type: info.config.type,
        command: info.config.command,
        args: info.config.args,
        url: info.config.url,
    }, null, 2);
    output += '\n```\n';
    if (info.status === McpConnectionStatus.CONNECTED && info.tools.length > 0) {
        output += '\n### tools\n\n';
        for (const tool of info.tools) {
            output += `- \`${tool.name}\` ${tool.description || '-'}\n`;
        }
    }
    return {
        success: true,
        type: 'success',
        content: output,
    };
}
//# sourceMappingURL=mcpCommand.js.map