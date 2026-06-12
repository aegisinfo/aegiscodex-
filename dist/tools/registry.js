/**
 *
 *
 *
 */
import { EventEmitter } from 'events';
/**
 *
 */
export class ToolRegistry extends EventEmitter {
    /** 内置工具 */
    tools = new Map();
    /** MCP 工具 */
    mcpTools = new Map();
    /** 分类索引 */
    categories = new Map();
    /** 标签索引 */
    tagIndex = new Map();
    /**
     *
     */
    register(tool) {
        if (this.tools.has(tool.name) || this.mcpTools.has(tool.name)) {
            throw new Error(`工具 '${tool.name}' 已注册`);
        }
        this.tools.set(tool.name, tool);
        this.updateIndexes(tool);
        this.emit('toolRegistered', { type: 'builtin', tool });
    }
    /**
     *
     */
    registerMcpTool(tool) {
        if (this.tools.has(tool.name) || this.mcpTools.has(tool.name)) {
            throw new Error(`工具 '${tool.name}' 已注册`);
        }
        this.mcpTools.set(tool.name, tool);
        this.updateIndexes(tool);
        this.emit('toolRegistered', { type: 'mcp', tool });
    }
    /**
     *
     */
    registerMcpTools(tools) {
        for (const tool of tools) {
            this.registerMcpTool(tool);
        }
    }
    /**
     *
     */
    unregisterMcpTool(name) {
        const tool = this.mcpTools.get(name);
        if (!tool)
            return false;
        this.mcpTools.delete(name);
        this.removeFromIndexes(tool);
        this.emit('toolUnregistered', { type: 'mcp', tool });
        return true;
    }
    /**
     *
     */
    clearMcpTools() {
        for (const tool of this.mcpTools.values()) {
            this.removeFromIndexes(tool);
        }
        this.mcpTools.clear();
    }
    /**
     *
     */
    registerAll(tools) {
        for (const tool of tools) {
            this.register(tool);
        }
    }
    /**
     *
     */
    get(name) {
        return this.tools.get(name) || this.mcpTools.get(name);
    }
    /**
     *
     */
    has(name) {
        return this.tools.has(name) || this.mcpTools.has(name);
    }
    /**
     *
     */
    getAll() {
        return [...this.tools.values(), ...this.mcpTools.values()];
    }
    /**
     *
     */
    getBuiltinTools() {
        return [...this.tools.values()];
    }
    /**
     *
     */
    getMcpTools() {
        return [...this.mcpTools.values()];
    }
    /**
     *
     */
    getNames() {
        return [...this.tools.keys(), ...this.mcpTools.keys()];
    }
    /**
     *
     */
    getReadOnlyTools() {
        return this.getAll().filter(tool => tool.isReadOnly);
    }
    /**
     *
     */
    getWriteTools() {
        return this.getAll().filter(tool => !tool.isReadOnly);
    }
    /**
     *
     */
    getByCategory(category) {
        const names = this.categories.get(category);
        if (!names)
            return [];
        return [...names].map(name => this.tools.get(name)).filter(Boolean);
    }
    /**
     *
     */
    getByTag(tag) {
        const names = this.tagIndex.get(tag);
        if (!names)
            return [];
        return [...names].map(name => this.tools.get(name)).filter(Boolean);
    }
    /**
     *
     */
    getCategories() {
        return [...this.categories.keys()];
    }
    /**
     *
     */
    getTags() {
        return [...this.tagIndex.keys()];
    }
    /**
     *
     */
    getFunctionDeclarations() {
        return this.getAll().map(tool => tool.getFunctionDeclaration());
    }
    /**
     *
     */
    getFunctionDeclarationsByMode(mode) {
        if (mode === 'plan') {
            // Plan 模式只返回只读工
            return this.getReadOnlyTools().map(t => t.getFunctionDeclaration());
        }
        return this.getFunctionDeclarations();
    }
    /**
     *
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAll().filter(tool => tool.name.toLowerCase().includes(lowerQuery) ||
            tool.displayName.toLowerCase().includes(lowerQuery) ||
            tool.description.short.toLowerCase().includes(lowerQuery));
    }
    /**
     *
     */
    get size() {
        return this.tools.size + this.mcpTools.size;
    }
    /**
     *
     */
    get builtinSize() {
        return this.tools.size;
    }
    /**
     *
     */
    get mcpSize() {
        return this.mcpTools.size;
    }
    /**
     *
     */
    clear() {
        this.tools.clear();
        this.mcpTools.clear();
        this.categories.clear();
        this.tagIndex.clear();
    }
    /**
     *
     */
    updateIndexes(tool) {
        // 更新分类索
        if (tool.category) {
            if (!this.categories.has(tool.category)) {
                this.categories.set(tool.category, new Set());
            }
            this.categories.get(tool.category).add(tool.name);
        }
        // 更新标签索
        for (const tag of tool.tags) {
            if (!this.tagIndex.has(tag)) {
                this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag).add(tool.name);
        }
    }
    /**
     *
     */
    removeFromIndexes(tool) {
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
export function createToolRegistry() {
    return new ToolRegistry();
}
//# sourceMappingURL=registry.js.map