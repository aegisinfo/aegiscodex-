/**
 *
 */
// ========== 权限模
/**
 *
 */
export var PermissionMode;
(function (PermissionMode) {
    /** 默认模式：写操作需确认 */
    PermissionMode["DEFAULT"] = "default";
    /** 自动批准编辑 */
    PermissionMode["AUTO_EDIT"] = "autoEdit";
    /** 自动批准所有 */
    PermissionMode["YOLO"] = "yolo";
    /** 只读调研模式 */
    PermissionMode["PLAN"] = "plan";
})(PermissionMode || (PermissionMode = {}));
// ========== 权限检
/**
 *
 */
export var PermissionResult;
(function (PermissionResult) {
    PermissionResult["ALLOW"] = "allow";
    PermissionResult["ASK"] = "ask";
    PermissionResult["DENY"] = "deny";
})(PermissionResult || (PermissionResult = {}));
/**
 *
 */
export class ToolExecution {
    toolName;
    params;
    context;
    result;
    aborted = false;
    abortReason;
    _internal = {};
    constructor(toolName, params, context) {
        this.toolName = toolName;
        this.params = params;
        this.context = context;
    }
    /**
     *
     */
    abort(reason) {
        this.aborted = true;
        this.abortReason = reason;
    }
    /**
     *
     */
    isAborted() {
        return this.aborted;
    }
    /**
     *
     */
    getAbortReason() {
        return this.abortReason;
    }
    /**
     *
     */
    setResult(result) {
        this.result = result;
    }
    /**
     *
     */
    getResult() {
        return this.result;
    }
}
//# sourceMappingURL=types.js.map