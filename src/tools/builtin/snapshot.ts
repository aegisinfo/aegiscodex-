import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const SNAPSHOTS_DIR = path.join(os.homedir(), '.aegiscode', 'snapshots');
const MAX_SNAPSHOTS = 50;

export async function createSnapshot(filePath: string): Promise<string | null> {
  try {
    await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basename = path.basename(filePath);
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${timestamp}_${basename}.bak`);
    await fs.copyFile(filePath, snapshotPath);
    await pruneSnapshots();
    return snapshotPath;
  } catch {
    return null;
  }
}

async function pruneSnapshots(): Promise<void> {
  try {
    const entries = await fs.readdir(SNAPSHOTS_DIR);
    if (entries.length <= MAX_SNAPSHOTS) return;
    const files = await Promise.all(
      entries.map(async (name) => {
        const p = path.join(SNAPSHOTS_DIR, name);
        const stat = await fs.stat(p);
        return { path: p, mtime: stat.mtime.getTime() };
      })
    );
    files.sort((a, b) => a.mtime - b.mtime);
    await Promise.all(
      files.slice(0, files.length - MAX_SNAPSHOTS).map(f => fs.unlink(f.path))
    );
  } catch {
    // ignore prune errors
  }
}
