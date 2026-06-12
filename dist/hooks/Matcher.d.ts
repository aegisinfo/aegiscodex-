/**
 * Hook 匹配器
 *
 *
 *
 */
import type { MatcherConfig, MatchContext, HookMatcher, Hook } from './types.js';
/**
 * Hook 匹配器
 */
export declare class Matcher {
    /**
     *
     */
    matches(config: MatcherConfig | undefined, context: MatchContext): boolean;
    /**
     *
     */
    getMatchingHooks(matchers: HookMatcher[] | undefined, context: MatchContext): Hook[];
    /**
     *
     *
     *
     * - 简单字符串: "Read"
     * - 管道分隔: "Read|Write|Edit"
     * - 正则表达式: "Bash\\(.*\\)"
     */
    private matchesPattern;
    /**
     * Glob 模式匹配
     *
     *
     * - 通配符: "*.ts"
     * - 双星: "**\/*.tsx"
     * - 多模式: "**\/*.{ts,tsx,js,jsx}"
     */
    private matchesGlob;
}
/**
 *
 */
export declare function extractFilePath(toolInput: Record<string, unknown>): string | undefined;
/**
 *
 */
export declare function extractCommand(toolName: string, toolInput: Record<string, unknown>): string | undefined;
//# sourceMappingURL=Matcher.d.ts.map