/**
 * Hook 执行器
 *
 *
 */
import { spawn } from 'node:child_process';
/**
 * Hook 执行器
 */
export class HookExecutor {
    /**
     *
     *
     *
     * 1. 第一个 deny 需要立即中断
     * 2. updatedInput 需要累积应用
     */
    async executePreToolHooks(hooks, input, context) {
        let cumulativeInput = input.tool_input || {};
        const warnings = [];
        for (const hook of hooks) {
            const hookInput = { ...input, tool_input: cumulativeInput };
            const result = await this.executeHook(hook, hookInput, context);
            // 处理执行失
            if (!result.success) {
                if (result.blocking) {
                    return { decision: 'deny', reason: result.error };
                }
                if (result.needsConfirmation) {
                    return { decision: 'ask', reason: result.warning };
                }
                if (result.warning) {
                    warnings.push(result.warning);
                }
                continue;
            }
            // 处
            const specific = result.output?.hookSpecificOutput;
            if (specific && 'permissionDecision' in specific) {
                if (specific.permissionDecision === 'deny') {
                    return { decision: 'deny', reason: specific.permissionDecisionReason };
                }
                if (specific.permissionDecision === 'ask') {
                    return { decision: 'ask', reason: specific.permissionDecisionReason };
                }
                // 累
                if (specific.updatedInput) {
                    cumulativeInput = { ...cumulativeInput, ...specific.updatedInput };
                }
            }
        }
        return {
            decision: 'allow',
            modifiedInput: cumulativeInput,
            warning: warnings.length > 0 ? warnings.join('\n') : undefined,
        };
    }
    /**
     *
     *
     *
     */
    async executePostToolHooks(hooks, input, context) {
        const maxConcurrent = context.config.maxConcurrentHooks || 5;
        const results = await this.executeHooksConcurrently(hooks, input, context, maxConcurrent);
        // 合并结
        const additionalContexts = [];
        let modifiedOutput;
        for (const result of results) {
            // 如果有 stdout 输出，作为额外上下
            if (result.stdout && result.stdout.trim()) {
                additionalContexts.push(result.stdout.trim());
            }
            const specific = result.output?.hookSpecificOutput;
            if (specific && 'additionalContext' in specific) {
                if (specific.additionalContext) {
                    additionalContexts.push(specific.additionalContext);
                }
                if (specific.updatedOutput !== undefined) {
                    modifiedOutput = specific.updatedOutput;
                }
            }
        }
        return {
            additionalContext: additionalContexts.length > 0
                ? additionalContexts.join('\n\n')
                : undefined,
            modifiedOutput,
        };
    }
    /**
     *
     *
     *
     */
    async executePermissionHooks(hooks, input, context) {
        for (const hook of hooks) {
            const result = await this.executeHook(hook, input, context);
            if (!result.success)
                continue;
            const specific = result.output?.hookSpecificOutput;
            if (specific && 'decision' in specific) {
                if (specific.decision === 'approve' || specific.decision === 'deny') {
                    return { decision: specific.decision, reason: specific.reason };
                }
            }
        }
        return { decision: 'ask' };
    }
    /**
     *
     *
     *
     */
    async executeStopHooks(hooks, input, context) {
        for (const hook of hooks) {
            const result = await this.executeHook(hook, input, context);
            if (!result.success)
                continue;
            const specific = result.output?.hookSpecificOutput;
            if (specific && 'continue' in specific && specific.continue) {
                return { shouldContinue: true, reason: specific.reason };
            }
        }
        return { shouldContinue: false };
    }
    /**
     *
     *
     * stdout 合并注入
     */
    async executeUserPromptHooks(hooks, input, context) {
        const maxConcurrent = context.config.maxConcurrentHooks || 5;
        const results = await this.executeHooksConcurrently(hooks, input, context, maxConcurrent);
        const contexts = [];
        for (const result of results) {
            if (result.success && result.stdout && result.stdout.trim()) {
                contexts.push(result.stdout.trim());
            }
        }
        return {
            injectedContext: contexts.length > 0 ? contexts.join('\n\n') : undefined,
        };
    }
    /**
     *
     */
    async executeCompactionHooks(hooks, input, context) {
        for (const hook of hooks) {
            const result = await this.executeHook(hook, input, context);
            if (!result.success)
                continue;
            const specific = result.output?.hookSpecificOutput;
            if (specific && 'prevent' in specific && specific.prevent) {
                return { shouldPrevent: true, reason: specific.reason };
            }
        }
        return { shouldPrevent: false };
    }
    /**
     *
     */
    async executeGenericHooks(hooks, input, context) {
        const maxConcurrent = context.config.maxConcurrentHooks || 5;
        await this.executeHooksConcurrently(hooks, input, context, maxConcurrent);
    }
    /**
     *
     */
    async executeHooksConcurrently(hooks, input, context, maxConcurrent) {
        const results = [];
        // 分批执
        for (let i = 0; i < hooks.length; i += maxConcurrent) {
            const batch = hooks.slice(i, i + maxConcurrent);
            const batchResults = await Promise.all(batch.map(hook => this.executeHook(hook, input, context)));
            results.push(...batchResults);
        }
        return results;
    }
    /**
     *
     */
    async executeHook(hook, input, context) {
        if (hook.type === 'command') {
            return this.executeCommandHook(hook, input, context);
        }
        return {
            success: false,
            exitCode: 1,
            stdout: '',
            stderr: `Unknown hook type: ${hook.type}`,
            duration: 0,
            error: 'Unknown hook type',
        };
    }
    /**
     *
     */
    async executeCommandHook(hook, input, context) {
        const timeoutMs = (hook.timeout ?? context.config.defaultTimeout ?? 60) * 1000;
        const startTime = Date.now();
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            // 启动子进
            const child = spawn('sh', ['-c', hook.command], {
                cwd: context.projectDir,
                env: {
                    ...process.env,
                    // 注入环境变
                    HOOK_EVENT: input.hook_event_name,
                    SESSION_ID: input.session_id,
                    PROJECT_DIR: input.project_dir,
                },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            // 发送 JSON 输入
            child.stdin.write(JSON.stringify(input));
            child.stdin.end();
            // 收集输
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            // 超时处
            const timer = setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
            }, timeoutMs);
            // 完成处
            child.on('close', (code) => {
                clearTimeout(timer);
                const duration = Date.now() - startTime;
                if (timedOut) {
                    resolve(this.handleTimeout(context, duration));
                    return;
                }
                const exitCode = code ?? 0;
                resolve(this.parseResult(exitCode, stdout, stderr, duration, context));
            });
            child.on('error', (err) => {
                clearTimeout(timer);
                const duration = Date.now() - startTime;
                resolve({
                    success: false,
                    exitCode: 1,
                    stdout,
                    stderr: err.message,
                    duration,
                    error: err.message,
                });
            });
        });
    }
    /**
     *
     */
    handleTimeout(context, duration) {
        const behavior = context.config.timeoutBehavior || 'ignore';
        return {
            success: behavior === 'ignore',
            exitCode: 124, // HookExitCode.TIMEOUT
            stdout: '',
            stderr: 'Hook execution timed out',
            duration,
            error: 'Timeout',
            blocking: behavior === 'deny',
            needsConfirmation: behavior === 'ask',
            warning: 'Hook timed out',
        };
    }
    /**
     *
     */
    parseResult(exitCode, stdout, stderr, duration, context) {
        const result = {
            success: exitCode === 0,
            exitCode,
            stdout,
            stderr,
            duration,
        };
        // 处理退出
        if (exitCode === 2) {
            // BLOCKING_ERROR
            result.blocking = true;
            result.error = stderr || 'Blocking error';
            return result;
        }
        if (exitCode === 1) {
            // NON_BLOCKING_ERROR
            const behavior = context.config.failureBehavior || 'ignore';
            result.success = behavior === 'ignore';
            result.blocking = behavior === 'deny';
            result.needsConfirmation = behavior === 'ask';
            result.warning = stderr || 'Non-blocking error';
            return result;
        }
        // 成功 - 尝试解析 JSON 输
        if (stdout.trim()) {
            try {
                const parsed = JSON.parse(stdout.trim());
                result.output = {
                    hookSpecificOutput: parsed.hookSpecificOutput || parsed,
                    rawOutput: stdout,
                };
            }
            catch {
                // 非 JSON 输出，作为原始文
                result.output = {
                    rawOutput: stdout,
                };
            }
        }
        return result;
    }
}
//# sourceMappingURL=HookExecutor.js.map