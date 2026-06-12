/**
 * AEGIS CLI - 主入口
 *
 *
 * 1. 早期解析 --debug 参数（确保日志可用）
 * 2. 启动版本检查（不等待，与后续流程并行）
 * 3. 创建 yargs CLI 实例
 * 4. 注册全局选项和命令
 * 5. 执行中间件链（validatePermissions → loadConfiguration → validateOutput）
 * 6. 执行默认命令 → 启动 React UI（传递 versionCheckPromise）
 *
 *
 * 1. 默认配置
 * 2. 用户配置 (~/.aegiscode/config.json)
 * 3. 项目配置 (./.aegiscode/config.json)
 * 4. 环境变量 (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL)
 * 5. CLI 参数 (--api-key, --base-url, --model)
 */
export {};
//# sourceMappingURL=main.d.ts.map