/**
 * VersionChecker - 版本检查服务
 * 
 * 
 * - 启动时并行检查是否有新版本
 * - 缓存机制（1小时 TTL）
 * - 跳过版本功能（Skip until next version）
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// ========== 从 package.json 读取配

interface PackageJson {
  name: string;
  version: string;
  repository?: {
    type?: string;
    url?: string;
  } | string;
  homepage?: string;
}

/**
 * 
 * 
 * 
 * 
 * 
 */
function readPackageJsonSync(): PackageJson {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // 可能的 package.json 路径（基
  const possiblePaths = [
    path.resolve(__dirname, '../package.json'),     // 打包
    path.resolve(__dirname, '../../package.json'),  // 开发环
  ];

  for (const pkgPath of possiblePaths) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as PackageJson;
      // 验证是否是正确的 package（名字匹
      if (pkg.name === 'aegis') {
        return pkg;
      }
    } catch {
      // 继续尝试下一个路
    }
  }

  // 如果都失败，使用默认
  return { name: 'aegis', version: '0.1.0' };
}

const packageJson = readPackageJsonSync();

/**
 * 
 * 
 */
function getReleaseNotesUrl(): string {
  // 从 repository.url 提
  const repoUrl = typeof packageJson.repository === 'string'
    ? packageJson.repository
    : packageJson.repository?.url;
  
  if (repoUrl) {
    // 转
    const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    if (match) {
      return `https://github.com/${match[1]}/releases`;
    }
  }
  
  // 从 homepage 提
  if (packageJson.homepage) {
    const homepageMatch = packageJson.homepage.match(/github\.com\/([^/#]+\/[^/#]+)/);
    if (homepageMatch) {
      return `https://github.com/${homepageMatch[1]}/releases`;
    }
  }
  
  // 默认
  return `https://www.npmjs.com/package/${PACKAGE_NAME}`;
}

// ========== 配置常

const PACKAGE_NAME = packageJson.name;
const CURRENT_VERSION = packageJson.version;
const DEFAULT_NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const CACHE_TTL = 60 * 60 * 1000; // 1 小
const CACHE_DIR = path.join(os.homedir(), `.${PACKAGE_NAME}`);
const CACHE_FILE = path.join(CACHE_DIR, 'version-cache.json');

// ========== 读取用户 npm 配

/**
 * 
 * 
 */
async function getNpmRegistry(): Promise<string> {
  const npmrcLocations = [
    path.join(process.cwd(), '.npmrc'),           // 项目
    path.join(os.homedir(), '.npmrc'),            // 用户
  ];

  for (const npmrcPath of npmrcLocations) {
    try {
      const content = await fsPromises.readFile(npmrcPath, 'utf-8');
      // 匹
      const match = content.match(/^\s*registry\s*=\s*(.+?)\s*$/m);
      if (match && match[1]) {
        let registry = match[1].trim();
        // 移除尾部斜
        if (registry.endsWith('/')) {
          registry = registry.slice(0, -1);
        }
        return registry;
      }
    } catch {
      // 文件不存在或读取失败，继续尝试下一
    }
  }

  return DEFAULT_NPM_REGISTRY_URL;
}

// ========== 类型定

/**
 * 
 */
export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  shouldPrompt: boolean; // 是否应该显示提示（考虑 skip 设
  releaseNotesUrl: string;
  error?: string;
}

/**
 * 
 */
interface VersionCache {
  latestVersion: string;
  checkedAt: number;
  skipUntilVersion?: string; // 跳过直到此版
}

// ========== 缓存操

/**
 * 
 */
async function readCache(): Promise<VersionCache | null> {
  try {
    const content = await fsPromises.readFile(CACHE_FILE, 'utf-8');
    const cache: VersionCache = JSON.parse(content);
    return cache;
  } catch {
    return null;
  }
}

/**
 * 
 */
async function writeCache(cache: VersionCache): Promise<void> {
  try {
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
    await fsPromises.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    // 缓存写入失败不影响主流
    console.error('[VersionChecker] Failed to write cache:', error);
  }
}

/**
 * 
 */
function isCacheValid(cache: VersionCache): boolean {
  return Date.now() - cache.checkedAt < CACHE_TTL;
}

// ========== 版本比

/**
 * 
 * 
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

// ========== 核心功

/**
 * 
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超

    // 从用户配置读
    const registryUrl = await getNpmRegistry();
    
    const response = await fetch(`${registryUrl}/${PACKAGE_NAME}/latest`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { version?: string };
    return data.version || null;
  } catch {
    // 网络错误、超时等，静默失
    return null;
  }
}

/**
 * 
 * 
 * @param forceCheck - 是否强制检查（忽略缓存）
 */
export async function checkVersion(forceCheck = false): Promise<VersionCheckResult> {
  const result: VersionCheckResult = {
    currentVersion: CURRENT_VERSION,
    latestVersion: null,
    hasUpdate: false,
    shouldPrompt: false,
    releaseNotesUrl: getReleaseNotesUrl(),
  };

  try {
    // 1. 尝试读取缓
    const cache = await readCache();

    // 2. 如果缓存有效且不强制检查，使用缓
    if (cache && isCacheValid(cache) && !forceCheck) {
      result.latestVersion = cache.latestVersion;
    } else {
      // 3. 从 npm 获取最新版
      const latestVersion = await fetchLatestVersion();
      
      if (latestVersion) {
        result.latestVersion = latestVersion;
        
        // 4. 更新缓存（保
        await writeCache({
          latestVersion,
          checkedAt: Date.now(),
          skipUntilVersion: cache?.skipUntilVersion,
        });
      } else if (cache) {
        // 获取失败但有旧缓存，使用旧数
        result.latestVersion = cache.latestVersion;
      }
    }

    // 5. 判断是否有更
    if (result.latestVersion) {
      result.hasUpdate = compareVersions(result.latestVersion, CURRENT_VERSION) > 0;
    }

    // 6. 判断是否应该提示（考虑 skip 设
    if (result.hasUpdate && result.latestVersion) {
      const skipVersion = cache?.skipUntilVersion;
      if (skipVersion) {
        // 如果最新版本大于跳过版本，则应该提
        result.shouldPrompt = compareVersions(result.latestVersion, skipVersion) > 0;
      } else {
        result.shouldPrompt = true;
      }
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

/**
 * 
 * 
 * 
 */
export async function checkVersionOnStartup(): Promise<VersionCheckResult | null> {
  const result = await checkVersion();
  
  // 只有需要提示时才返回结
  if (result.shouldPrompt) {
    return result;
  }
  
  return null;
}

/**
 * 
 */
export async function setSkipUntilVersion(version: string): Promise<void> {
  const cache = await readCache();
  await writeCache({
    latestVersion: cache?.latestVersion || version,
    checkedAt: cache?.checkedAt || Date.now(),
    skipUntilVersion: version,
  });
}

/**
 * 
 */
export async function clearSkipVersion(): Promise<void> {
  const cache = await readCache();
  if (cache) {
    await writeCache({
      latestVersion: cache.latestVersion,
      checkedAt: cache.checkedAt,
      // 不设
    });
  }
}

/**
 * 
 * 
 */
export function getUpgradeCommand(): string {
  return `npm install -g ${PACKAGE_NAME}@latest --prefer-online`;
}

/**
 * 
 */
export async function performUpgrade(): Promise<{ success: boolean; message: string }> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const command = getUpgradeCommand();

    const child = spawn(command, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          message: '✅ Upgrade successful! Restarting...',
        });
      } else {
        resolve({
          success: false,
          message: `❌ Upgrade failed (exit code: ${code})`,
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        message: `❌ Upgrade failed: ${error.message}`,
      });
    });
  });
}

/**
 * 
 * 
 */
export function restartApp(): void {
  const { spawn } = require('child_process');
  
  // 启动新的 aegis 进
  // 使用 detached: true 让子进程独立运
  // 使用 stdio: 'inherit' 让新进程继承终
  const child = spawn(PACKAGE_NAME, process.argv.slice(2), {
    stdio: 'inherit',
    shell: true,
    detached: true,
  });

  // 让子进程脱离父进
  child.unref();

  // 退出当前进
  process.exit(0);
}

/**
 * 
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
