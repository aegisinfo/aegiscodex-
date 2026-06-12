/**
 *
 *
 *
 */
/**
 *
 */
export declare function getStorageRoot(): string;
/**
 *
 * /Users/foo/project → -Users-foo-project
 */
export declare function escapeProjectPath(absPath: string): string;
/**
 *
 * @returns ~/.aegis/projects/{escaped-path}/
 */
export declare function getProjectStoragePath(projectPath: string): string;
/**
 *
 * @returns ~/.aegis/projects/{escaped-path}/{sessionId}.jsonl
 */
export declare function getSessionFilePath(projectPath: string, sessionId: string): string;
/**
 *
 * @returns ~/.aegis/projects/{escaped-path}/sessions.json
 */
export declare function getSessionIndexPath(projectPath: string): string;
/**
 *
 */
export declare function detectGitBranch(projectPath: string): string | undefined;
/**
 *
 */
export declare function detectGitRemote(projectPath: string): string | undefined;
/**
 *
 */
export declare function getLatestSessionFile(projectPath: string): Promise<string | null>;
//# sourceMappingURL=pathUtils.d.ts.map