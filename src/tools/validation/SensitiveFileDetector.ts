/**
 * 
 * 
 */

/**
 * 
 */
export enum SensitivityLevel {
  
  LOW = 'low',
  
  MEDIUM = 'medium',
  
  HIGH = 'high',
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
interface SensitiveRule {
  pattern: RegExp;
  level: SensitivityLevel;
  reason: string;
}

/**
 * 
 */
export class SensitiveFileDetector {
  /**
   * 
   */
  private static readonly SENSITIVE_PATTERNS: SensitiveRule[] = [
    { pattern: /\.env$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /\.env\.(local|development|production|test)$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /credentials?\.json$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /secrets?\.json$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /\.credentials$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /\.pem$/, level: SensitivityLevel.HIGH, reason: '/' },
    { pattern: /\.key$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /\.p12$/, level: SensitivityLevel.HIGH, reason: 'PKCS12 ' },
    { pattern: /\.pfx$/, level: SensitivityLevel.HIGH, reason: 'PFX ' },
    { pattern: /id_rsa/, level: SensitivityLevel.HIGH, reason: 'SSH RSA ' },
    { pattern: /id_ed25519/, level: SensitivityLevel.HIGH, reason: 'SSH Ed25519 ' },
    { pattern: /id_ecdsa/, level: SensitivityLevel.HIGH, reason: 'SSH ECDSA ' },
    { pattern: /id_dsa/, level: SensitivityLevel.HIGH, reason: 'SSH DSA ' },

    // AWS
    { pattern: /\.aws\/credentials$/, level: SensitivityLevel.HIGH, reason: 'AWS ' },
    { pattern: /\.htpasswd$/, level: SensitivityLevel.HIGH, reason: 'HTTP ' },
    { pattern: /\.netrc$/, level: SensitivityLevel.HIGH, reason: '' },
    { pattern: /\.sqlite3?$/, level: SensitivityLevel.MEDIUM, reason: 'SQLite ' },
    { pattern: /\.db$/, level: SensitivityLevel.MEDIUM, reason: '' },
    { pattern: /\.log$/, level: SensitivityLevel.MEDIUM, reason: '' },
    { pattern: /\.bash_history$/, level: SensitivityLevel.MEDIUM, reason: 'Bash ' },
    { pattern: /\.zsh_history$/, level: SensitivityLevel.MEDIUM, reason: 'Zsh ' },
    { pattern: /\.npmrc$/, level: SensitivityLevel.MEDIUM, reason: 'npm  token' },
    { pattern: /\.pypirc$/, level: SensitivityLevel.MEDIUM, reason: 'PyPI  token' },
    { pattern: /config\.json$/, level: SensitivityLevel.LOW, reason: '' },
    { pattern: /settings\.json$/, level: SensitivityLevel.LOW, reason: '' },
    { pattern: /\.gitconfig$/, level: SensitivityLevel.LOW, reason: 'Git ' },
  ];

  /**
   * 
   */
  private static readonly DANGEROUS_PATHS: RegExp[] = [
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
  static check(filePath: string): SensitivityResult {
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
  static isDangerousPath(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return this.DANGEROUS_PATHS.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * 
   */
  static checkMultiple(filePaths: string[]): SensitivityResultWithPath[] {
    return filePaths.map(path => ({
      path,
      result: this.check(path),
    }));
  }

  /**
   * 
   */
  static filterSensitive(
    filePaths: string[],
    minLevel: SensitivityLevel = SensitivityLevel.LOW
  ): SensitivityResultWithPath[] {
    const levelOrder = {
      [SensitivityLevel.LOW]: 0,
      [SensitivityLevel.MEDIUM]: 1,
      [SensitivityLevel.HIGH]: 2,
    };

    return this.checkMultiple(filePaths).filter(
      item =>
        item.result.sensitive &&
        item.result.level &&
        levelOrder[item.result.level] >= levelOrder[minLevel]
    );
  }

  /**
   * 
   */
  static getLevelDescription(level: SensitivityLevel): string {
    switch (level) {
      case SensitivityLevel.LOW:
        return '';
      case SensitivityLevel.MEDIUM:
        return '';
      case SensitivityLevel.HIGH:
        return '';
    }
  }

  /**
   * 
   */
  static getLevelAction(level: SensitivityLevel): string {
    switch (level) {
      case SensitivityLevel.LOW:
        return '';
      case SensitivityLevel.MEDIUM:
        return '';
      case SensitivityLevel.HIGH:
        return '';
    }
  }
}
