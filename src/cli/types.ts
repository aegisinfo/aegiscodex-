/**
 */

import type { Arguments } from 'yargs';

/**
 * 
 */
export type PermissionMode = 'default' | 'autoEdit' | 'yolo';

/**
 */
export type ThemeName = 'default' | 'dark' | 'ocean' | 'forest' | 'sunset';

/**
 */
export interface CliArguments extends Arguments {
  debug?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTurns?: number;
  permissionMode?: PermissionMode;
  yolo?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  continue?: boolean;
  resume?: string | boolean;
  print?: boolean;
  outputFormat?: 'text' | 'json';
  theme?: ThemeName;
  init?: boolean;
  message?: string;
}

/**
 * 
 * 
 */
export type MiddlewareFunction<T = CliArguments> = (
  argv: T
) => void | Promise<void>;

/**
 */
export interface AppProps {
  apiKey: string;
  baseURL?: string;
  model?: string;
  initialMessage?: string;
  debug?: boolean;
  permissionMode?: PermissionMode;
  resumeSessionId?: string;
}
