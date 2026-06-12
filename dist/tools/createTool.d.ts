/**
 *
 *
 *
 */
import { z } from 'zod';
import { type Tool, type ToolKind, type ToolDescription, type ToolResult, type ExecutionContext } from './types.js';
/**
 *
 */
export interface ToolConfig<TSchema extends z.ZodType> {
    /** 工具唯一名称 */
    name: string;
    /** 显示名称 */
    displayName?: string;
    /** 工具类型 */
    kind: ToolKind;
    /** 参数 Schema */
    schema: TSchema;
    /** 工具描述 */
    description: ToolDescription;
    /** 执行函数 */
    execute: (params: z.infer<TSchema>, context?: ExecutionContext) => Promise<ToolResult>;
    /** 版本 */
    version?: string;
    /** 分类 */
    category?: string;
    /** 标签 */
    tags?: string[];
    /** 是否只读（默认根据 kind 推断） */
    isReadOnly?: boolean;
    /** 是否并发安全（默认 true） */
    isConcurrencySafe?: boolean;
    /** 是否启用结构化输出（默认 false） */
    strict?: boolean;
    /** 提取签名内容（用于权限规则） */
    extractSignatureContent?: (params: unknown) => string;
    /** 抽象权限规则（用于权限匹配） */
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
export declare function createTool<TSchema extends z.ZodType>(config: ToolConfig<TSchema>): Tool<z.infer<TSchema>>;
//# sourceMappingURL=createTool.d.ts.map