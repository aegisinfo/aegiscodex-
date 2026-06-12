/**
 * VersionChecker - 版本检查服务
 *
 *
 * - 启动时并行检查是否有新版本
 * - 缓存机制（1小时 TTL）
 * - 跳过版本功能（Skip until next version）
 */
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
 *
 * @param forceCheck - 是否强制检查（忽略缓存）
 */
export declare function checkVersion(forceCheck?: boolean): Promise<VersionCheckResult>;
/**
 *
 *
 *
 */
export declare function checkVersionOnStartup(): Promise<VersionCheckResult | null>;
/**
 *
 */
export declare function setSkipUntilVersion(version: string): Promise<void>;
/**
 *
 */
export declare function clearSkipVersion(): Promise<void>;
/**
 *
 *
 */
export declare function getUpgradeCommand(): string;
/**
 *
 */
export declare function performUpgrade(): Promise<{
    success: boolean;
    message: string;
}>;
/**
 *
 *
 */
export declare function restartApp(): void;
/**
 *
 */
export declare function getCurrentVersion(): string;
//# sourceMappingURL=VersionChecker.d.ts.map