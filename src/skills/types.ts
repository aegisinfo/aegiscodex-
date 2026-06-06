/**
 * 
 * 
 */

/**
 */
export type SkillSource = 'user' | 'project' | 'builtin';

/**
 * 
 * 
 */
export interface SkillMetadata {
  
  name: string;
  
  
  description: string;
  
  
  allowedTools?: string[];
  
  
  argumentHint?: string;
  
  
  userInvocable: boolean;
  
  
  disableModelInvocation: boolean;
  
  
  model?: string;
  
  
  whenToUse?: string;
  
  
  version?: string;
  
  
  source: SkillSource;
  
  
  sourceDir: 'claude' | 'aegis';
  
  
  path: string;
  
  
  basePath: string;
}

/**
 * 
 * 
 */
export interface SkillContent {
  metadata: SkillMetadata;
  
  instructions: string;
}

/**
 */
export interface SkillFrontmatter {
  
  name: string;
  
  
  description: string;
  
  
  'allowed-tools'?: string[];
  
  
  'user-invocable'?: boolean;
  
  
  'disable-model-invocation'?: boolean;
  
  
  'argument-hint'?: string;
  
  
  model?: string;
  
  
  when_to_use?: string;
  
  
  version?: string;
}

/**
 * 
 */
export interface ParsedSkillFile {
  frontmatter: SkillFrontmatter;
  body: string;
}

/**
 */
export interface SkillDiscoveryResult {
  
  count: number;
  
  bySource: {
    user: number;
    project: number;
    builtin: number;
  };
  
  errors: Array<{
    path: string;
    error: string;
  }>;
}

/**
 */
export interface SkillToolParams {
  
  skill: string;
  
  args?: string;
}

/**
 */
export interface SkillToolResult {
  success: boolean;
  content?: string;
  error?: string;
}
