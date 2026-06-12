/**
 * Bash 工具
 *
 *
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';
const BG_JOBS_DIR = path.join(os.homedir(), '.aegiscode', 'bg');
const execAsync = promisify(exec);
// ========== Schema 定
const BashSchema = z.object({
    command: z.string()
        .min(1, '命令不能为空')
        .describe('The shell command to execute'),
    description: z.string()
        .optional()
        .describe('A brief description of what the command does (for logging)'),
    timeout: z.number()
        .max(600000)
        .default(120000)
        .describe('Timeout in milliseconds (max 10 minutes, default 2 minutes)'),
    working_directory: z.string()
        .optional()
        .describe('The working directory to execute the command in'),
    run_in_background: z.boolean()
        .default(false)
        .describe('Whether to run the command in the background'),
});
// ========== Bash 工
export const bashTool = createTool({
    name: 'Bash',
    displayName: 'Shell Command',
    kind: ToolKind.Execute,
    schema: BashSchema,
    // Bash 不是并发安全的（可能修改共享状
    isConcurrencySafe: false,
    description: {
        short: 'Executes bash commands in a shell session',
        long: 'Executes shell commands and returns the output. Use this for system operations, git commands, package management, etc.',
        usageNotes: [
            'Avoid using for file operations - use dedicated tools (Read, Write, Edit) instead',
            'Do not use cat/head/tail to read files - use the Read tool',
            'Do not use sed/awk to edit files - use the Edit tool',
            'Use && to chain dependent commands',
            'Use run_in_background for long-running dev servers',
            'Always quote file paths that contain spaces',
        ],
        examples: [
            {
                description: 'Run npm install',
                params: {
                    command: 'npm install',
                    description: 'Install npm dependencies',
                },
            },
            {
                description: 'Check git status',
                params: {
                    command: 'git status',
                },
            },
            {
                description: 'Run a build command with timeout',
                params: {
                    command: 'npm run build',
                    timeout: 300000,
                    description: 'Build the project',
                },
            },
        ],
        important: [
            'NEVER use git commands with -i flag (interactive mode)',
            'NEVER run destructive commands like rm -rf / without explicit user request',
            'NEVER use echo or printf to communicate - output text directly instead',
            'Avoid long-running processes that block (like npm run dev) unless using run_in_background',
        ],
    },
    category: 'Shell',
    tags: ['shell', 'bash', 'command', 'execute'],
    // 提取签名内容（用于权限规
    extractSignatureContent: (params) => {
        const p = params;
        return p.command;
    },
    async execute(params, context) {
        const { command, description, timeout, working_directory, run_in_background } = params;
        // 危险命令检
        const dangerousPatterns = [
            /rm\s+-rf\s+\/(?!\w)/, // rm -rf / (但允许 rm -rf /path/to/dir)
            />\s*\/dev\/sd[a-z]/, // 写入磁盘设
            /mkfs\./, // 格式化文件系
            /dd\s+if=.*of=\/dev/, // dd 写入设
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                return {
                    success: false,
                    llmContent: `Error: Potentially dangerous command detected: ${command}`,
                    displayContent: `blocked: dangerous command`,
                    error: {
                        type: ToolErrorType.PERMISSION_ERROR,
                        message: 'Dangerous command blocked',
                    },
                };
            }
        }
        try {
            if (run_in_background) {
                const jobId = `bg-${Date.now()}`;
                const logPath = path.join(BG_JOBS_DIR, `${jobId}.log`);
                mkdirSync(BG_JOBS_DIR, { recursive: true });
                const logStream = createWriteStream(logPath, { flags: 'a' });
                logStream.write(`[${new Date().toISOString()}] $ ${command}\n\n`);
                const child = spawn(command, [], {
                    shell: '/bin/bash',
                    cwd: working_directory || context?.cwd || process.cwd(),
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                child.stdout.on('data', (chunk) => logStream.write(chunk));
                child.stderr.on('data', (chunk) => logStream.write(chunk));
                child.on('close', (code) => {
                    logStream.write(`\n[${new Date().toISOString()}] exited with code ${code}\n`);
                    logStream.end();
                });
                return {
                    success: true,
                    llmContent: `Background process started.\nJob ID: ${jobId}\nPID: ${child.pid}\nLog file: ${logPath}\n\nMonitor with: tail -f ${logPath}\nCheck output: cat ${logPath}`,
                    displayContent: `▶ bg: ${description || command.substring(0, 50)} (PID ${child.pid})`,
                    metadata: { jobId, pid: child.pid, logPath, command },
                };
            }
            // 执行命
            const options = {
                timeout,
                cwd: working_directory || context?.cwd || process.cwd(),
                maxBuffer: 10 * 1024 * 1024, // 10MB
                shell: '/bin/bash',
            };
            const { stdout, stderr } = await execAsync(command, options);
            // 组合输
            const output = [
                stdout ? stdout.trim() : '',
                stderr ? `[stderr]\n${stderr.trim()}` : '',
            ].filter(Boolean).join('\n\n');
            return {
                success: true,
                llmContent: output || '(no output)',
                displayContent: description
                    ? description
                    : command.length > 60 ? command.substring(0, 60) + '…' : command,
                metadata: {
                    command,
                    exit_code: 0,
                    working_directory: options.cwd,
                },
            };
        }
        catch (error) {
            // 处理执行错
            const execError = error;
            // 超时处
            if (execError.killed && execError.signal === 'SIGTERM') {
                return {
                    success: false,
                    llmContent: `Command timed out after ${timeout}ms: ${command}`,
                    displayContent: `error: timeout (${timeout}ms)`,
                    error: {
                        type: ToolErrorType.TIMEOUT_ERROR,
                        message: 'Command timed out',
                    },
                };
            }
            // 命令执行失
            const exitCode = typeof execError.code === 'number' ? execError.code : 1;
            const stderr = execError.stderr || execError.message || 'unknown error';
            const stdout = execError.stdout || '';
            const output = [
                stdout ? stdout.trim() : '',
                stderr ? stderr.trim() : '',
            ].filter(Boolean).join('\n\n');
            return {
                success: false,
                llmContent: `Command failed with exit code ${exitCode}:\n${output}`,
                displayContent: `error: exit ${exitCode}`,
                error: {
                    type: ToolErrorType.EXECUTION_ERROR,
                    message: stderr,
                    details: { exit_code: exitCode },
                },
                metadata: {
                    command,
                    exit_code: exitCode,
                },
            };
        }
    },
});
//# sourceMappingURL=bash.js.map