/**
 * 
 */
export { readTool } from './read.js';
export { editTool } from './edit.js';
export { writeTool } from './write.js';
export { grepTool } from './grep.js';
export { bashTool } from './bash.js';
export { skillTool } from './skill.js';

import { readTool } from './read.js';
import { editTool } from './edit.js';
import { writeTool } from './write.js';
import { grepTool } from './grep.js';
import { bashTool } from './bash.js';
import { skillTool } from './skill.js';
import type { Tool } from '../types.js';

/**
 * 
 */
export function getBuiltinTools(): Tool[] {
  return [
    readTool,
    editTool,
    writeTool,
    grepTool,
    bashTool,
    skillTool,
  ];
}
