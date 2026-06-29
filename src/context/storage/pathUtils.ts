/**
 * 
 * 
 * 
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * 
 */
export function getStorageRoot(): string {
  return path.join(os.homedir(), '.aegis');
}

/**
 * 
 * /Users/foo/project → -Users-foo-project
 */
export function escapeProjectPath(absPath: string): string {
  const normalized = path.resolve(absPath);
  // 将路径分隔符替换为 -，移除开头，移除 Windows 盘符冒号
  return normalized.replace(/[/\\]/g, '-').replace(/^-/, '').replace(/:/g, '');
}

/**
 * 
 * @returns ~/.aegis/projects/{escaped-path}/
 */
export function getProjectStoragePath(projectPath: string): string {
  const escaped = escapeProjectPath(projectPath);
  return path.join(getStorageRoot(), 'projects', escaped);
}

/**
 * 
 * @returns ~/.aegis/projects/{escaped-path}/{sessionId}.jsonl
 */
export function getSessionFilePath(projectPath: string, sessionId: string): string {
  return path.join(getProjectStoragePath(projectPath), `${sessionId}.jsonl`);
}

/**
 * 
 * @returns ~/.aegis/projects/{escaped-path}/sessions.json
 */
export function getSessionIndexPath(projectPath: string): string {
  return path.join(getProjectStoragePath(projectPath), 'sessions.json');
}

/**
 * 
 */
export function detectGitBranch(projectPath: string): string | undefined {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 
 */
export function detectGitRemote(projectPath: string): string | undefined {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return remote || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 
 */
export async function getLatestSessionFile(projectPath: string): Promise<string | null> {
  const { readdir, stat } = await import('node:fs/promises');
  const storagePath = getProjectStoragePath(projectPath);
  
  try {
    const files = await readdir(storagePath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      return null;
    }
    
    // 按修改时间排
    const fileStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(storagePath, file);
        const stats = await stat(filePath);
        return { file, mtime: stats.mtime.getTime() };
      })
    );
    
    fileStats.sort((a, b) => b.mtime - a.mtime);
    return path.join(storagePath, fileStats[0].file);
  } catch {
    return null;
  }
}
