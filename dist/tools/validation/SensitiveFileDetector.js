/**
 *
 *
 */
// ========== 敏感级
/**
 *
 */
export var SensitivityLevel;
(function (SensitivityLevel) {
    /** 低敏感：配置文件 */
    SensitivityLevel["LOW"] = "low";
    /** 中敏感：数据库、日志 */
    SensitivityLevel["MEDIUM"] = "medium";
    /** 高敏感：密钥、凭证 */
    SensitivityLevel["HIGH"] = "high";
})(SensitivityLevel || (SensitivityLevel = {}));
// ========== 检测
/**
 *
 */
export class SensitiveFileDetector {
    /**
     *
     */
    static SENSITIVE_PATTERNS = [
        // ========== 高敏
        // 环境变
        { pattern: /\.env$/, level: SensitivityLevel.HIGH, reason: '环境变量文件可能包含密钥' },
        { pattern: /\.env\.(local|development|production|test)$/, level: SensitivityLevel.HIGH, reason: '环境变量文件可能包含密钥' },
        // 凭证文
        { pattern: /credentials?\.json$/, level: SensitivityLevel.HIGH, reason: '凭证文件' },
        { pattern: /secrets?\.json$/, level: SensitivityLevel.HIGH, reason: '密钥文件' },
        { pattern: /\.credentials$/, level: SensitivityLevel.HIGH, reason: '凭证文件' },
        // 密钥文
        { pattern: /\.pem$/, level: SensitivityLevel.HIGH, reason: '私钥/证书文件' },
        { pattern: /\.key$/, level: SensitivityLevel.HIGH, reason: '密钥文件' },
        { pattern: /\.p12$/, level: SensitivityLevel.HIGH, reason: 'PKCS12 证书文件' },
        { pattern: /\.pfx$/, level: SensitivityLevel.HIGH, reason: 'PFX 证书文件' },
        // SSH 密
        { pattern: /id_rsa/, level: SensitivityLevel.HIGH, reason: 'SSH RSA 私钥' },
        { pattern: /id_ed25519/, level: SensitivityLevel.HIGH, reason: 'SSH Ed25519 私钥' },
        { pattern: /id_ecdsa/, level: SensitivityLevel.HIGH, reason: 'SSH ECDSA 私钥' },
        { pattern: /id_dsa/, level: SensitivityLevel.HIGH, reason: 'SSH DSA 私钥' },
        // AWS
        { pattern: /\.aws\/credentials$/, level: SensitivityLevel.HIGH, reason: 'AWS 凭证文件' },
        // 其
        { pattern: /\.htpasswd$/, level: SensitivityLevel.HIGH, reason: 'HTTP 密码文件' },
        { pattern: /\.netrc$/, level: SensitivityLevel.HIGH, reason: '网络凭证文件' },
        // ========== 中敏
        // 数据
        { pattern: /\.sqlite3?$/, level: SensitivityLevel.MEDIUM, reason: 'SQLite 数据库文件' },
        { pattern: /\.db$/, level: SensitivityLevel.MEDIUM, reason: '数据库文件' },
        // 日
        { pattern: /\.log$/, level: SensitivityLevel.MEDIUM, reason: '日志文件可能包含敏感信息' },
        // 历史记
        { pattern: /\.bash_history$/, level: SensitivityLevel.MEDIUM, reason: 'Bash 历史记录' },
        { pattern: /\.zsh_history$/, level: SensitivityLevel.MEDIUM, reason: 'Zsh 历史记录' },
        // 其他配
        { pattern: /\.npmrc$/, level: SensitivityLevel.MEDIUM, reason: 'npm 配置可能包含 token' },
        { pattern: /\.pypirc$/, level: SensitivityLevel.MEDIUM, reason: 'PyPI 配置可能包含 token' },
        // ========== 低敏
        // 配置文
        { pattern: /config\.json$/, level: SensitivityLevel.LOW, reason: '配置文件' },
        { pattern: /settings\.json$/, level: SensitivityLevel.LOW, reason: '设置文件' },
        { pattern: /\.gitconfig$/, level: SensitivityLevel.LOW, reason: 'Git 配置文件' },
    ];
    /**
     *
     */
    static DANGEROUS_PATHS = [
        /^\/etc\//,
        /^\/usr\//,
        /^\/System\//,
        /^\/var\//,
        /^\/root\//,
        /^C:\\Windows\\/i,
        /^C:\\Program Files/i,
    ];
    /**
     *
     */
    static check(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        for (const rule of this.SENSITIVE_PATTERNS) {
            if (rule.pattern.test(normalizedPath)) {
                return {
                    sensitive: true,
                    level: rule.level,
                    reason: rule.reason,
                };
            }
        }
        return { sensitive: false };
    }
    /**
     *
     */
    static isDangerousPath(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        return this.DANGEROUS_PATHS.some(pattern => pattern.test(normalizedPath));
    }
    /**
     *
     */
    static checkMultiple(filePaths) {
        return filePaths.map(path => ({
            path,
            result: this.check(path),
        }));
    }
    /**
     *
     */
    static filterSensitive(filePaths, minLevel = SensitivityLevel.LOW) {
        const levelOrder = {
            [SensitivityLevel.LOW]: 0,
            [SensitivityLevel.MEDIUM]: 1,
            [SensitivityLevel.HIGH]: 2,
        };
        return this.checkMultiple(filePaths).filter(item => item.result.sensitive &&
            item.result.level &&
            levelOrder[item.result.level] >= levelOrder[minLevel]);
    }
    /**
     *
     */
    static getLevelDescription(level) {
        switch (level) {
            case SensitivityLevel.LOW:
                return '低敏感';
            case SensitivityLevel.MEDIUM:
                return '中敏感';
            case SensitivityLevel.HIGH:
                return '高敏感';
        }
    }
    /**
     *
     */
    static getLevelAction(level) {
        switch (level) {
            case SensitivityLevel.LOW:
                return '正常流程处理';
            case SensitivityLevel.MEDIUM:
                return '需要用户确认';
            case SensitivityLevel.HIGH:
                return '默认拒绝访问';
        }
    }
}
//# sourceMappingURL=SensitiveFileDetector.js.map