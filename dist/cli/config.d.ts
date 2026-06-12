/**
 * CLI 配置 - yargs 选项定义
 */
/**
 * CLI 基础配置
 */
export declare const cliConfig: {
    scriptName: string;
    usage: string;
    version: string;
};
/**
 *
 *
 *
 * - Debug Options: 调试相关
 * - AI Options: 模型和 AI 相关
 * - Security Options: 权限和安全相关
 * - Session Options: 会话管理相关
 * - Output Options: 输出格式相关
 */
export declare const globalOptions: {
    debug: {
        alias: string;
        type: "boolean";
        describe: string;
        default: boolean;
        group: string;
    };
    'api-key': {
        type: "string";
        describe: string;
        group: string;
    };
    'base-url': {
        type: "string";
        describe: string;
        group: string;
    };
    model: {
        alias: string;
        type: "string";
        describe: string;
        group: string;
    };
    'max-turns': {
        type: "number";
        describe: string;
        group: string;
    };
    'permission-mode': {
        type: "string";
        choices: readonly ["default", "autoEdit", "yolo"];
        describe: string;
        group: string;
    };
    yolo: {
        type: "boolean";
        describe: string;
        default: boolean;
        group: string;
    };
    'allowed-tools': {
        type: "array";
        string: true;
        describe: string;
        group: string;
    };
    'disallowed-tools': {
        type: "array";
        string: true;
        describe: string;
        group: string;
    };
    continue: {
        alias: string;
        type: "boolean";
        describe: string;
        default: boolean;
        group: string;
    };
    resume: {
        alias: string;
        type: "string";
        describe: string;
        group: string;
    };
    print: {
        alias: string;
        type: "boolean";
        describe: string;
        default: boolean;
        group: string;
    };
    'output-format': {
        type: "string";
        choices: readonly ["text", "json"];
        describe: string;
        default: string;
        group: string;
    };
    theme: {
        alias: string;
        type: "string";
        choices: readonly ["default", "light", "dark", "ocean", "forest", "sunset"];
        describe: string;
        group: string;
    };
    plain: {
        type: "boolean";
        describe: string;
        default: boolean;
        group: string;
    };
    init: {
        type: "boolean";
        describe: string;
        default: boolean;
        group: string;
    };
};
//# sourceMappingURL=config.d.ts.map