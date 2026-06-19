/**
 *
 *
 *
 * 1. 环境上下文 - 动态生成
 * 2. 基础提示词 - DEFAULT_SYSTEM_PROMPT 或 PLAN_MODE_SYSTEM_PROMPT
 * 3. 可用 Skills 列表 - 渐进式披露的"发现阶段"
 * 4. 项目配置 - AEGIS.md
 * 5. 追加内容 - 用户自定义
 */
import type { PermissionMode } from '../agent/types.js';
/**
 *
 */
export interface PromptSource {
    name: string;
    loaded: boolean;
    length: number;
    path?: string;
}
/**
 *
 */
export interface BuildSystemPromptOptions {
    /** 项目路径（用于查找 AEGIS.md） */
    projectPath?: string;
    /** 替换默认提示词 */
    replaceDefault?: string;
    /** 追加内容 */
    append?: string;
    /** 权限模式（plan 模式使用独立提示词） */
    mode?: PermissionMode;
    /** 是否包含环境上下文 */
    includeEnvironment?: boolean;
}
/**
 *
 */
export interface BuildSystemPromptResult {
    /** 完整的系统提示词 */
    prompt: string;
    /** 各部分来源记录 */
    sources: PromptSource[];
}
/**
 *
 *
 *
 */
export declare function buildSystemPrompt(options?: BuildSystemPromptOptions): Promise<BuildSystemPromptResult>;
/**
 *
 */
export declare function getPromptStats(result: BuildSystemPromptResult): string;
//# sourceMappingURL=builder.d.ts.map