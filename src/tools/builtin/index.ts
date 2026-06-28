/**
 * 
 */

// 文件工
export { readTool } from './read.js';
export { editTool } from './edit.js';
export { writeTool } from './write.js';

// 搜索工
export { grepTool } from './grep.js';
export { globTool } from './glob.js';

// Shell 工
export { bashTool } from './bash.js';

// Skills 工
export { skillTool } from './skill.js';

// Memory 工
export { memoryTool } from './memory.js';

// Multi-agent orchestration 工
export { taskTool } from './task.js';
export { councilTool } from './council.js';

import { readTool } from './read.js';
import { editTool } from './edit.js';
import { writeTool } from './write.js';
import { grepTool } from './grep.js';
import { globTool } from './glob.js';
import { bashTool } from './bash.js';
import { skillTool } from './skill.js';
import { memoryTool } from './memory.js';
import { taskTool } from './task.js';
import { councilTool } from './council.js';
import type { Tool } from '../types.js';

/**
 * 
 */
export function getBuiltinTools(): Tool[] {
  return [
    // 文件工
    readTool,
    editTool,
    writeTool,
    // 搜索工
    grepTool,
    globTool,
    // Shell 工
    bashTool,
    // Skills 工
    skillTool,
    // Memory 工
    memoryTool,
    // Multi-agent orchestration 工
    taskTool,
    councilTool,
  ];
}
