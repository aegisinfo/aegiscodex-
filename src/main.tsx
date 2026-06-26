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

// RAF polyfill — MUST run before any module that uses requestAnimationFrame.
// Pass Date.now() as the timestamp so RAF callbacks that throttle by timestamp
// (e.g. MessageList's RAF_INTERVAL_MS check) work correctly. Without this,
// `now` is undefined and `undefined - ref < 30` is always false, causing the
// streaming render loop to fire at the raw setTimeout rate (~16ms) instead of 30ms.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16);
  (globalThis as any).cancelAnimationFrame  = (id: number) => clearTimeout(id);
}

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { homedir } from 'os';
// --print's whole point is clean, pipeable stdout (text or JSON) — the
// dotenvx promo banner would otherwise land on stdout ahead of the result.
const isPrintMode = process.argv.includes('--print') || process.argv.includes('-p');
// SetupWizard saves keys to ~/.aegiscode/.env (the only place a globally-installed
// `aegis` binary can reliably find them — process.cwd() is wherever the user happens
// to invoke it from). Load that first, then ./.env so a project-local file can override it.
dotenvConfig({ path: resolve(homedir(), '.aegiscode', '.env'), quiet: isPrintMode });
dotenvConfig({ path: resolve(process.cwd(), '.env'), quiet: isPrintMode, override: true });
import React from 'react';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { App } from './ui/App.js';
import { configManager } from './config/index.js';
import { cliConfig, globalOptions, middlewareChain } from './cli/index.js';
import { checkVersionOnStartup } from './services/index.js';
import { runCouncil } from './slash-commands/council.js';
import { getLatestSessionFile } from './context/index.js';
import { themeManager } from './ui/themes/index.js';
import { setGlobalDebug } from './utils/debug.js';
import type { CliArguments } from './cli/types.js';
import type { VersionCheckResult } from './services/VersionChecker.js';
import * as path from 'node:path';

// Rendering debugger (auto-starts with --debug-rendering flag)
const ENABLE_RENDER_DEBUG = process.argv.includes('--debug-rendering');

// ========== 全局状
let isDebugMode = false;
let versionCheckPromise: Promise<VersionCheckResult | null> | undefined;

/**
 * 
 *
 * 
 * - Logger 在各模块中被创建
 * - 如果等 yargs 解析完再设置 debug，部分初始化日志会丢失
 * - 早期解析确保所有日志都能正确输出
 */
function parseDebugEarly(): void {
  const rawArgs = hideBin(process.argv)
  const debugIndex = rawArgs.indexOf('--debug')
  const shortDebugIndex = rawArgs.indexOf('-d')

  if (debugIndex !== -1 || shortDebugIndex !== -1) {
    isDebugMode = true
    setGlobalDebug(true)  // 设置全局 debug 状态，供其他模块使
    console.log('[DEBUG] Debug mode enabled via early parsing')
  }
}

/**
 * 
 */
async function main(): Promise<void> {
  // 1. 早期解
  parseDebugEarly();

  // One-shot memory introspection flags for external callers (e.g. aegiscode-gui's
  // Electron main process) — single source of truth instead of duplicating the
  // SQLite schema/read logic in another codebase. MUST run before anything below
  // imports SharedMemory (its singleton constructor fires init() — TTL eviction +
  // cloud sync — synchronously on first import) or makes network calls (version
  // check, token verification) that a fast read-only call has no business paying for.
  const earlyArgs = process.argv.slice(2);
  // One-shot account re-verification for external callers (aegiscode-gui) — same
  // single-source-of-truth reasoning as the memory flags below.
  if (earlyArgs[0] === '--verify-account-json') {
    const { verifyAccount } = await import('./auth/login.js');
    console.log(JSON.stringify(await verifyAccount()));
    process.exit(0);
  }

  if (earlyArgs[0] === '--memory-stats-json' || earlyArgs[0] === '--memory-search-json' || earlyArgs[0] === '--memory-clear-json' || earlyArgs[0] === '--memory-upload-json' || earlyArgs[0] === '--memory-download-json') {
    process.env.AEGIS_MEMORY_READONLY = '1';
    const { sharedMemory } = await import('./memory/SharedMemory.js');
    await sharedMemory.whenReady();

    if (earlyArgs[0] === '--memory-stats-json') {
      console.log(JSON.stringify(sharedMemory.getStats()));
    } else if (earlyArgs[0] === '--memory-search-json') {
      const query = earlyArgs[1] || '';
      const limit = parseInt(earlyArgs[2] || '50', 10);
      const results = query ? await sharedMemory.search(query, limit) : sharedMemory.recent(limit);
      console.log(JSON.stringify(results));
    } else if (earlyArgs[0] === '--memory-upload-json') {
      console.log(JSON.stringify(await sharedMemory.pushAll()));
    } else if (earlyArgs[0] === '--memory-download-json') {
      console.log(JSON.stringify(await sharedMemory.pullAll()));
    } else {
      sharedMemory.clear();
      console.log(JSON.stringify({ ok: true }));
    }
    process.exit(0);
  }

  // 2. 启动版本检查（不等待，与后续流程并行执
  versionCheckPromise = checkVersionOnStartup();

  // Verify memory token against server (cached 24 h — runs in parallel with startup)
  const { sharedMemory } = await import('./memory/SharedMemory.js');
  sharedMemory.initVerification().catch(() => {});

  // Handle --model flag: aegis --model deepseek "question"
  // or aegis --model council "question" for council vote
  const modelArg = process.argv.find(a => a.startsWith('--model='))?.split('=')[1]
    || (() => { const i = process.argv.indexOf('--model'); return i > -1 ? process.argv[i+1] : null; })();

  if (modelArg) {
    const { readFileSync } = await import('fs');
    const { homedir } = await import('os');
    try {
      const cfg = JSON.parse(readFileSync(`${homedir()}/.aegiscode/config.json`, 'utf8'));
      const found = (cfg.models || []).find((m: any) => m.id === modelArg);
      if (found) {
        process.env.OPENAI_API_KEY = found.apiKey;
        process.env.OPENAI_BASE_URL = found.baseUrl || found.baseURL;
        // Sätt currentModelId så getDefaultModel() väljer rätt
        cfg.currentModelId = found.id;
        const { writeFileSync } = await import('fs');
        writeFileSync(`${homedir()}/.aegiscode/config.json`, JSON.stringify(cfg, null, 2));
        console.log(`\x1b[38;2;0;229;192m[AEGIS] Model: ${found.name || found.id}\x1b[0m`);
      }
    } catch {}
  }

  // Handle /council command
  const args = process.argv.slice(2);

  if (args[0] === '/council' || args[0] === 'council') {
    const question = args.slice(1).join(' ');
    if (!question) {
      console.error('Usage: aegis /council <question>');
      process.exit(1);
    }
    runCouncil(question).then(() => process.exit(0));
    return;
  }
  if (isDebugMode) {
    console.log('[DEBUG] Version check started (running in parallel)');
  }

  // 3. 创建 yargs CLI 实
  const cli = yargs(hideBin(process.argv))
    .scriptName(cliConfig.scriptName)
    .usage(cliConfig.usage)
    .version(cliConfig.version)
    // 注册全局选
    .options(globalOptions)

    // 注册中间
    .middleware(middlewareChain)

    // ── auth commands ──────────────────────────────────────────────────────
    .command(
      'login',
      'Log in to aegiscloud (Google or username/password), or Claude Code Pro/Max',
      (y) => y
        .option('password', {
          alias: 'p',
          type: 'boolean',
          describe: 'Log in with username and password instead of browser',
          default: false,
        })
        .option('claude-pro', {
          type: 'boolean',
          describe: 'Authenticate with a Claude Code Pro/Max subscription token instead of an API key',
          default: false,
        }),
      async (argv) => {
        const { runLogin, runLoginPassword, runLoginClaudePro } = await import('./auth/login.js');
        try {
          if ((argv as any).claudePro) {
            await runLoginClaudePro();
            process.exit(0);
          } else if ((argv as any).password) {
            await runLoginPassword();
          } else {
            await runLogin();
          }
          console.log('\n\x1b[32m✓ Logged in successfully.\x1b[0m');
          console.log('\nRun \x1b[1maegis\x1b[0m to start coding.\n');
        } catch (err) {
          console.error('\n\x1b[31m✗ Login failed:\x1b[0m', (err as Error).message);
          process.exit(1);
        }
        process.exit(0);
      },
    )

    .command(
      'logout',
      'Log out and remove stored aegiscloud credentials',
      () => {},
      async () => {
        const { runLogout } = await import('./auth/login.js');
        runLogout();
        process.exit(0);
      },
    )

    // 示
    .example('$0', 'Start interactive mode')
    .example('$0 login', 'Log in via browser')
    .example('$0 continue', 'Continue the most recent conversation')
    .example('$0 resume <session-id>', 'Resume a specific conversation by ID')
    .example('$0 "帮我分析这个项目"', 'Start with an initial message')
    .example('$0 --model gpt-4', 'Use a specific model')
    .example('$0 --router', 'Start with the auto-router on')
    .example('$0 --debug', 'Enable debug mode')
    .example('$0 --init', 'Create default config file')

    // 帮助
    .help()
    .alias('h', 'help')

    // 7. 错误处
    .fail((msg, err, yargsInstance) => {
      if (err) {
        console.error('💥 An error occurred:')
        console.error(err.message)
        if (isDebugMode && err.stack) {
          console.error('\nStack trace:')
          console.error(err.stack)
        }
        process.exit(1)
      }

      if (msg) {
        console.error('❌ Invalid arguments:')
        console.error(msg)
        console.error('')
        yargsInstance.showHelp()
        process.exit(1)
      }
    })

    // 8. 严格模式（禁止未知选
    .strict()

    // 9. 默认命
    .command(
      '$0 [message..]',
      'Start interactive mode',
      (yargs) => {
        return yargs.positional('message', {
          type: 'string',
          describe: 'Initial message to send (can be multiple words)',
          array: true,
        })
      },
      async (argv) => {
        const args = argv as CliArguments

        // 处理 --init 命
        if (args.init) {
          const configPath = await configManager.createDefaultConfig()
          console.log(`✅ Created default config at: ${configPath}`)
          console.log('')
          console.log('Please edit the file and add your API key:')
          console.log(`  vim ${configPath}`)
          process.exit(0)
        }

        // ── Mandatory login check ─────────────────────────────────────────
        // If no aegiscloud credentials exist at all, force login before proceeding —
        // unless the user already has a working BYOK LLM key configured (env var,
        // ~/.aegiscode/.env, or config.json). AEGIS CLI is BYOK (see billing.ts):
        // aegiscloud login is only required for cloud memory sync, not for running
        // the agent against your own API key. Forcing it on every standalone install
        // blocked exactly that use case.
        const hasOwnApiKey = !!configManager.getDefaultModel().apiKey;
        if (!hasOwnApiKey) {
          const { readFileSync } = await import('node:fs');
          const { homedir } = await import('node:os');
          let hasCredentials = false;
          try {
            const cfg = JSON.parse(readFileSync(`${homedir()}/.aegiscode/config.json`, 'utf8'));
            hasCredentials = !!(cfg?.aegiscloud?.api_key || cfg?.memory?.token);
          } catch {}

          // Re-verify a stored key against the server periodically (cached 24h)
          // so a revoked/deleted account doesn't stay "logged in" forever.
          const needsLogin = hasCredentials
            ? !(await (await import('./auth/login.js')).ensureAccountValid())
            : true;

          if (needsLogin) {
            const { runLogin } = await import('./auth/login.js');
            try {
              await runLogin();
              console.log('\n\x1b[32m✓ Logged in.\x1b[0m Starting ÆGIS...\n');
              // Re-initialize config with the newly saved credentials
              await configManager.initialize(process.cwd());
            } catch (err) {
              console.error('\n\x1b[31m✗ Login failed:\x1b[0m', (err as Error).message);
              console.error('Run \x1b[1maegis login\x1b[0m to try again.');
              process.exit(1);
            }
          }
        }

        const modelConfig = configManager.getDefaultModel()

        // No API key yet — don't exit here. App.tsx already detects this on mount
        // (initializeStoreState) and renders the interactive SetupWizard, which
        // creates ~/.aegiscode/.env for the user. Exiting here with print-only
        // instructions skipped that wizard entirely and left fresh installs
        // stuck telling users to hand-create a hidden folder themselves.
        // --print mode has no UI to fall back on, so it still needs to fail fast.
        if (!modelConfig.apiKey && isPrintMode) {
          process.stderr.write(
            'No API key configured. Run `aegis` once (without --print) to set one up, ' +
            'or set an environment variable: export OPENAI_API_KEY=sk-...\n',
          );
          process.exit(1);
        }

        // 获取初始消息（支持多个单
        const messageArray = argv.message as string[] | undefined
        let initialMessage =
          messageArray && messageArray.length > 0
            ? messageArray.join(' ')
            : undefined

        if (isDebugMode && initialMessage) {
          console.log('[DEBUG] Initial message:', initialMessage)
        }

        // Handle `aegis continue` and `aegis resume <id>` without `--` prefix
        // so they behave like `aegis --continue` and `aegis --resume <id>`.
        if (!args.continue && !args.resume && initialMessage && !initialMessage.startsWith('/')) {
          const trimmed = initialMessage.trim();
          if (trimmed === 'continue') {
            args.continue = true;
            initialMessage = undefined;
          } else if (trimmed.startsWith('resume ') || trimmed.startsWith('resume\t')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
              args.resume = parts[1];
              initialMessage = undefined;
            }
          }
        }

        // 处理 --continue 和 --resume 参
        let resumeSessionId: string | undefined;
        
        if (args.continue) {
          // 获取最近的会话文
          const latestSession = await getLatestSessionFile(process.cwd());
          if (latestSession) {
            // 从文件路径提取 sessionId（去掉 .jsonl 扩展
            resumeSessionId = path.basename(latestSession, '.jsonl');
            if (isDebugMode) {
              console.log('[DEBUG] Continuing session:', resumeSessionId);
            }
          } else {
            console.log('No previous session found. Starting a new conversation.');
          }
        } else if (args.resume && typeof args.resume === 'string') {
          resumeSessionId = args.resume;
          if (isDebugMode) {
            console.log('[DEBUG] Resuming session:', resumeSessionId);
          }
        }

        // --print: headless mode, no Ink. Runs one turn, writes the result to
        // stdout (text or JSON per --output-format), and exits — no TUI chrome,
        // no spinners, no escape codes, so the output is safe to pipe/script.
        if (args.print) {
          if (!initialMessage) {
            process.stderr.write('Error: --print requires a message, e.g. aegis --print "your question"\n');
            process.exit(1);
          }

          const { ContextManager } = await import('./context/index.js');
          const { Agent } = await import('./agent/Agent.js');

          const ctxManager = new ContextManager({ compressionThreshold: 100000 });
          let sessionId: string;
          let priorMessages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[] = [];

          if (resumeSessionId) {
            const loaded = await ctxManager.loadSession(resumeSessionId);
            sessionId = loaded ? resumeSessionId : await ctxManager.createSession();
            if (loaded) {
              priorMessages = ctxManager.getMessages()
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            }
          } else {
            sessionId = await ctxManager.createSession();
          }

          try {
            const agent = await Agent.create({
              apiKey: modelConfig.apiKey ?? '',
              baseURL: modelConfig.baseURL,
              model: modelConfig.model,
              requireConfirmation: false,
            });

            const result = await agent.chatWithMetadata(initialMessage, {
              sessionId,
              messages: priorMessages,
            });

            if (!result.success) {
              throw new Error(result.error?.message || 'Agent execution failed');
            }
            const finalMessage = result.finalMessage || '';

            await ctxManager.addMessage('user', initialMessage);
            await ctxManager.addMessage('assistant', finalMessage);
            await ctxManager.flush();

            if (args.outputFormat === 'json') {
              process.stdout.write(JSON.stringify({
                result: finalMessage,
                session_id: sessionId,
                num_turns: result.metadata?.turnsCount,
                num_tool_calls: result.metadata?.toolCallsCount,
                total_tokens: result.metadata?.totalTokens,
              }) + '\n');
            } else {
              process.stdout.write(finalMessage + '\n');
            }
            process.exit(0);
          } catch (error) {
            process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
          }
        }

        // 初始化主题（从用户配置加载，或自动检测终端颜色模
        themeManager.initializeFromConfig();
        
        // CLI 参数覆盖（如果指定
        if (args.theme && themeManager.hasTheme(args.theme)) {
          themeManager.setTheme(args.theme);
          if (isDebugMode) {
            console.log('[DEBUG] Theme overridden by CLI to:', args.theme);
          }
        } else if (isDebugMode) {
          console.log('[DEBUG] Theme:', themeManager.getCurrentThemeName());
        }

        // Check for --plain flag (plain text mode, no Ink)
        const isPlain = args.plain === true;
        if (isDebugMode) console.log('[DEBUG] Plain mode:', isPlain);

        if (isPlain) {
          // Plain text mode — just relay input/output
          if (initialMessage) {
            console.log(initialMessage);
          }
          const { createInterface } = await import('node:readline');
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          rl.on('line', (line) => {
            if (line.trim()) console.log(line);
          });
          rl.on('close', () => process.exit(0));
          return;
        }

        // Ink rendering — with fallback for non-TTY environments
        const isTTY = process.stdin.isTTY === true && process.stdout.isTTY === true;
        if (isDebugMode) console.log('[DEBUG] TTY:', isTTY, '(stdin:', process.stdin.isTTY, 'stdout:', process.stdout.isTTY + ')');

        // Auto-start rendering debugger if --debug-rendering is set
        if (ENABLE_RENDER_DEBUG) {
          const { startRenderDebugger } = await import('./ui/render-debugger.js');
          startRenderDebugger({ reportInterval: 5000, verbose: false });
        }

        // Create proper stdin/stdout for Ink (mock if needed to prevent raw mode errors)
        let renderStdin = process.stdin;
        let renderStdout = process.stdout;

        // Force isTTY on stdout so Ink renders properly in all terminal environments
        if (!process.stdout.isTTY) {
          (process.stdout as any).isTTY = true;
          if (isDebugMode) console.log('[DEBUG] Forcing isTTY=true on stdout');
        }

        if (!isTTY) {
          const { PassThrough } = await import('node:stream');
          const mockStdin = new PassThrough();
          (mockStdin as any).isTTY = true;
          (mockStdin as any).setRawMode = () => {};
          (mockStdin as any).ref = () => {};
          (mockStdin as any).unref = () => {};
          (mockStdin as any).setEncoding = () => {};
          renderStdin = mockStdin as unknown as typeof process.stdin;
          if (isDebugMode) console.log('[DEBUG] Using mock stdin for Ink render');
        }

        try {
          const { render } = await import('ink');
          render(
            <App
              apiKey={modelConfig.apiKey ?? ''}
              baseURL={modelConfig.baseURL}
              model={modelConfig.model}
              initialMessage={initialMessage}
              debug={args.debug}
              permissionMode={args.permissionMode}
              versionCheckPromise={versionCheckPromise}
              resumeSessionId={resumeSessionId}
              routerEnabled={args.router}
            />,
            {
              exitOnCtrlC: false,
              patchConsole: true,
              stdin: renderStdin,
              stdout: process.stdout,
              // Disabled: the alt screen buffer blocks normal mouse text selection/copy
              // in most terminal emulators. Real Claude Code renders inline instead.
              alternateScreen: false,
              maxFps: 30,
              // Without this, Ink's default log-update mode erases and rewrites the
              // ENTIRE terminal output on every re-render, even when only a single
              // line changed (e.g. the input cursor blink, every ~530ms, forever).
              // That full erase+rewrite invalidates any in-progress mouse text
              // selection in terminals like Kitty — selecting a message becomes
              // impossible because the screen keeps getting wiped out from under it.
              // incrementalRendering does real line-level diffing and only rewrites
              // lines that actually changed, leaving untouched lines (and any
              // selection on them) alone.
              incrementalRendering: true,
            },
          );

          // Handle EOF (Ctrl+D) on real stdin to allow normal terminal closing
          if (isTTY && process.stdin.isTTY) {
            process.stdin.on('end', () => {
              if (isDebugMode) console.log('[DEBUG] EOF received on stdin');
              process.exit(0);
            });
          }
        } catch (renderError) {
          // Ink rendering failed, fall back to simple text mode
          if (isDebugMode) console.log('[DEBUG] Ink rendering failed:', (renderError as Error).message, '- falling back to text mode');
          if (initialMessage) {
            console.log(initialMessage);
          }
          const { createInterface } = await import('node:readline');
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          rl.on('line', (line) => {
            if (line.trim()) console.log(line);
          });
          rl.on('close', () => process.exit(0));
        }
    })
  await cli.parse()
}

// 运行主函
main().catch((error) => {
  console.error('Fatal error:', error.message)
  if (isDebugMode && error.stack) {
    console.error('\nStack trace:')
    console.error(error.stack)
  }
  process.exit(1)
})
