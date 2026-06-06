/**
 * 
 * 
 * 
 * 
 */

export * from './types.js';
export * from './SkillLoader.js';
export { SkillRegistry, getSkillRegistry } from './SkillRegistry.js';
import { getSkillRegistry } from './SkillRegistry.js';

/**
 * 
 * 
 */
export async function initializeSkills(workspaceRoot?: string) {
  const registry = getSkillRegistry();
  return registry.initialize(workspaceRoot);
}

/**
 * 
 * 
 */
export async function loadSkillContent(name: string) {
  const registry = getSkillRegistry();
  return registry.loadContent(name);
}

/**
 * 
 */
export function generateSkillsPrompt(): string {
  const registry = getSkillRegistry();
  return registry.generateAvailableSkillsList();
}
