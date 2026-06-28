/**
 * Skill 工具
 * 
 * 
 * 
 */

import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind } from '../types.js';
import { getSkillRegistry } from '../../skills/index.js';

/**
 * Skill 工具参数 Schema
 */
const SkillSchema = z.object({
  skill: z.string().describe('The name of the skill to load'),
  args: z.string().optional().describe('Optional arguments to pass to the skill'),
});

/**
 * Skill 工具
 * 
 * 
 * 
 */
export const skillTool = createTool({
  name: 'Skill',
  displayName: 'Load Skill',
  kind: ToolKind.ReadOnly,
  schema: SkillSchema,

  description: {
    short: 'Load a skill to get specialized instructions',
    long: `Load a skill to get specialized instructions for a task.

Use this tool when:
- You need specific guidance for a task that matches an available skill
- The user explicitly requests to use a skill
- You want to follow best practices defined in a skill

The skill's instructions will be returned and you should follow them.`,
  },

  execute: async ({ skill, args }) => {
    const registry = getSkillRegistry();
    
    // 检查 Skill 是否存
    if (!registry.hasSkill(skill)) {
      const allSkills = registry.getAllSkills();
      const availableNames = allSkills.map(s => s.name).join(', ');
      const errorMsg = `Skill "${skill}" not found. Available skills: ${availableNames || 'none'}`;
      
      return {
        success: false,
        llmContent: errorMsg,
        displayContent: errorMsg,
      };
    }

    // 加载完整内
    const content = await registry.loadContent(skill);
    
    if (!content) {
      const errorMsg = `Failed to load skill "${skill}"`;
      return {
        success: false,
        llmContent: errorMsg,
        displayContent: errorMsg,
      };
    }

    // 构建返回内
    let result = `## Skill: ${content.metadata.name}\n\n`;
    
    // 如果有工具限制，提
    if (content.metadata.allowedTools && content.metadata.allowedTools.length > 0) {
      result += `**Allowed tools for this skill:** ${content.metadata.allowedTools.join(', ')}\n\n`;
    }
    
    // 添加指令内
    result += content.instructions;
    
    // 如果有参数，添加到末
    if (args) {
      result += `\n\n## Arguments\n\n${args}`;
    }

    return {
      success: true,
      llmContent: result,
      displayContent: `✓ Loaded skill: ${content.metadata.name}`,
    };
  },
});

export default skillTool;
