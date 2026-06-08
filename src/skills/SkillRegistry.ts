/**
 * SkillRegistry - Skills 注册中心
 * 
 * 
 * 
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseSkillFile, extractMetadataFields } from './SkillLoader.js';
import type {
  SkillMetadata,
  SkillContent,
  SkillSource,
  SkillDiscoveryResult,
} from './types.js';

/**
 * 
 */
const BUILTIN_SKILLS: Map<string, SkillContent> = new Map([
  // skill-creator 内
  ['skill-creator', {
    metadata: {
      name: 'skill-creator',
      description: 'Create and manage custom skills. Use when you want to add new SKILL.md files.',
      userInvocable: true,
      disableModelInvocation: false,
      source: 'builtin',
      sourceDir: 'aegis',
      path: '',
      basePath: '',
    },
    instructions: `# Skill Creator 指南

你是一个 Skill 创建助手。帮助用户创建新的 SKILL.md 文件。

## SKILL.md 格式

\`\`\`markdown
---
name: my-skill
description: 简短描述这个 Skill 做什么，以及何时使用它。
allowed-tools:
  - Read
  - Grep
  - Bash(git:*)
user-invocable: true
---

# Skill 标题

详细的指令内容...
\`\`\`

## 必填字段

- **name**: 1-64 字符，小写字母+数字+连字符
- **description**: ≤1024 字符，描述功能和触发时机

## 可选字段

- **allowed-tools**: 限制可用工具
- **user-invocable**: 允许 /name 调用
- **disable-model-invocation**: 禁止 AI 自动调用
- **argument-hint**: 参数提示，如 \`<file_path>\`

## 存放位置

- 项目级（Git 共享）: \`.aegis/skills/<name>/SKILL.md\`
- 用户级（全局）: \`~/.aegis/skills/<name>/SKILL.md\`

## 示例

请告诉我你想创建什么类型的 Skill，我会帮你生成完整的 SKILL.md 文件。
`,
  }],
]);

/**
 * Skills 注册中心（单例）
 */
export class SkillRegistry {
  private static instance: SkillRegistry | null = null;
  private skills: Map<string, SkillMetadata> = new Map();
  private initialized = false;
  private workspaceRoot: string = process.cwd();

  private constructor() {}

  /**
   * 
   */
  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  /**
   * 
   */
  static resetInstance(): void {
    SkillRegistry.instance = null;
  }

  /**
   * 
   * 
   * 
   * 1. 内置 Skills
   * 2. ~/.claude/skills
   * 3. ~/.aegis/skills
   * 4. .claude/skills
   * 5. .aegis/skills（最高优先级）
   */
  async initialize(workspaceRoot?: string): Promise<SkillDiscoveryResult> {
    if (workspaceRoot) {
      this.workspaceRoot = workspaceRoot;
    }

    const result: SkillDiscoveryResult = {
      count: 0,
      bySource: { user: 0, project: 0, builtin: 0 },
      errors: [],
    };

    // 1. 加载内置 Skills（优先级最
    this.loadBuiltinSkills();
    result.bySource.builtin = BUILTIN_SKILLS.size;

    // 2. 按优先级扫描目录（后加载的覆盖先加载
    const homeDir = os.homedir();

    // 用户级 - claude 目
    await this.scanDirectory(
      path.join(homeDir, '.claude', 'skills'),
      'user',
      'claude',
      result
    );

    // 用户级 - aegis 目
    await this.scanDirectory(
      path.join(homeDir, '.aegis', 'skills'),
      'user',
      'aegis',
      result
    );

    // 项目级 - claude 目
    await this.scanDirectory(
      path.join(this.workspaceRoot, '.claude', 'skills'),
      'project',
      'claude',
      result
    );

    // 项目级 - aegis 目录（最高优先
    await this.scanDirectory(
      path.join(this.workspaceRoot, '.aegis', 'skills'),
      'project',
      'aegis',
      result
    );

    result.count = this.skills.size;
    this.initialized = true;

    return result;
  }

  /**
   * 
   */
  private loadBuiltinSkills(): void {
    for (const [name, content] of BUILTIN_SKILLS) {
      this.skills.set(name, content.metadata);
    }
  }

  /**
   * 
   */
  private async scanDirectory(
    dir: string,
    source: SkillSource,
    sourceDir: 'claude' | 'aegis',
    result: SkillDiscoveryResult
  ): Promise<void> {
    if (!fs.existsSync(dir)) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(dir, entry.name);
      const skillPath = path.join(skillDir, 'SKILL.md');

      if (!fs.existsSync(skillPath)) continue;

      try {
        const metadata = await this.loadMetadata(skillPath, source, sourceDir);
        this.skills.set(metadata.name, metadata);
        
        if (source === 'user') {
          result.bySource.user++;
        } else {
          result.bySource.project++;
        }
      } catch (error) {
        result.errors.push({
          path: skillPath,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * 
   */
  private async loadMetadata(
    skillPath: string,
    source: SkillSource,
    sourceDir: 'claude' | 'aegis'
  ): Promise<SkillMetadata> {
    const content = await fs.promises.readFile(skillPath, 'utf-8');
    const { frontmatter } = parseSkillFile(content);
    const fields = extractMetadataFields(frontmatter);

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      ...fields,
      source,
      sourceDir,
      path: skillPath,
      basePath: path.dirname(skillPath),
    };
  }

  /**
   * 
   */
  async loadContent(name: string): Promise<SkillContent | null> {
    const metadata = this.skills.get(name);
    if (!metadata) {
      return null;
    }

    // 内置 Skill 直接返
    if (metadata.source === 'builtin') {
      return BUILTIN_SKILLS.get(name) || null;
    }

    // 从文件加
    try {
      const content = await fs.promises.readFile(metadata.path, 'utf-8');
      const { body } = parseSkillFile(content);

      return {
        metadata,
        instructions: body,
      };
    } catch {
      return null;
    }
  }

  /**
   * 
   */
  getAllSkills(): SkillMetadata[] {
    return Array.from(this.skills.values());
  }

  /**
   * 
   */
  getModelInvocableSkills(): SkillMetadata[] {
    return Array.from(this.skills.values())
      .filter(skill => !skill.disableModelInvocation);
  }

  /**
   * 
   */
  getUserInvocableSkills(): SkillMetadata[] {
    return Array.from(this.skills.values())
      .filter(skill => skill.userInvocable);
  }

  /**
   * 
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 
   */
  getSkill(name: string): SkillMetadata | undefined {
    return this.skills.get(name);
  }

  /**
   * 
   */
  getCount(): number {
    return this.skills.size;
  }

  /**
   * 
   */
  async refresh(): Promise<SkillDiscoveryResult> {
    this.skills.clear();
    this.initialized = false;
    return this.initialize(this.workspaceRoot);
  }

  /**
   * 
   * 
   * 
   */
  generateAvailableSkillsList(): string {
    const skills = this.getModelInvocableSkills();
    if (skills.length === 0) {
      return '';
    }

    const lines = skills.map(skill => {
      const hint = skill.argumentHint ? ` ${skill.argumentHint}` : '';
      return `- ${skill.name}${hint}: ${skill.description}`;
    });

    return `<available_skills>
${lines.join('\n')}
</available_skills>`;
  }

  /**
   * 
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例获取函
export function getSkillRegistry(): SkillRegistry {
  return SkillRegistry.getInstance();
}
