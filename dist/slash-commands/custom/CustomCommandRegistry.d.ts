/**
 * CustomCommandRegistry - 自定义命令注册中心
 *
 *
 */
import type { CustomCommand, CustomCommandExecutionContext, CustomCommandDiscoveryResult } from '../types.js';
/**
 *
 */
export declare class CustomCommandRegistry {
    private static instance;
    private commands;
    private loader;
    private executor;
    private initialized;
    private constructor();
    /**
     *
     */
    static getInstance(): CustomCommandRegistry;
    /**
     *
     */
    initialize(workspaceRoot: string): Promise<CustomCommandDiscoveryResult>;
    /**
     *
     */
    isInitialized(): boolean;
    /**
     *
     */
    getCommand(name: string, namespace?: string): CustomCommand | undefined;
    /**
     *
     */
    getAllCommands(): CustomCommand[];
    /**
     *
     *
     *
     * - 有 description
     * - 没有设置 disableModelInvocation: true
     */
    getModelInvocableCommands(): CustomCommand[];
    /**
     *
     */
    executeCommand(name: string, context: CustomCommandExecutionContext, namespace?: string): Promise<string | null>;
    /**
     *
     *
     *
     *
     */
    getCommandLabel(cmd: CustomCommand): string;
    /**
     *
     */
    private getCommandKey;
    /**
     *
     */
    reload(workspaceRoot: string): Promise<CustomCommandDiscoveryResult>;
    /**
     *
     */
    get size(): number;
}
//# sourceMappingURL=CustomCommandRegistry.d.ts.map