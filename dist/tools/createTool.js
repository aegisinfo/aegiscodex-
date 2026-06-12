/**
 *
 *
 *
 */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolErrorType, } from './types.js';
// ========== 工厂函
/**
 *
 *
 * @example
 * ```typescript
 * const readTool = createTool({
 *   name: 'Read',
 *   kind: ToolKind.ReadOnly,
 *   schema: z.object({
 *     file_path: z.string(),
 *   }),
 *   description: { short: 'Read files' },
 *   execute: async (params) => {
 *     // ...
 *   },
 * });
 * ```
 */
export function createTool(config) {
    const { name, displayName, kind, schema, description, execute, version = '1.0.0', category, tags = [], isReadOnly, isConcurrencySafe = true, strict = false, extractSignatureContent, abstractPermissionRule, } = config;
    // 从 Zod Schema 生
    const jsonSchema = zodToJsonSchema(schema, {
        $refStrategy: 'none',
        target: 'openApi3',
    });
    // 提取 properties 
    const schemaObj = jsonSchema;
    return {
        name,
        displayName: displayName || name,
        kind,
        isReadOnly: isReadOnly ?? kind === 'readonly',
        isConcurrencySafe,
        strict,
        description,
        version,
        category,
        tags,
        /**
         *
         */
        getFunctionDeclaration() {
            return {
                name,
                description: buildFullDescription(description),
                parameters: {
                    type: 'object',
                    properties: schemaObj.properties || {},
                    required: schemaObj.required,
                },
            };
        },
        /**
         *
         */
        build(params) {
            return {
                toolName: name,
                params,
            };
        },
        /**
         *
         */
        async execute(params, context) {
            try {
                // 验证参
                const validated = schema.parse(params);
                // 执行工
                return await execute(validated, context);
            }
            catch (error) {
                // 处理 Zod 验证错
                if (error instanceof z.ZodError) {
                    const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                    return {
                        success: false,
                        llmContent: `Parameter validation failed: ${messages}`,
                        displayContent: `❌ 参数验证失败: ${messages}`,
                        error: {
                            type: ToolErrorType.VALIDATION_ERROR,
                            message: messages,
                            details: error.errors,
                        },
                    };
                }
                // 处理其他错
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                return {
                    success: false,
                    llmContent: `Tool execution failed: ${errorMessage}`,
                    displayContent: `❌ 执行失败: ${errorMessage}`,
                    error: {
                        type: ToolErrorType.EXECUTION_ERROR,
                        message: errorMessage,
                    },
                };
            }
        },
        // 可选方
        extractSignatureContent,
        abstractPermissionRule,
    };
}
/**
 *
 */
function buildFullDescription(desc) {
    const parts = [desc.short];
    if (desc.long) {
        parts.push(desc.long);
    }
    if (desc.usageNotes && desc.usageNotes.length > 0) {
        parts.push('\nUsage notes:');
        parts.push(...desc.usageNotes.map(note => `- ${note}`));
    }
    if (desc.important && desc.important.length > 0) {
        parts.push('\nIMPORTANT:');
        parts.push(...desc.important.map(note => `- ${note}`));
    }
    return parts.join('\n');
}
//# sourceMappingURL=createTool.js.map