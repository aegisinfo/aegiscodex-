/**
 * 
 * 
 * 
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ToolErrorType,
  type Tool,
  type ToolKind,
  type ToolDescription,
  type ToolResult,
  type ExecutionContext,
  type FunctionDeclaration,
  type ToolInvocation,
} from './types.js';

/**
 * 
 */
export interface ToolConfig<TSchema extends z.ZodType> {
  
  name: string;
  
  displayName?: string;
  
  kind: ToolKind;
  
  schema: TSchema;
  
  description: ToolDescription;
  
  execute: (
    params: z.infer<TSchema>,
    context?: ExecutionContext
  ) => Promise<ToolResult>;
  
  version?: string;
  
  category?: string;
  
  tags?: string[];
  
  isReadOnly?: boolean;
  
  isConcurrencySafe?: boolean;
  
  strict?: boolean;
  
  extractSignatureContent?: (params: unknown) => string;
  
  abstractPermissionRule?: (params: unknown) => string;
}

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
export function createTool<TSchema extends z.ZodType>(
  config: ToolConfig<TSchema>
): Tool<z.infer<TSchema>> {
  const {
    name,
    displayName,
    kind,
    schema,
    description,
    execute,
    version = '1.0.0',
    category,
    tags = [],
    isReadOnly,
    isConcurrencySafe = true,
    strict = false,
    extractSignatureContent,
    abstractPermissionRule,
  } = config;
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'openApi3',
  });
  const schemaObj = jsonSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

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
    getFunctionDeclaration(): FunctionDeclaration {
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
    build(params: z.infer<TSchema>): ToolInvocation<z.infer<TSchema>> {
      return {
        toolName: name,
        params,
      };
    },

    /**
     * 
     */
    async execute(
      params: z.infer<TSchema>,
      context?: ExecutionContext
    ): Promise<ToolResult> {
      try {
        const validated = schema.parse(params);
        return await execute(validated, context);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map(e => 
            `${e.path.join('.')}: ${e.message}`
          ).join('; ');
          
          return {
            success: false,
            llmContent: `Parameter validation failed: ${messages}`,
            displayContent: `❌ : ${messages}`,
            error: {
              type: ToolErrorType.VALIDATION_ERROR,
              message: messages,
              details: error.errors,
            },
          };
        }
        const errorMessage = error instanceof Error ? error.message : '';
        return {
          success: false,
          llmContent: `Tool execution failed: ${errorMessage}`,
          displayContent: `❌ : ${errorMessage}`,
          error: {
            type: ToolErrorType.EXECUTION_ERROR,
            message: errorMessage,
          },
        };
      }
    },
    extractSignatureContent,
    abstractPermissionRule,
  };
}

/**
 * 
 */
function buildFullDescription(desc: ToolDescription): string {
  const parts: string[] = [desc.short];

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
