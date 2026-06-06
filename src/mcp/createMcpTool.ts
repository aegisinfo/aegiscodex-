/**
 * 
 */

import { z } from 'zod';
import type {
  McpToolDefinition,
  McpClientInterface,
  JSONSchemaProperty,
} from './types.js';
import { createTool } from '../tools/createTool.js';
import { ToolKind, ToolErrorType } from '../tools/types.js';
import { mcpDebug } from '../utils/debug.js';

/**
 * 
 */
function convertJsonSchemaToZod(jsonSchema: JSONSchemaProperty): z.ZodSchema {
  // null 
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.any();
  }

  const type = Array.isArray(jsonSchema.type) ? jsonSchema.type[0] : jsonSchema.type;
  if (type === 'object' || jsonSchema.properties) {
    const shape: Record<string, z.ZodSchema> = {};
    const required = jsonSchema.required || [];

    if (jsonSchema.properties) {
      for (const [key, value] of Object.entries(jsonSchema.properties)) {
        if (typeof value === 'object' && value !== null) {
          let fieldSchema = convertJsonSchemaToZod(value);
          if (!required.includes(key)) {
            fieldSchema = fieldSchema.optional();
          }

          shape[key] = fieldSchema;
        }
      }
    }

    return z.object(shape);
  }
  if (type === 'array') {
    if (jsonSchema.items && typeof jsonSchema.items === 'object') {
      return z.array(convertJsonSchemaToZod(jsonSchema.items));
    }
    return z.array(z.any());
  }
  if (type === 'string') {
    if (jsonSchema.enum && jsonSchema.enum.length > 0) {
      return z.enum(jsonSchema.enum as [string, ...string[]]);
    }

    let schema = z.string();
    if (jsonSchema.minLength !== undefined) {
      schema = schema.min(jsonSchema.minLength);
    }
    if (jsonSchema.maxLength !== undefined) {
      schema = schema.max(jsonSchema.maxLength);
    }
    if (jsonSchema.pattern) {
      try {
        schema = schema.regex(new RegExp(jsonSchema.pattern));
      } catch {
      }
    }

    return schema;
  }
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
  if (type === 'boolean') {
    return z.boolean();
  }

  // oneOf / anyOf
  if (jsonSchema.oneOf && jsonSchema.oneOf.length >= 2) {
    const schemas = jsonSchema.oneOf
      .filter((s): s is JSONSchemaProperty => typeof s === 'object' && s !== null)
      .map(s => convertJsonSchemaToZod(s));

    if (schemas.length >= 2) {
      return z.union(schemas as [z.ZodSchema, z.ZodSchema, ...z.ZodSchema[]]);
    }
  }

  if (jsonSchema.anyOf && jsonSchema.anyOf.length >= 2) {
    const schemas = jsonSchema.anyOf
      .filter((s): s is JSONSchemaProperty => typeof s === 'object' && s !== null)
      .map(s => convertJsonSchemaToZod(s));

    if (schemas.length >= 2) {
      return z.union(schemas as [z.ZodSchema, z.ZodSchema, ...z.ZodSchema[]]);
    }
  }
  return z.any();
}

/**
 * 
 */
export function createMcpTool(
  mcpClient: McpClientInterface,
  serverName: string,
  toolDef: McpToolDefinition,
  customName?: string
) {
  // 1. JSON Schema → Zod Schema
  let zodSchema: z.ZodSchema;
  try {
    zodSchema = convertJsonSchemaToZod(toolDef.inputSchema);
  } catch (error) {
    mcpDebug.warn(
      `Schema ， schema: ${toolDef.name}`,
      (error as Error).message
    );
    zodSchema = z.any();
  }
  const toolName = customName || toolDef.name;
  return createTool({
    name: toolName,
    displayName: `${serverName}: ${toolDef.name}`,
    kind: ToolKind.Execute,
    schema: zodSchema,
    description: {
      short: toolDef.description || `MCP Tool: ${toolDef.name}`,
      long: [
        `MCP ，: ${serverName}`,
        toolDef.description || '',
        '',
        '，。',
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
        let llmContent = '';
        let displayContent = '';

        if (result.content && Array.isArray(result.content)) {
          for (const item of result.content) {
            if (item.type === 'text' && item.text) {
              llmContent += item.text;
              displayContent += item.text;
            } else if (item.type === 'image') {
              displayContent += `[: ${item.mimeType || 'unknown'}]\n`;
              llmContent += `[image: ${item.mimeType || 'unknown'}]\n`;
            } else if (item.type === 'resource') {
              displayContent += `[: ${item.uri || item.mimeType || 'unknown'}]\n`;
              llmContent += `[resource: ${item.uri || item.mimeType || 'unknown'}]\n`;
            }
          }
        }

        if (result.isError) {
          return {
            success: false,
            llmContent: llmContent || 'MCP tool execution failed',
            displayContent: `❌ ${displayContent || 'MCP'}`,
            error: {
              type: ToolErrorType.EXECUTION_ERROR,
              message: llmContent || 'MCP tool execution failed',
            },
          };
        }

        return {
          success: true,
          llmContent: llmContent || 'Execution succeeded',
          displayContent: `✅ MCP ${toolDef.name} \n${displayContent}`,
          metadata: {
            serverName,
            toolName: toolDef.name,
            mcpResult: result,
          },
        };
      } catch (error) {
        const errorMessage = (error as Error).message;
        return {
          success: false,
          llmContent: `MCP tool execution failed: ${errorMessage}`,
          displayContent: `❌ MCP: ${errorMessage}`,
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
export function createMcpTools(
  mcpClient: McpClientInterface,
  serverName: string,
  toolDefs: McpToolDefinition[],
  namePrefix?: string
) {
  return toolDefs.map(toolDef => {
    const customName = namePrefix ? `${namePrefix}__${toolDef.name}` : undefined;
    return createMcpTool(mcpClient, serverName, toolDef, customName);
  });
}
