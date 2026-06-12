/**
 *
 *
 *
 * 1. 环境上下文 - 动态生成
 * 2. 基础提示词 - DEFAULT_SYSTEM_PROMPT 或 PLAN_MODE_SYSTEM_PROMPT
 * 3. 可用 Skills 列表 - 渐进式披露的"发现阶段"
 * 4. 项目配置 - CLAWDCODE.md
 * 5. 追加内容 - 用户自定义
 */
import fs from 'fs/promises';
import path from 'path';
import { getEnvironmentContext } from '../utils/environment.js';
import { DEFAULT_SYSTEM_PROMPT } from './default.js';
import { PLAN_MODE_SYSTEM_PROMPT } from './plan.js';
import { getSkillRegistry } from '../skills/index.js';
// ========== 常
/** 项目配置文件名 */
const PROJECT_CONFIG_FILENAME = 'AEGIS.md';
// ========== 辅助函
/**
 *
 */
async function loadProjectConfig(projectPath) {
    if (!projectPath) {
        projectPath = process.cwd();
    }
    const configPath = path.join(projectPath, PROJECT_CONFIG_FILENAME);
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        return content.trim();
    }
    catch {
        // 文件不存在，返
        return null;
    }
}
// ========== 主函
/**
 *
 *
 *
 */
export async function buildSystemPrompt(options = {}) {
    const { projectPath, replaceDefault, append, mode, includeEnvironment = true, } = options;
    const parts = [];
    const sources = [];
    // 1. 环境上下文（始终在最前
    if (includeEnvironment) {
        const envContext = getEnvironmentContext();
        parts.push(envContext);
        sources.push({
            name: 'environment',
            loaded: true,
            length: envContext.length,
        });
    }
    // 2. 基础提示词（Plan 模式使用独
    const isPlanMode = mode === 'plan';
    let basePrompt;
    let baseName;
    if (isPlanMode) {
        basePrompt = PLAN_MODE_SYSTEM_PROMPT;
        baseName = 'plan_mode';
    }
    else if (replaceDefault) {
        basePrompt = replaceDefault;
        baseName = 'custom';
    }
    else {
        basePrompt = DEFAULT_SYSTEM_PROMPT;
        baseName = 'default';
    }
    parts.push(basePrompt);
    sources.push({
        name: baseName,
        loaded: true,
        length: basePrompt.length,
    });
    // 3. 可用 Skills 列表（渐进式披露的"发现阶
    const skillRegistry = getSkillRegistry();
    if (skillRegistry.isInitialized()) {
        const skillsList = skillRegistry.generateAvailableSkillsList();
        if (skillsList) {
            const skillsSection = `# Available Skills

${skillsList}

When a user request matches a skill's description, use the Skill tool to load its full instructions.`;
            parts.push(skillsSection);
            sources.push({
                name: 'skills',
                loaded: true,
                length: skillsSection.length,
            });
        }
    }
    // 4. 项目配置（CLAWDCODE.md）- 始终尝试加
    const projectConfig = await loadProjectConfig(projectPath);
    if (projectConfig) {
        parts.push(`# Project Configuration\n\n${projectConfig}`);
        sources.push({
            name: 'project_config',
            loaded: true,
            length: projectConfig.length,
            path: path.join(projectPath || process.cwd(), PROJECT_CONFIG_FILENAME),
        });
    }
    else {
        sources.push({
            name: 'project_config',
            loaded: false,
            length: 0,
        });
    }
    // 5. 追加内
    if (append?.trim()) {
        parts.push(append.trim());
        sources.push({
            name: 'append',
            loaded: true,
            length: append.trim().length,
        });
    }
    // 用 --- 分隔各部
    parts.unshift('Be a good assistant');
    return {
        prompt: parts.join('\n\n---\n\n'),
        sources,
    };
}
/**
 *
 */
export function getPromptStats(result) {
    const totalLength = result.prompt.length;
    const loadedSources = result.sources.filter(s => s.loaded);
    const details = result.sources
        .map(s => `  - ${s.name}: ${s.loaded ? `${s.length} chars` : 'not loaded'}`)
        .join('\n');
    return `Prompt Stats:
- Total: ${totalLength} chars
- Sources: ${loadedSources.length}/${result.sources.length} loaded
${details}`;
}
//# sourceMappingURL=builder.js.map