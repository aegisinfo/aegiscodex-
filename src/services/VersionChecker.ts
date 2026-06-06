/**
 * 
 * 
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

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
  const possiblePaths = [
    path.resolve(__dirname, '../package.json'),
    path.resolve(__dirname, '../../package.json'),
  ];

  for (const pkgPath of possiblePaths) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as PackageJson;
      if (pkg.name === 'aegis') {
        return pkg;
      }
    } catch {
    }
  }
  return { name: 'aegis', version: '0.1.0' };
}

const packageJson = readPackageJsonSync();

/**
 * 
 * 
 */
function getReleaseNotesUrl(): string {
  const repoUrl = typeof packageJson.repository === 'string'
    ? packageJson.repository
    : packageJson.repository?.url;
  
  if (repoUrl) {
    const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    if (match) {
      return `https://github.com/${match[1]}/releases`;
    }
  }
  if (packageJson.homepage) {
    const homepageMatch = packageJson.homepage.match(/github\.com\/([^/#]+\/[^/#]+)/);
    if (homepageMatch) {
      return `https://github.com/${homepageMatch[1]}/releases`;
    }
  }
  return `https://www.npmjs.com/package/${PACKAGE_NAME}`;
}

const PACKAGE_NAME = packageJson.name;
const CURRENT_VERSION = packageJson.version;
const DEFAULT_NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_DIR = path.join(os.homedir(), `.${PACKAGE_NAME}`);
const CACHE_FILE = path.join(CACHE_DIR, 'version-cache.json');

/**
 * 
 * 
 */
async function getNpmRegistry(): Promise<string> {
  const npmrcLocations = [
    path.join(process.cwd(), '.npmrc'),
    path.join(os.homedir(), '.npmrc'),
  ];

  for (const npmrcPath of npmrcLocations) {
    try {
      const content = await fsPromises.readFile(npmrcPath, 'utf-8');
      const match = content.match(/^\s*registry\s*=\s*(.+?)\s*$/m);
      if (match && match[1]) {
        let registry = match[1].trim();
        if (registry.endsWith('/')) {
          registry = registry.slice(0, -1);
        }
        return registry;
      }
    } catch {
    }
  }

  return DEFAULT_NPM_REGISTRY_URL;
}

/**
 * 
 */
export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  shouldPrompt: boolean;
  releaseNotesUrl: string;
  error?: string;
}

/**
 * 
 */
interface VersionCache {
  latestVersion: string;
  checkedAt: number;
  skipUntilVersion?: string;
}

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
    console.error('[VersionChecker] Failed to write cache:', error);
  }
}

/**
 * 
 */
function isCacheValid(cache: VersionCache): boolean {
  return Date.now() - cache.checkedAt < CACHE_TTL;
}

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

/**
 * 
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
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
    return null;
  }
}

/**
 * 
 * 
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
    const cache = await readCache();
    if (cache && isCacheValid(cache) && !forceCheck) {
      result.latestVersion = cache.latestVersion;
    } else {
      const latestVersion = await fetchLatestVersion();
      
      if (latestVersion) {
        result.latestVersion = latestVersion;
        await writeCache({
          latestVersion,
          checkedAt: Date.now(),
          skipUntilVersion: cache?.skipUntilVersion,
        });
      } else if (cache) {
        result.latestVersion = cache.latestVersion;
      }
    }
    if (result.latestVersion) {
      result.hasUpdate = compareVersions(result.latestVersion, CURRENT_VERSION) > 0;
    }
    if (result.hasUpdate && result.latestVersion) {
      const skipVersion = cache?.skipUntilVersion;
      if (skipVersion) {
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
  const child = spawn(PACKAGE_NAME, process.argv.slice(2), {
    stdio: 'inherit',
    shell: true,
    detached: true,
  });
  child.unref();
  process.exit(0);
}

/**
 * 
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
