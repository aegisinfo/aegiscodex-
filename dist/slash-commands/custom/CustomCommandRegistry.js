/**
 * CustomCommandRegistry - 自定义命令注册中心
 *
 *
 */
import { CustomCommandLoader } from './CustomCommandLoader.js';
import { CustomCommandExecutor } from './CustomCommandExecutor.js';
/**
 *
 */
export class CustomCommandRegistry {
    static instance;
    commands = new Map();
    loader = new CustomCommandLoader();
    executor = new CustomCommandExecutor();
    initialized = false;
    constructor() { }
    /**
     *
     */
    static getInstance() {
        if (!CustomCommandRegistry.instance) {
            CustomCommandRegistry.instance = new CustomCommandRegistry();
        }
        return CustomCommandRegistry.instance;
    }
    /**
     *
     */
    async initialize(workspaceRoot) {
        const result = await this.loader.discover(workspaceRoot);
        // 清空现有命
        this.commands.clear();
        // 按顺序注册（后面的覆盖前面的同名命
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
    isInitialized() {
        return this.initialized;
    }
    /**
     *
     */
    getCommand(name, namespace) {
        // 先尝试带命名空
        if (namespace) {
            const key = this.getCommandKey(name, namespace);
            const cmd = this.commands.get(key);
            if (cmd)
                return cmd;
        }
        // 再尝试不带命名空
        return this.commands.get(name);
    }
    /**
     *
     */
    getAllCommands() {
        return Array.from(this.commands.values());
    }
    /**
     *
     *
     *
     * - 有 description
     * - 没有设置 disableModelInvocation: true
     */
    getModelInvocableCommands() {
        return this.getAllCommands().filter((cmd) => cmd.config.description && !cmd.config.disableModelInvocation);
    }
    /**
     *
     */
    async executeCommand(name, context, namespace) {
        const cmd = this.getCommand(name, namespace);
        if (!cmd)
            return null;
        return this.executor.execute(cmd, context);
    }
    /**
     *
     *
     *
     *
     */
    getCommandLabel(cmd) {
        const base = cmd.source === 'project' ? 'project' : 'user';
        return cmd.namespace ? `(${base}:${cmd.namespace})` : `(${base})`;
    }
    /**
     *
     */
    getCommandKey(name, namespace) {
        return namespace ? `${namespace}/${name}` : name;
    }
    /**
     *
     */
    async reload(workspaceRoot) {
        return this.initialize(workspaceRoot);
    }
    /**
     *
     */
    get size() {
        return this.commands.size;
    }
}
//# sourceMappingURL=CustomCommandRegistry.js.map