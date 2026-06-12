/**
 *
 *
 */
/**
 *
 */
export declare enum SensitivityLevel {
    /** 低敏感：配置文件 */
    LOW = "low",
    /** 中敏感：数据库、日志 */
    MEDIUM = "medium",
    /** 高敏感：密钥、凭证 */
    HIGH = "high"
}
/**
 *
 */
export interface SensitivityResult {
    sensitive: boolean;
    level?: SensitivityLevel;
    reason?: string;
}
/**
 *
 */
export interface SensitivityResultWithPath {
    path: string;
    result: SensitivityResult;
}
/**
 *
 */
export declare class SensitiveFileDetector {
    /**
     *
     */
    private static readonly SENSITIVE_PATTERNS;
    /**
     *
     */
    private static readonly DANGEROUS_PATHS;
    /**
     *
     */
    static check(filePath: string): SensitivityResult;
    /**
     *
     */
    static isDangerousPath(filePath: string): boolean;
    /**
     *
     */
    static checkMultiple(filePaths: string[]): SensitivityResultWithPath[];
    /**
     *
     */
    static filterSensitive(filePaths: string[], minLevel?: SensitivityLevel): SensitivityResultWithPath[];
    /**
     *
     */
    static getLevelDescription(level: SensitivityLevel): string;
    /**
     *
     */
    static getLevelAction(level: SensitivityLevel): string;
}
//# sourceMappingURL=SensitiveFileDetector.d.ts.map