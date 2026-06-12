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
export declare class ToolRegistry extends EventEmitter {
    /** 内置工具 */
    private tools;
    /** MCP 工具 */
    private mcpTools;
    /** 分类索引 */
    private categories;
    /** 标签索引 */
    private tagIndex;
    /**
     *
     */
    register(tool: Tool): void;
    /**
     *
     */
    registerMcpTool(tool: Tool): void;
    /**
     *
     */
    registerMcpTools(tools: Tool[]): void;
    /**
     *
     */
    unregisterMcpTool(name: string): boolean;
    /**
     *
     */
    clearMcpTools(): void;
    /**
     *
     */
    registerAll(tools: Tool[]): void;
    /**
     *
     */
    get(name: string): Tool | undefined;
    /**
     *
     */
    has(name: string): boolean;
    /**
     *
     */
    getAll(): Tool[];
    /**
     *
     */
    getBuiltinTools(): Tool[];
    /**
     *
     */
    getMcpTools(): Tool[];
    /**
     *
     */
    getNames(): string[];
    /**
     *
     */
    getReadOnlyTools(): Tool[];
    /**
     *
     */
    getWriteTools(): Tool[];
    /**
     *
     */
    getByCategory(category: string): Tool[];
    /**
     *
     */
    getByTag(tag: string): Tool[];
    /**
     *
     */
    getCategories(): string[];
    /**
     *
     */
    getTags(): string[];
    /**
     *
     */
    getFunctionDeclarations(): FunctionDeclaration[];
    /**
     *
     */
    getFunctionDeclarationsByMode(mode?: string): FunctionDeclaration[];
    /**
     *
     */
    search(query: string): Tool[];
    /**
     *
     */
    get size(): number;
    /**
     *
     */
    get builtinSize(): number;
    /**
     *
     */
    get mcpSize(): number;
    /**
     *
     */
    clear(): void;
    /**
     *
     */
    private updateIndexes;
    /**
     *
     */
    private removeFromIndexes;
}
/**
 *
 */
export declare function createToolRegistry(): ToolRegistry;
//# sourceMappingURL=registry.d.ts.map