/**
 *
 */
// ========== 工具类型枚
/**
 *
 *
 */
export var ToolKind;
(function (ToolKind) {
    /** 只读操作，无副作用 */
    ToolKind["ReadOnly"] = "readonly";
    /** 文件写入操作 */
    ToolKind["Write"] = "write";
    /** 命令执行，可能有副作用 */
    ToolKind["Execute"] = "execute";
})(ToolKind || (ToolKind = {}));
// ========== 工具错
/**
 *
 */
export var ToolErrorType;
(function (ToolErrorType) {
    /** 参数验证错误 */
    ToolErrorType["VALIDATION_ERROR"] = "validation_error";
    /** 执行错误 */
    ToolErrorType["EXECUTION_ERROR"] = "execution_error";
    /** 权限错误 */
    ToolErrorType["PERMISSION_ERROR"] = "permission_error";
    /** 超时错误 */
    ToolErrorType["TIMEOUT_ERROR"] = "timeout_error";
    /** 未知错误 */
    ToolErrorType["UNKNOWN_ERROR"] = "unknown_error";
})(ToolErrorType || (ToolErrorType = {}));
//# sourceMappingURL=types.js.map