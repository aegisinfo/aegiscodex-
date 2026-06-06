/**
 * 
 * 
 */

import type {
  CustomCommand,
  CustomCommandExecutionContext,
  CustomCommandDiscoveryResult,
} from '../types.js';
import { CustomCommandLoader } from './CustomCommandLoader.js';
import { CustomCommandExecutor } from './CustomCommandExecutor.js';

/**
 * 
 */
export class CustomCommandRegistry {
  private static instance: CustomCommandRegistry;
  
  private commands: Map<string, CustomCommand> = new Map();
  private loader = new CustomCommandLoader();
  private executor = new CustomCommandExecutor();
  private initialized = false;

  private constructor() {}

  /**
   * 
   */
  static getInstance(): CustomCommandRegistry {
    if (!CustomCommandRegistry.instance) {
      CustomCommandRegistry.instance = new CustomCommandRegistry();
    }
    return CustomCommandRegistry.instance;
  }

  /**
   * 
   */
  async initialize(workspaceRoot: string): Promise<CustomCommandDiscoveryResult> {
    const result = await this.loader.discover(workspaceRoot);
    this.commands.clear();
    for (const cmd of result.commands) {
      const key = this.getCommandKey(cmd.name, cmd.namespace);
      this.commands.set(key, cmd);
    }

    this.initialized = true;
    return result;
  }

  /**
   * 
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 
   */
  getCommand(name: string, namespace?: string): CustomCommand | undefined {
    if (namespace) {
      const key = this.getCommandKey(name, namespace);
      const cmd = this.commands.get(key);
      if (cmd) return cmd;
    }
    return this.commands.get(name);
  }

  /**
   * 
   */
  getAllCommands(): CustomCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 
   * 
   * 
   */
  getModelInvocableCommands(): CustomCommand[] {
    return this.getAllCommands().filter(
      (cmd) => cmd.config.description && !cmd.config.disableModelInvocation
    );
  }

  /**
   * 
   */
  async executeCommand(
    name: string,
    context: CustomCommandExecutionContext,
    namespace?: string
  ): Promise<string | null> {
    const cmd = this.getCommand(name, namespace);
    if (!cmd) return null;

    return this.executor.execute(cmd, context);
  }

  /**
   * 
   * 
   * 
   * 
   */
  getCommandLabel(cmd: CustomCommand): string {
    const base = cmd.source === 'project' ? 'project' : 'user';
    return cmd.namespace ? `(${base}:${cmd.namespace})` : `(${base})`;
  }

  /**
   * 
   */
  private getCommandKey(name: string, namespace?: string): string {
    return namespace ? `${namespace}/${name}` : name;
  }

  /**
   * 
   */
  async reload(workspaceRoot: string): Promise<CustomCommandDiscoveryResult> {
    return this.initialize(workspaceRoot);
  }

  /**
   * 
   */
  get size(): number {
    return this.commands.size;
  }
}
