/**
 * CLI 类型定义
 */

import type { Arguments } from 'yargs';

/**
 * 
 */
export type PermissionMode = 'default' | 'autoEdit' | 'yolo';

/**
 * UI 主题
 */
export type ThemeName = 'default' | 'dark' | 'ocean' | 'forest' | 'sunset';

/**
 * CLI 参数接口
 */
export interface CliArguments extends Arguments {
  // 调试选
  debug?: boolean;

  // AI 选
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTurns?: number;

  // 安全选
  permissionMode?: PermissionMode;
  yolo?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];

  // 会话选
  continue?: boolean;
  resume?: string | boolean;

  // 输出选
  print?: boolean;
  outputFormat?: 'text' | 'json';

  // UI 选
  theme?: ThemeName;
  plain?: boolean;

  // 命令相
  init?: boolean;

  // 位置参数（初始消
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
 * App Props - 传递给 UI 组件的属性
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
