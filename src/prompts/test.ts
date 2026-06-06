/**
 * 
 * 
 * 
 */

import { buildSystemPrompt, getPromptStats } from './builder.js';
import { getEnvironmentContext, getEnvironmentInfo } from '../utils/environment.js';
import { DEFAULT_SYSTEM_PROMPT } from './default.js';
import { PLAN_MODE_SYSTEM_PROMPT, createPlanModeReminder } from './plan.js';

async function testPromptSystem() {

  const envInfo = getEnvironmentInfo();

  const envContext = getEnvironmentContext();

  const reminder = createPlanModeReminder('Help me analyze this code');

  const defaultResult = await buildSystemPrompt({
    projectPath: process.cwd(),
    includeEnvironment: true,
  });

  const planResult = await buildSystemPrompt({
    projectPath: process.cwd(),
    mode: 'plan',
    includeEnvironment: true,
  });

  const appendResult = await buildSystemPrompt({
    append: '： TypeScript',
  });

}

testPromptSystem().catch(console.error);
