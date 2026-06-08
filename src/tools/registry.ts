/**
 * 
 * 
 * 
 */

import { EventEmitter } from 'events';
import type { Tool, FunctionDeclaration } from './types.js';

/**
 * 
 */
export interface ToolRegisteredEvent {
  type: 'builtin' | 'mcp';
  tool: Tool;
}

/**
 * 
 */
export class ToolRegistry extends EventEmitter {
  /** 内置工具 */
  private tools = new Map<string, Tool>();
  
  /** MCP 工具 */
  private mcpTools = new Map<string, Tool>();
  
  /** 分类索引 */
  private categories = new Map<string, Set<string>>();
  
  /** 标签索引 */
  private tagIndex = new Map<string, Set<string>>();

  /**
   * 
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name) || this.mcpTools.has(tool.name)) {
      throw new Error(`工具 '${tool.name}' 已注册`);
    }
    
    this.tools.set(tool.name, tool);
    this.updateIndexes(tool);
    this.emit('toolRegistered', { type: 'builtin', tool } as ToolRegisteredEvent);
  }

  /**
   * 
   */
  registerMcpTool(tool: Tool): void {
    if (this.tools.has(tool.name) || this.mcpTools.has(tool.name)) {
      throw new Error(`工具 '${tool.name}' 已注册`);
    }
    
    this.mcpTools.set(tool.name, tool);
    this.updateIndexes(tool);
    this.emit('toolRegistered', { type: 'mcp', tool } as ToolRegisteredEvent);
  }

  /**
   * 
   */
  registerMcpTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerMcpTool(tool);
    }
  }

  /**
   * 
   */
  unregisterMcpTool(name: string): boolean {
    const tool = this.mcpTools.get(name);
    if (!tool) return false;

    this.mcpTools.delete(name);
    this.removeFromIndexes(tool);
    this.emit('toolUnregistered', { type: 'mcp', tool });
    return true;
  }

  /**
   * 
   */
  clearMcpTools(): void {
    for (const tool of this.mcpTools.values()) {
      this.removeFromIndexes(tool);
    }
    this.mcpTools.clear();
  }

  /**
   * 
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name) || this.mcpTools.get(name);
  }

  /**
   * 
   */
  has(name: string): boolean {
    return this.tools.has(name) || this.mcpTools.has(name);
  }

  /**
   * 
   */
  getAll(): Tool[] {
    return [...this.tools.values(), ...this.mcpTools.values()];
  }

  /**
   * 
   */
  getBuiltinTools(): Tool[] {
    return [...this.tools.values()];
  }

  /**
   * 
   */
  getMcpTools(): Tool[] {
    return [...this.mcpTools.values()];
  }

  /**
   * 
   */
  getNames(): string[] {
    return [...this.tools.keys(), ...this.mcpTools.keys()];
  }

  /**
   * 
   */
  getReadOnlyTools(): Tool[] {
    return this.getAll().filter(tool => tool.isReadOnly);
  }

  /**
   * 
   */
  getWriteTools(): Tool[] {
    return this.getAll().filter(tool => !tool.isReadOnly);
  }

  /**
   * 
   */
  getByCategory(category: string): Tool[] {
    const names = this.categories.get(category);
    if (!names) return [];
    return [...names].map(name => this.tools.get(name)!).filter(Boolean);
  }

  /**
   * 
   */
  getByTag(tag: string): Tool[] {
    const names = this.tagIndex.get(tag);
    if (!names) return [];
    return [...names].map(name => this.tools.get(name)!).filter(Boolean);
  }

  /**
   * 
   */
  getCategories(): string[] {
    return [...this.categories.keys()];
  }

  /**
   * 
   */
  getTags(): string[] {
    return [...this.tagIndex.keys()];
  }

  /**
   * 
   */
  getFunctionDeclarations(): FunctionDeclaration[] {
    return this.getAll().map(tool => tool.getFunctionDeclaration());
  }

  /**
   * 
   */
  getFunctionDeclarationsByMode(mode?: string): FunctionDeclaration[] {
    if (mode === 'plan') {
      // Plan 模式只返回只读工
      return this.getReadOnlyTools().map(t => t.getFunctionDeclaration());
    }
    return this.getFunctionDeclarations();
  }

  /**
   * 
   */
  search(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.displayName.toLowerCase().includes(lowerQuery) ||
      tool.description.short.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 
   */
  get size(): number {
    return this.tools.size + this.mcpTools.size;
  }

  /**
   * 
   */
  get builtinSize(): number {
    return this.tools.size;
  }

  /**
   * 
   */
  get mcpSize(): number {
    return this.mcpTools.size;
  }

  /**
   * 
   */
  clear(): void {
    this.tools.clear();
    this.mcpTools.clear();
    this.categories.clear();
    this.tagIndex.clear();
  }

  /**
   * 
   */
  private updateIndexes(tool: Tool): void {
    // 更新分类索
    if (tool.category) {
      if (!this.categories.has(tool.category)) {
        this.categories.set(tool.category, new Set());
      }
      this.categories.get(tool.category)!.add(tool.name);
    }

    // 更新标签索
    for (const tag of tool.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(tool.name);
    }
  }

  /**
   * 
   */
  private removeFromIndexes(tool: Tool): void {
    // 从分类索引中移
    if (tool.category) {
      const categorySet = this.categories.get(tool.category);
      if (categorySet) {
        categorySet.delete(tool.name);
        if (categorySet.size === 0) {
          this.categories.delete(tool.category);
        }
      }
    }

    // 从标签索引中移
    for (const tag of tool.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(tool.name);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }
}

/**
 * 
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
