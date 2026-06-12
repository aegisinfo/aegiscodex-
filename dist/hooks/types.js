/**
 * Hooks 系统类型定义
 *
 * Hooks 允许用户在特定事件点注入自定义 Shell 命令，
 *
 */
// ========== Hook 事件类
/**
 * Hook 事件枚举
 *
 * 11 种事件类型，覆盖 Agent 生命周期的各个关键节点
 */
export var HookEvent;
(function (HookEvent) {
    // ========== 工具执行
    /** 工具执行前 (可阻止或修改输入) */
    HookEvent["PreToolUse"] = "PreToolUse";
    /** 工具执行后 (可添加上下文或修改输出) */
    HookEvent["PostToolUse"] = "PostToolUse";
    /** 工具执行失败后 */
    HookEvent["PostToolUseFailure"] = "PostToolUseFailure";
    /** 权限请求时 (可自动批准/拒绝) */
    HookEvent["PermissionRequest"] = "PermissionRequest";
    // ========== 会话生命周期
    /** 用户提交提示词时 (可注入上下文) */
    HookEvent["UserPromptSubmit"] = "UserPromptSubmit";
    /** 会话启动时 */
    HookEvent["SessionStart"] = "SessionStart";
    /** 会话结束时 */
    HookEvent["SessionEnd"] = "SessionEnd";
    // ========== 控制流
    /** Agent 停止响应时 (可阻止停止) */
    HookEvent["Stop"] = "Stop";
    /** 子 Agent (Task) 停止响应时 */
    HookEvent["SubagentStop"] = "SubagentStop";
    // ========== 其
    /** 通知事件 */
    HookEvent["Notification"] = "Notification";
    /** 上下文压缩时 */
    HookEvent["Compaction"] = "Compaction";
})(HookEvent || (HookEvent = {}));
// ========== 退出码语
export var HookExitCode;
(function (HookExitCode) {
    /** 成功，继续执行 */
    HookExitCode[HookExitCode["SUCCESS"] = 0] = "SUCCESS";
    /** 非阻塞错误，记录但继续 */
    HookExitCode[HookExitCode["NON_BLOCKING_ERROR"] = 1] = "NON_BLOCKING_ERROR";
    /** 阻塞错误，停止执行 */
    HookExitCode[HookExitCode["BLOCKING_ERROR"] = 2] = "BLOCKING_ERROR";
    /** 超时 */
    HookExitCode[HookExitCode["TIMEOUT"] = 124] = "TIMEOUT";
})(HookExitCode || (HookExitCode = {}));
// ========== 默认配
export const DEFAULT_HOOK_CONFIG = {
    enabled: true,
    defaultTimeout: 60,
    timeoutBehavior: 'ignore',
    failureBehavior: 'ignore',
    maxConcurrentHooks: 5,
};
//# sourceMappingURL=types.js.map