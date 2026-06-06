/**
 * 
 * 
 */

import type { CliArguments } from './types.js';
import { configManager } from '../config/index.js';

/**
 * 
 * 
 * 
 */
export const validatePermissions = (argv: CliArguments): void => {
  if (argv.yolo) {
    if (argv.permissionMode && argv.permissionMode !== 'yolo') {
      throw new Error(
        'Cannot use both --yolo and --permission-mode with different values'
      );
    }
    argv.permissionMode = 'yolo';
    console.error('\x1b[33m⚠ YOLO MODE — Claude will execute ALL commands without confirmation. Use with caution.\x1b[0m');
  }
  if (Array.isArray(argv.allowedTools) && Array.isArray(argv.disallowedTools)) {
    const allowedSet = new Set(argv.allowedTools);
    const intersection = argv.disallowedTools.filter(tool => allowedSet.has(tool));
    
    if (intersection.length > 0) {
      throw new Error(
        `Tools cannot be both allowed and disallowed: ${intersection.join(', ')}`
      );
    }
  }
};

/**
 * 
 * 
 * 
 */
export const loadConfiguration = async (argv: CliArguments): Promise<void> => {
  if (argv.init) {
    return;
  }

  try {
    await configManager.initialize();
    configManager.applyCliArgs({
      apiKey: argv.apiKey,
      baseURL: argv.baseUrl,
      model: argv.model,
    });

    if (argv.debug) {
      const paths = configManager.getLoadedConfigPaths();
      if (paths.length > 0) {
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize configuration');
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.error('');
    console.error('Please check:');
    console.error('  1. Config file format (~/.aegis/config.json)');
    console.error('  2. Run "aegis --init" to create default config');
    console.error('  3. Config file permissions');
    process.exit(1);
  }
  if (argv.continue && argv.resume) {
    throw new Error('Cannot use both --continue and --resume flags');
  }
};

/**
 * 
 * 
 * 
 */
export const validateOutput = (argv: CliArguments): void => {
  if (argv.outputFormat && argv.outputFormat !== 'text' && !argv.print) {
    throw new Error('--output-format can only be used with --print flag');
  }
};

/**
 * 
 * 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const middlewareChain: any[] = [
  validatePermissions,
  loadConfiguration,
  validateOutput,
];
