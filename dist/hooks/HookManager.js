/**
 * Hook 管理器
 *
 *
 * - 加载和管理 Hook 配置
 * - 协调 Hook 的匹配和执行
 * - 防止重复执行
 */
import { nanoid } from 'nanoid';
import { Matcher, extractFilePath, extractCommand } from './Matcher.js';
import { HookExecutor } from './HookExecutor.js';
import { HookEvent, DEFAULT_HOOK_CONFIG, } from './types.js';
/**
 *
 */
class HookExecutionGuard {
    executed = new Map();
    canExecute(toolUseId, event) {
        const events = this.executed.get(toolUseId);
        if (!events)
            return true;
        return !events.has(event);
    }
    markExecuted(toolUseId, event) {
        let events = this.executed.get(toolUseId);
        if (!events) {
            events = new Set();
            this.executed.set(toolUseId, events);
        }
        events.add(event);
    }
    clear() {
        this.executed.clear();
    }
}
/**
 * Hook 管理器
 */
export class HookManager {
    static instance = null;
    config = DEFAULT_HOOK_CONFIG;
    executor = new HookExecutor();
    matcher = new Matcher();
    guard = new HookExecutionGuard();
    sessionDisabled = false;
    initialized = false;
    constructor() { }
    /**
     *
     */
    static getInstance() {
        if (!HookManager.instance) {
            HookManager.instance = new HookManager();
        }
        return HookManager.instance;
    }
    /**
     *
     */
    static resetInstance() {
        HookManager.instance = null;
    }
    /**
     *
     */
    loadConfig(config) {
        this.config = this.mergeConfig(DEFAULT_HOOK_CONFIG, config);
        this.initialized = true;
    }
    /**
     *
     */
    mergeConfig(base, override) {
        return {
            ...base,
            ...override,
            // 合并各事件类型的 Hook 列
            PreToolUse: override.PreToolUse ?? base.PreToolUse,
            PostToolUse: override.PostToolUse ?? base.PostToolUse,
            PostToolUseFailure: override.PostToolUseFailure ?? base.PostToolUseFailure,
            PermissionRequest: override.PermissionRequest ?? base.PermissionRequest,
            UserPromptSubmit: override.UserPromptSubmit ?? base.UserPromptSubmit,
            SessionStart: override.SessionStart ?? base.SessionStart,
            SessionEnd: override.SessionEnd ?? base.SessionEnd,
            Stop: override.Stop ?? base.Stop,
            SubagentStop: override.SubagentStop ?? base.SubagentStop,
            Notification: override.Notification ?? base.Notification,
            Compaction: override.Compaction ?? base.Compaction,
        };
    }
    /**
     *
     */
    isEnabled() {
        return (this.config.enabled ?? true) && !this.sessionDisabled;
    }
    /**
     *
     */
    disableForSession() {
        this.sessionDisabled = true;
    }
    /**
     *
     */
    enableForSession() {
        this.sessionDisabled = false;
    }
    /**
     *
     */
    getConfig() {
        return this.config;
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
    getMatchingHooks(event, context) {
        const matchers = this.config[event];
        return this.matcher.getMatchingHooks(matchers, context);
    }
    /**
     *
     */
    createExecutionContext(context) {
        return {
            ...context,
            config: this.config,
        };
    }
    // ==================== PreToolUse ====================
    /**
     *
     */
    async executePreToolHooks(toolName, toolUseId, toolInput, context) {
        if (!this.isEnabled()) {
            return { decision: 'allow' };
        }
        // Plan 模式跳
        if (context.permissionMode === 'plan') {
            return { decision: 'allow' };
        }
        // 检查是否已执
        if (!this.guard.canExecute(toolUseId, HookEvent.PreToolUse)) {
            return { decision: 'allow' };
        }
        // 获取匹配
        const hooks = this.getMatchingHooks(HookEvent.PreToolUse, {
            toolName,
            filePath: extractFilePath(toolInput),
            command: extractCommand(toolName, toolInput),
        });
        if (hooks.length === 0) {
            return { decision: 'allow' };
        }
        // 构建输
        const hookInput = {
            hook_event_name: HookEvent.PreToolUse,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            tool_name: toolName,
            tool_use_id: toolUseId,
            tool_input: toolInput,
            project_dir: context.projectDir,
            session_id: context.sessionId,
            permission_mode: context.permissionMode,
        };
        // 执
        const result = await this.executor.executePreToolHooks(hooks, hookInput, this.createExecutionContext(context));
        // 标记已执
        this.guard.markExecuted(toolUseId, HookEvent.PreToolUse);
        // YOLO 模式：将 ask 转为 allow，但保
        if (context.permissionMode === 'yolo' && result.decision === 'ask') {
            return { ...result, decision: 'allow' };
        }
        return result;
    }
    // ==================== PostToolUse ====================
    /**
     *
     */
    async executePostToolHooks(toolName, toolUseId, toolInput, toolOutput, context) {
        if (!this.isEnabled()) {
            return {};
        }
        // 检查是否已执
        if (!this.guard.canExecute(toolUseId, HookEvent.PostToolUse)) {
            return {};
        }
        // 获取匹配
        const hooks = this.getMatchingHooks(HookEvent.PostToolUse, {
            toolName,
            filePath: extractFilePath(toolInput),
            command: extractCommand(toolName, toolInput),
        });
        if (hooks.length === 0) {
            return {};
        }
        // 构建输
        const hookInput = {
            hook_event_name: HookEvent.PostToolUse,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            tool_name: toolName,
            tool_use_id: toolUseId,
            tool_input: toolInput,
            tool_output: toolOutput,
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        // 执
        const result = await this.executor.executePostToolHooks(hooks, hookInput, this.createExecutionContext(context));
        // 标记已执
        this.guard.markExecuted(toolUseId, HookEvent.PostToolUse);
        return result;
    }
    // ==================== PostToolUseFailure ====================
    /**
     *
     */
    async executePostToolFailureHooks(toolName, toolUseId, toolInput, error, context) {
        if (!this.isEnabled())
            return;
        const hooks = this.getMatchingHooks(HookEvent.PostToolUseFailure, {
            toolName,
            filePath: extractFilePath(toolInput),
            command: extractCommand(toolName, toolInput),
        });
        if (hooks.length === 0)
            return;
        const hookInput = {
            hook_event_name: HookEvent.PostToolUseFailure,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            tool_name: toolName,
            tool_use_id: toolUseId,
            tool_input: toolInput,
            error,
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        await this.executor.executeGenericHooks(hooks, hookInput, this.createExecutionContext(context));
    }
    // ==================== PermissionRequest ====================
    /**
     *
     */
    async executePermissionHooks(toolName, toolInput, context) {
        if (!this.isEnabled()) {
            return { decision: 'ask' };
        }
        const hooks = this.getMatchingHooks(HookEvent.PermissionRequest, {
            toolName,
            filePath: extractFilePath(toolInput),
            command: extractCommand(toolName, toolInput),
        });
        if (hooks.length === 0) {
            return { decision: 'ask' };
        }
        const hookInput = {
            hook_event_name: HookEvent.PermissionRequest,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            tool_name: toolName,
            tool_input: toolInput,
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        return this.executor.executePermissionHooks(hooks, hookInput, this.createExecutionContext(context));
    }
    // ==================== UserPromptSubmit ====================
    /**
     *
     */
    async executeUserPromptHooks(promptContent, context) {
        if (!this.isEnabled()) {
            return {};
        }
        const hooks = this.getMatchingHooks(HookEvent.UserPromptSubmit, {});
        if (hooks.length === 0) {
            return {};
        }
        const hookInput = {
            hook_event_name: HookEvent.UserPromptSubmit,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            prompt_content: promptContent,
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        return this.executor.executeUserPromptHooks(hooks, hookInput, this.createExecutionContext(context));
    }
    // ==================== SessionStart ====================
    /**
     *
     */
    async executeSessionStartHooks(context) {
        if (!this.isEnabled())
            return;
        const hooks = this.getMatchingHooks(HookEvent.SessionStart, {});
        if (hooks.length === 0)
            return;
        const hookInput = {
            hook_event_name: HookEvent.SessionStart,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        await this.executor.executeGenericHooks(hooks, hookInput, this.createExecutionContext(context));
        // 清理执行防
        this.guard.clear();
    }
    // ==================== SessionEnd ====================
    /**
     *
     */
    async executeSessionEndHooks(context) {
        if (!this.isEnabled())
            return;
        const hooks = this.getMatchingHooks(HookEvent.SessionEnd, {});
        if (hooks.length === 0)
            return;
        const hookInput = {
            hook_event_name: HookEvent.SessionEnd,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        await this.executor.executeGenericHooks(hooks, hookInput, this.createExecutionContext(context));
    }
    // ==================== Stop ====================
    /**
     *
     */
    async executeStopHooks(stopReason, context) {
        if (!this.isEnabled()) {
            return { shouldContinue: false };
        }
        const hooks = this.getMatchingHooks(HookEvent.Stop, {});
        if (hooks.length === 0) {
            return { shouldContinue: false };
        }
        const hookInput = {
            hook_event_name: HookEvent.Stop,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            stop_reason: stopReason,
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        return this.executor.executeStopHooks(hooks, hookInput, this.createExecutionContext(context));
    }
    // ==================== Compaction ====================
    /**
     *
     */
    async executeCompactionHooks(preTokens, messageCount, context) {
        if (!this.isEnabled()) {
            return { shouldPrevent: false };
        }
        const hooks = this.getMatchingHooks(HookEvent.Compaction, {});
        if (hooks.length === 0) {
            return { shouldPrevent: false };
        }
        const hookInput = {
            hook_event_name: HookEvent.Compaction,
            hook_execution_id: nanoid(),
            timestamp: new Date().toISOString(),
            pre_tokens: preTokens,
            message_count: messageCount,
            project_dir: context.projectDir,
            session_id: context.sessionId,
        };
        return this.executor.executeCompactionHooks(hooks, hookInput, this.createExecutionContext(context));
    }
    // ==================== 统计信
    /**
     *
     */
    getHookCounts() {
        const counts = {};
        for (const event of Object.values(HookEvent)) {
            const matchers = this.config[event];
            if (matchers && Array.isArray(matchers)) {
                let count = 0;
                for (const matcher of matchers) {
                    count += matcher.hooks?.length || 0;
                }
                if (count > 0) {
                    counts[event] = count;
                }
            }
        }
        return counts;
    }
    /**
     *
     */
    getConfiguredEvents() {
        const events = [];
        for (const event of Object.values(HookEvent)) {
            const matchers = this.config[event];
            if (matchers && Array.isArray(matchers) && matchers.length > 0) {
                events.push(event);
            }
        }
        return events;
    }
}
/**
 *
 */
export function getHookManager() {
    return HookManager.getInstance();
}
//# sourceMappingURL=HookManager.js.map