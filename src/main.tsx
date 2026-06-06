/**
 *
 * 
 *
 * 
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
const _envPath = resolve(process.env.HOME || require('os').homedir(), '.aegiscode', '.env');
dotenvConfig({ path: _envPath });
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
let isDebugMode = false;
let versionCheckPromise: Promise<VersionCheckResult | null> | undefined;

/**
 * 
 *
 * 
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
  parseDebugEarly();
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
  const cli = yargs(hideBin(process.argv))
    .scriptName(cliConfig.scriptName)
    .usage(cliConfig.usage)
    .version(cliConfig.version)
    .options(globalOptions)
    .middleware(middlewareChain)
    .example('$0', 'Start interactive mode')
    .example('$0 "帮我分析这个项目"', 'Start with an initial message')
    .example('$0 --model gpt-4', 'Use a specific model')
    .example('$0 --debug', 'Enable debug mode')
    .example('$0 --init', 'Create default config file')
    .help()
    .alias('h', 'help')
    .alias('v', 'version')
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
    .strict()
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
        if (args.init) {
          const configPath = await configManager.createDefaultConfig()
          console.log(`✅ Created default config at: ${configPath}`)
          console.log('')
          console.log('Please edit the file and add your API key:')
          console.log(`  vim ${configPath}`)
          process.exit(0)
        }
        const modelConfig = configManager.getDefaultModel()
        if (!modelConfig.apiKey) {
          console.error('')
          console.error('  ⬡ Welcome to aegiscode')
          console.error('')
          console.error('  No API key found. Add at least one key to .env:')
          console.error('')
          console.error('    ANTHROPIC_API_KEY=sk-ant-...')
          console.error('    DEEPSEEK_API_KEY=sk-...')
          console.error('    GROQ_API_KEY=gsk_...')
          console.error('')
          console.error('  Get keys from your provider and add them to:')
          console.error('  ' + require('path').join(process.cwd(), '.env'))
          console.error('')
          console.error('  More info: https://aegiscloud.org/aegiscode')
          console.error('')

          process.exit(1)
        }
        const messageArray = argv.message as string[] | undefined
        const initialMessage =
          messageArray && messageArray.length > 0
            ? messageArray.join(' ')
            : undefined

        if (isDebugMode && initialMessage) {
          console.log('[DEBUG] Initial message:', initialMessage)
        }
        let resumeSessionId: string | undefined;
        
        if (args.continue) {
          const latestSession = await getLatestSessionFile(process.cwd());
          if (latestSession) {
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
        themeManager.initializeFromConfig();
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
main().catch((error) => {
  console.error('Fatal error:', error.message)
  if (isDebugMode && error.stack) {
    console.error('\nStack trace:')
    console.error(error.stack)
  }
  process.exit(1)
})
