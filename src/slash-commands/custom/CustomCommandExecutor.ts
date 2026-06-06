/**
 * 
 * 
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { CustomCommand, CustomCommandExecutionContext } from '../types.js';

/**
 * 
 */
export class CustomCommandExecutor {
  /**
   * 
   * 
   * 
   */
  async execute(
    command: CustomCommand,
    context: CustomCommandExecutionContext
  ): Promise<string> {
    let content = command.content;
    content = this.interpolateArgs(content, context.args);
    content = await this.executeBashEmbeds(content, context);
    content = await this.resolveFileReferences(content, context.workspaceRoot);

    return content;
  }

  /**
   * 
   * 
   * 
   */
  private interpolateArgs(content: string, args: string[]): string {
    content = content.replace(/\$ARGUMENTS/g, args.join(' '));
    for (let i = 9; i >= 1; i--) {
      content = content.split(`$${i}`).join(args[i - 1] ?? '');
    }

    return content;
  }

  /**
   * 
   * 
   * 
   */
  private async executeBashEmbeds(
    content: string,
    context: CustomCommandExecutionContext
  ): Promise<string> {
    const regex = /!`([^`]+)`/g;
    let result = content;

    for (const match of content.matchAll(regex)) {
      const command = match[1];
      
      try {
        if (context.signal?.aborted) {
          result = result.replace(match[0], '[Aborted]');
          continue;
        }

        const output = execSync(command, {
          cwd: context.workspaceRoot,
          encoding: 'utf-8',
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        }).trim();

        result = result.replace(match[0], output);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result = result.replace(match[0], `[Error: ${errorMessage}]`);
      }
    }

    return result;
  }

  /**
   * 
   * 
   * 
   */
  private async resolveFileReferences(
    content: string,
    workspaceRoot: string
  ): Promise<string> {
    const regex = /@([\w./-]+(?:\/[\w./-]+|\.[\w]+))/g;
    let result = content;

    for (const match of content.matchAll(regex)) {
      const relativePath = match[1];
      const filePath = path.resolve(workspaceRoot, relativePath);

      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const ext = path.extname(relativePath).slice(1) || 'text';
          const codeBlock = `\`\`\`${ext}\n${fileContent}\n\`\`\``;
          result = result.replace(match[0], codeBlock);
        }
      } catch {
      }
    }

    return result;
  }
}
