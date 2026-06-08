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

// RAF polyfill — MUST run before any module that uses requestAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
  (globalThis as any).cancelAnimationFrame  = (id: number) => clearTimeout(id);
}

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env') });
import React from 'react';
import { render } from 'ink';
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

  // 2. 启动版本检查（不等待，与后续流程并行执
  versionCheckPromise = checkVersionOnStartup();

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

    // 3. 注册全局选
    .options(globalOptions)

    // 4. 注册中间
    .middleware(middlewareChain)

    // 5. 示
    .example('$0', 'Start interactive mode')
    .example('$0 "帮我分析这个项目"', 'Start with an initial message')
    .example('$0 --model gpt-4', 'Use a specific model')
    .example('$0 --debug', 'Enable debug mode')
    .example('$0 --init', 'Create default config file')

    // 6. 帮助和版
    .help()
    .alias('h', 'help')
    .alias('v', 'version')

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

        // 获取最终配
        const modelConfig = configManager.getDefaultModel()

        // 检
        if (!modelConfig.apiKey) {
          console.error('Error: API key is required')
          console.error('')
          console.error('Configuration options (in priority order):')
          console.error('')
          console.error('  1. Config file (~/.aegiscode/config.json):')
          console.error('     aegis-cli --init  # Create default config')
          console.error('')
          console.error('  2. Environment variable:')
          console.error('     export OPENAI_API_KEY=sk-...')
          console.error('')
          console.error('  3. CLI argument:')
          console.error('     aegis-cli --api-key sk-...')
          console.error('')

          // 显示已加载的配置文
          const loadedPaths = configManager.getLoadedConfigPaths()
          if (loadedPaths.length > 0) {
            console.error('Loaded config files:')
            loadedPaths.forEach((p) => console.error(`  - ${p}`))
          }

          process.exit(1)
        }

        // 获取初始消息（支持多个单
        const messageArray = argv.message as string[] | undefined
        const initialMessage =
          messageArray && messageArray.length > 0
            ? messageArray.join(' ')
            : undefined

        if (isDebugMode && initialMessage) {
          console.log('[DEBUG] Initial message:', initialMessage)
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

        // Ink rendering — with fallback for non-TTY environments
        const isTTY = process.stdin.isTTY === true && process.stdout.isTTY === true;
        if (isDebugMode) console.log('[DEBUG] TTY:', isTTY, '(stdin:', process.stdin.isTTY, 'stdout:', process.stdout.isTTY + ')');

        // Create a proper stdin for Ink (mock if needed to prevent raw mode errors)
        let renderStdin = process.stdin;
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
              apiKey={modelConfig.apiKey}
              baseURL={modelConfig.baseURL}
              model={modelConfig.model}
              initialMessage={initialMessage}
              debug={args.debug}
              permissionMode={args.permissionMode}
              versionCheckPromise={versionCheckPromise}
              resumeSessionId={resumeSessionId}
            />,
            {
              exitOnCtrlC: false,
              patchConsole: false,
              stdin: renderStdin,
              stdout: process.stdout,
            },
          );
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
