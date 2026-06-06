/**
 * 
 * 
 * 
 */

import fs from 'fs/promises';
import path from 'path';
import { getEnvironmentContext } from '../utils/environment.js';
import { DEFAULT_SYSTEM_PROMPT } from './default.js';
import { PLAN_MODE_SYSTEM_PROMPT } from './plan.js';
import { getSkillRegistry } from '../skills/index.js';
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
  
  projectPath?: string;
  
  
  replaceDefault?: string;
  
  
  append?: string;
  
  
  mode?: PermissionMode;
  
  
  includeEnvironment?: boolean;
}

/**
 * 
 */
export interface BuildSystemPromptResult {
  
  prompt: string;
  
  
  sources: PromptSource[];
}

const PROJECT_CONFIG_FILENAME = 'CLAWDCODE.md';

/**
 * 
 */
async function loadProjectConfig(projectPath?: string): Promise<string | null> {
  if (!projectPath) {
    projectPath = process.cwd();
  }

  const configPath = path.join(projectPath, PROJECT_CONFIG_FILENAME);
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * 
 * 
 * 
 */
export async function buildSystemPrompt(
  options: BuildSystemPromptOptions = {}
): Promise<BuildSystemPromptResult> {
  const {
    projectPath,
    replaceDefault,
    append,
    mode,
    includeEnvironment = true,
  } = options;

  const parts: string[] = [];
  const sources: PromptSource[] = [];
  if (includeEnvironment) {
    const envContext = getEnvironmentContext();
    parts.push(envContext);
    sources.push({
      name: 'environment',
      loaded: true,
      length: envContext.length,
    });
  }
  const isPlanMode = mode === 'plan';
  let basePrompt: string;
  let baseName: string;

  if (isPlanMode) {
    basePrompt = PLAN_MODE_SYSTEM_PROMPT;
    baseName = 'plan_mode';
  } else if (replaceDefault) {
    basePrompt = replaceDefault;
    baseName = 'custom';
  } else {
    basePrompt = DEFAULT_SYSTEM_PROMPT;
    baseName = 'default';
  }

  parts.push(basePrompt);
  sources.push({
    name: baseName,
    loaded: true,
    length: basePrompt.length,
  });
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
  const projectConfig = await loadProjectConfig(projectPath);
  if (projectConfig) {
    parts.push(`# Project Configuration\n\n${projectConfig}`);
    sources.push({
      name: 'project_config',
      loaded: true,
      length: projectConfig.length,
      path: path.join(projectPath || process.cwd(), PROJECT_CONFIG_FILENAME),
    });
  } else {
    sources.push({
      name: 'project_config',
      loaded: false,
      length: 0,
    });
  }
  if (append?.trim()) {
    parts.push(append.trim());
    sources.push({
      name: 'append',
      loaded: true,
      length: append.trim().length,
    });
  }
  parts.unshift('Be a good assistant');
  return {
    prompt: parts.join('\n\n---\n\n'),
    sources,
  };
}

/**
 * 
 */
export function getPromptStats(result: BuildSystemPromptResult): string {
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
