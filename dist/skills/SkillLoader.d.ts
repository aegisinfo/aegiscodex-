/**
 * SkillLoader - SKILL.md 文件解析器
 *
 *
 */
import type { ParsedSkillFile, SkillFrontmatter } from './types.js';
/**
 *
 *
 */
export declare function isValidSkillName(name: string): boolean;
/**
 *
 */
export declare function isValidDescription(description: string): boolean;
/**
 *
 *
 * @param content - 文件内容
 * @returns 解析后的 frontmatter 和 body
 * @throws 如果格式无效或缺少必填字段
 */
export declare function parseSkillFile(content: string): ParsedSkillFile;
/**
 *
 */
export declare function extractMetadataFields(frontmatter: SkillFrontmatter): {
    allowedTools?: string[];
    argumentHint?: string;
    userInvocable: boolean;
    disableModelInvocation: boolean;
    model?: string;
    whenToUse?: string;
    version?: string;
};
//# sourceMappingURL=SkillLoader.d.ts.map