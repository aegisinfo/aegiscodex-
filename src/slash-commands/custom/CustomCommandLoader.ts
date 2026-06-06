/**
 * 
 * 
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  CustomCommand,
  CustomCommandConfig,
  CustomCommandSource,
  CustomCommandSourceDir,
  CustomCommandDiscoveryResult,
} from '../types.js';

/**
 * 
 */
interface CommandDirectory {
  path: string;
  source: CustomCommandSource;
  sourceDir: CustomCommandSourceDir;
  priority: number;
}

/**
 * 
 */
export class CustomCommandLoader {
  /**
   * 
   */
  async discover(workspaceRoot: string): Promise<CustomCommandDiscoveryResult> {
    const commands: CustomCommand[] = [];
    const warnings: string[] = [];
    const scannedDirs: string[] = [];
    const directories: CommandDirectory[] = [
      {
        path: path.join(os.homedir(), '.aegis', 'commands'),
        source: 'user',
        sourceDir: 'aegis',
        priority: 1,
      },
      {
        path: path.join(os.homedir(), '.claude', 'commands'),
        source: 'user',
        sourceDir: 'claude',
        priority: 2,
      },
      {
        path: path.join(workspaceRoot, '.aegis', 'commands'),
        source: 'project',
        sourceDir: 'aegis',
        priority: 3,
      },
      {
        path: path.join(workspaceRoot, '.claude', 'commands'),
        source: 'project',
        sourceDir: 'claude',
        priority: 4,
      },
    ];
    for (const dir of directories) {
      if (!fs.existsSync(dir.path)) {
        continue;
      }

      scannedDirs.push(dir.path);

      try {
        const discovered = await this.scanDirectory(dir.path, dir.source, dir.sourceDir);
        commands.push(...discovered.commands);
        warnings.push(...discovered.warnings);
      } catch (error) {
        warnings.push(`Directory scan failed ${dir.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { commands, warnings, scannedDirs };
  }

  /**
   * 
   */
  private async scanDirectory(
    dirPath: string,
    source: CustomCommandSource,
    sourceDir: CustomCommandSourceDir,
    namespace?: string
  ): Promise<{ commands: CustomCommand[]; warnings: string[] }> {
    const commands: CustomCommand[] = [];
    const warnings: string[] = [];

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subNamespace = namespace ? `${namespace}/${entry.name}` : entry.name;
        const subResult = await this.scanDirectory(fullPath, source, sourceDir, subNamespace);
        commands.push(...subResult.commands);
        warnings.push(...subResult.warnings);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const command = await this.loadCommandFile(fullPath, source, sourceDir, namespace);
          if (command) {
            commands.push(command);
          }
        } catch (error) {
          warnings.push(` ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return { commands, warnings };
  }

  /**
   * 
   */
  private async loadCommandFile(
    filePath: string,
    source: CustomCommandSource,
    sourceDir: CustomCommandSourceDir,
    namespace?: string
  ): Promise<CustomCommand | null> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { config, body } = this.parseFrontmatter(content);
    const fileName = path.basename(filePath, '.md');
    const name = fileName.toLowerCase();
    if (!body.trim()) {
      return null;
    }

    return {
      name,
      namespace,
      config,
      content: body,
      path: filePath,
      source,
      sourceDir,
    };
  }

  /**
   * 
   */
  private parseFrontmatter(content: string): { config: CustomCommandConfig; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { config: {}, body: content };
    }

    const [, frontmatter, body] = match;
    const config = this.parseYamlSimple(frontmatter);

    return { config, body };
  }

  /**
   * 
   */
  private parseYamlSimple(yaml: string): CustomCommandConfig {
    const config: CustomCommandConfig = {};
    const lines = yaml.split('\n');

    let currentKey: string | null = null;
    let arrayBuffer: string[] = [];
    let inArray = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('- ')) {
        if (inArray && currentKey) {
          arrayBuffer.push(trimmed.slice(2).trim());
        }
        continue;
      }
      if (inArray && currentKey && arrayBuffer.length > 0) {
        (config as any)[this.toCamelCase(currentKey)] = arrayBuffer;
        arrayBuffer = [];
        inArray = false;
      }
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();

        currentKey = key;

        if (value === '') {
          inArray = true;
          arrayBuffer = [];
        } else {
          const camelKey = this.toCamelCase(key);
          if (value === 'true') {
            (config as any)[camelKey] = true;
          } else if (value === 'false') {
            (config as any)[camelKey] = false;
          } else {
            (config as any)[camelKey] = value;
          }
        }
      }
    }
    if (inArray && currentKey && arrayBuffer.length > 0) {
      (config as any)[this.toCamelCase(currentKey)] = arrayBuffer;
    }

    return config;
  }

  /**
   * 
   */
  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
