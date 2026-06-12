/**
 * MCP Tool 转换器
 *
 */
import { z } from 'zod';
import { createTool } from '../tools/createTool.js';
import { ToolKind, ToolErrorType } from '../tools/types.js';
import { mcpDebug } from '../utils/debug.js';
/**
 *
 */
function convertJsonSchemaToZod(jsonSchema) {
    // null 
    if (!jsonSchema || typeof jsonSchema !== 'object') {
        return z.any();
    }
    const type = Array.isArray(jsonSchema.type) ? jsonSchema.type[0] : jsonSchema.type;
    // object 类
    if (type === 'object' || jsonSchema.properties) {
        const shape = {};
        const required = jsonSchema.required || [];
        if (jsonSchema.properties) {
            for (const [key, value] of Object.entries(jsonSchema.properties)) {
                if (typeof value === 'object' && value !== null) {
                    let fieldSchema = convertJsonSchemaToZod(value);
                    // 非必填字段标记为可
                    if (!required.includes(key)) {
                        fieldSchema = fieldSchema.optional();
                    }
                    shape[key] = fieldSchema;
                }
            }
        }
        return z.object(shape);
    }
    // array 类
    if (type === 'array') {
        if (jsonSchema.items && typeof jsonSchema.items === 'object') {
            return z.array(convertJsonSchemaToZod(jsonSchema.items));
        }
        return z.array(z.any());
    }
    // string 类
    if (type === 'string') {
        // 枚
        if (jsonSchema.enum && jsonSchema.enum.length > 0) {
            return z.enum(jsonSchema.enum);
        }
        let schema = z.string();
        // 长度限
        if (jsonSchema.minLength !== undefined) {
            schema = schema.min(jsonSchema.minLength);
        }
        if (jsonSchema.maxLength !== undefined) {
            schema = schema.max(jsonSchema.maxLength);
        }
        // 正则模
        if (jsonSchema.pattern) {
            try {
                schema = schema.regex(new RegExp(jsonSchema.pattern));
            }
            catch {
                // 忽略无效的正
            }
        }
        return schema;
    }
    // number / integer 类型
    if (type === 'number' || type === 'integer') {
        let schema = z.number();
        if (jsonSchema.minimum !== undefined) {
            schema = schema.min(jsonSchema.minimum);
        }
        if (jsonSchema.maximum !== undefined) {
            schema = schema.max(jsonSchema.maximum);
        }
        return schema;
    }
    // boolean 类
    if (type === 'boolean') {
        return z.boolean();
    }
    // oneOf / anyOf
    if (jsonSchema.oneOf && jsonSchema.oneOf.length >= 2) {
        const schemas = jsonSchema.oneOf
            .filter((s) => typeof s === 'object' && s !== null)
            .map(s => convertJsonSchemaToZod(s));
        if (schemas.length >= 2) {
            return z.union(schemas);
        }
    }
    if (jsonSchema.anyOf && jsonSchema.anyOf.length >= 2) {
        const schemas = jsonSchema.anyOf
            .filter((s) => typeof s === 'object' && s !== null)
            .map(s => convertJsonSchemaToZod(s));
        if (schemas.length >= 2) {
            return z.union(schemas);
        }
    }
    // 默
    return z.any();
}
/**
 *
 */
export function createMcpTool(mcpClient, serverName, toolDef, customName) {
    // 1. JSON Schema → Zod Schema
    let zodSchema;
    try {
        zodSchema = convertJsonSchemaToZod(toolDef.inputSchema);
    }
    catch (error) {
        mcpDebug.warn(`Schema 转换失败，使用降级 schema: ${toolDef.name}`, error.message);
        zodSchema = z.any(); // 降级方
    }
    // 2. 决定工具名
    const toolName = customName || toolDef.name;
    // 3. 创
    return createTool({
        name: toolName,
        displayName: `${serverName}: ${toolDef.name}`,
        kind: ToolKind.Execute, // MCP 工具视为 Execute 类型（需要确
        schema: zodSchema,
        description: {
            short: toolDef.description || `MCP Tool: ${toolDef.name}`,
            long: [
                `MCP 工具，来自服务器: ${serverName}`,
                toolDef.description || '',
                '',
                '执行外部工具，需要用户确认。',
            ].filter(Boolean).join('\n'),
            important: [
                `From MCP server: ${serverName}`,
                'Executes external tools; user confirmation required',
            ],
        },
        category: 'mcp',
        tags: ['mcp', 'external', serverName],
        async execute(params) {
            try {
                const result = await mcpClient.callTool(toolDef.name, params);
                // 处理响应内
                let llmContent = '';
                let displayContent = '';
                if (result.content && Array.isArray(result.content)) {
                    for (const item of result.content) {
                        if (item.type === 'text' && item.text) {
                            llmContent += item.text;
                            displayContent += item.text;
                        }
                        else if (item.type === 'image') {
                            displayContent += `[图片: ${item.mimeType || 'unknown'}]\n`;
                            llmContent += `[image: ${item.mimeType || 'unknown'}]\n`;
                        }
                        else if (item.type === 'resource') {
                            displayContent += `[资源: ${item.uri || item.mimeType || 'unknown'}]\n`;
                            llmContent += `[resource: ${item.uri || item.mimeType || 'unknown'}]\n`;
                        }
                    }
                }
                if (result.isError) {
                    return {
                        success: false,
                        llmContent: llmContent || 'MCP tool execution failed',
                        displayContent: `❌ ${displayContent || 'MCP工具执行失败'}`,
                        error: {
                            type: ToolErrorType.EXECUTION_ERROR,
                            message: llmContent || 'MCP tool execution failed',
                        },
                    };
                }
                return {
                    success: true,
                    llmContent: llmContent || 'Execution succeeded',
                    displayContent: `✅ MCP工具 ${toolDef.name} 执行成功\n${displayContent}`,
                    metadata: {
                        serverName,
                        toolName: toolDef.name,
                        mcpResult: result,
                    },
                };
            }
            catch (error) {
                const errorMessage = error.message;
                return {
                    success: false,
                    llmContent: `MCP tool execution failed: ${errorMessage}`,
                    displayContent: `❌ MCP工具执行失败: ${errorMessage}`,
                    error: {
                        type: ToolErrorType.EXECUTION_ERROR,
                        message: errorMessage,
                    },
                };
            }
        },
    });
}
/**
 *
 */
export function createMcpTools(mcpClient, serverName, toolDefs, namePrefix) {
    return toolDefs.map(toolDef => {
        const customName = namePrefix ? `${namePrefix}__${toolDef.name}` : undefined;
        return createMcpTool(mcpClient, serverName, toolDef, customName);
    });
}
//# sourceMappingURL=createMcpTool.js.map