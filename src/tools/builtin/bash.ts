/**
 * 
 * 
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';

const execAsync = promisify(exec);

const BashSchema = z.object({
  command: z.string()
    .min(1, '')
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

export const bashTool = createTool({
  name: 'Bash',
  displayName: 'Shell Command',
  kind: ToolKind.Execute,
  schema: BashSchema,
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
  extractSignatureContent: (params: unknown) => {
    const p = params as { command: string };
    return p.command;
  },

  async execute(params, context) {
    const { command, description, timeout, working_directory, run_in_background } = params;
    const dangerousPatterns = [
      /rm\s+-rf\s+\/(?!\w)/,
      />\s*\/dev\/sd[a-z]/,
      /mkfs\./,
      /dd\s+if=.*of=\/dev/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          success: false,
          llmContent: `Error: Potentially dangerous command detected: ${command}`,
          displayContent: `❌ ，`,
          error: {
            type: ToolErrorType.PERMISSION_ERROR,
            message: 'Dangerous command blocked',
          },
        };
      }
    }

    try {
      if (run_in_background) {
        return {
          success: false,
          llmContent: 'Background execution is not yet implemented. Please run the command synchronously or use a shorter timeout.',
          displayContent: `⚠️ `,
          error: {
            type: ToolErrorType.EXECUTION_ERROR,
            message: 'Background execution not implemented',
          },
        };
      }
      const options = {
        timeout,
        cwd: working_directory || context?.cwd || process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB
        shell: '/bin/bash',
      };

      const { stdout, stderr } = await execAsync(command, options);
      const output = [
        stdout ? stdout.trim() : '',
        stderr ? `[stderr]\n${stderr.trim()}` : '',
      ].filter(Boolean).join('\n\n');

      return {
        success: true,
        llmContent: output || '(no output)',
        displayContent: description 
          ? `✅ ${description}` 
          : `✅ : ${command.length > 50 ? command.substring(0, 50) + '...' : command}`,
        metadata: {
          command,
          exit_code: 0,
          working_directory: options.cwd,
        },
      };
    } catch (error: unknown) {
      const execError = error as {
        code?: number | string;
        killed?: boolean;
        signal?: string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      if (execError.killed && execError.signal === 'SIGTERM') {
        return {
          success: false,
          llmContent: `Command timed out after ${timeout}ms: ${command}`,
          displayContent: `❌  (${timeout}ms)`,
          error: {
            type: ToolErrorType.TIMEOUT_ERROR,
            message: 'Command timed out',
          },
        };
      }
      const exitCode = typeof execError.code === 'number' ? execError.code : 1;
      const stderr = execError.stderr || execError.message || '';
      const stdout = execError.stdout || '';

      const output = [
        stdout ? stdout.trim() : '',
        stderr ? stderr.trim() : '',
      ].filter(Boolean).join('\n\n');

      return {
        success: false,
        llmContent: `Command failed with exit code ${exitCode}:\n${output}`,
        displayContent: `❌  (exit ${exitCode})`,
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
