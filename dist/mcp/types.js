/**
 * MCP 协议类型定义
 * Model Context Protocol - Anthropic 推出的 AI 工具扩展协议
 */
/**
 * MCP 连接状态枚举
 */
export var McpConnectionStatus;
(function (McpConnectionStatus) {
    McpConnectionStatus["DISCONNECTED"] = "disconnected";
    McpConnectionStatus["CONNECTING"] = "connecting";
    McpConnectionStatus["CONNECTED"] = "connected";
    McpConnectionStatus["ERROR"] = "error";
})(McpConnectionStatus || (McpConnectionStatus = {}));
/**
 *
 */
export var ErrorType;
(function (ErrorType) {
    ErrorType["NETWORK_TEMPORARY"] = "network_temporary";
    ErrorType["NETWORK_PERMANENT"] = "network_permanent";
    ErrorType["CONFIG_ERROR"] = "config_error";
    ErrorType["AUTH_ERROR"] = "auth_error";
    ErrorType["PROTOCOL_ERROR"] = "protocol_error";
    ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (ErrorType = {}));
/**
 *
 */
export const DEFAULT_HEALTH_CHECK_CONFIG = {
    enabled: true,
    intervalMs: 30000, // 30 
    timeoutMs: 5000, // 5 
    maxFailures: 3, // 3 次失败后标记为不健
};
/**
 *
 */
export const DEFAULT_CONNECTION_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxReconnectAttempts: 5,
    maxReconnectDelay: 30000,
};
//# sourceMappingURL=types.js.map