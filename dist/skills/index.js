/**
 * Skills 模块
 *
 * Skills 是一种核心扩展机制，允许通过 Markdown 文件（SKILL.md）定义专业能力。
 *
 *
 *
 * 1. 发现阶段：系统提示仅包含 Skills 名称和描述
 * 2. 激活阶段：AI 判断需要某个 Skill 时调用 Skill 工具
 * 3. 加载阶段：按需加载完整 SKILL.md 内容
 */
export * from './types.js';
export * from './SkillLoader.js';
export { SkillRegistry, getSkillRegistry } from './SkillRegistry.js';
// 便捷初始化函
import { getSkillRegistry } from './SkillRegistry.js';
/**
 *
 *
 * @param workspaceRoot - 工作区根目录
 * @returns 发现结果
 */
export async function initializeSkills(workspaceRoot) {
    const registry = getSkillRegistry();
    return registry.initialize(workspaceRoot);
}
/**
 *
 *
 * @param name - Skill 名称
 * @returns Skill 内容，如果不存在返回 null
 */
export async function loadSkillContent(name) {
    const registry = getSkillRegistry();
    return registry.loadContent(name);
}
/**
 *
 */
export function generateSkillsPrompt() {
    const registry = getSkillRegistry();
    return registry.generateAvailableSkillsList();
}
//# sourceMappingURL=index.js.map