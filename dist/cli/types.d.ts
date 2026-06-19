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
    debug?: boolean;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    maxTurns?: number;
    router?: boolean;
    permissionMode?: PermissionMode;
    yolo?: boolean;
    allowedTools?: string[];
    disallowedTools?: string[];
    continue?: boolean;
    resume?: string | boolean;
    print?: boolean;
    outputFormat?: 'text' | 'json';
    theme?: ThemeName;
    plain?: boolean;
    init?: boolean;
    message?: string;
}
/**
 *
 *
 */
export type MiddlewareFunction<T = CliArguments> = (argv: T) => void | Promise<void>;
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
//# sourceMappingURL=types.d.ts.map