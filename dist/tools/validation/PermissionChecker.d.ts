/**
 *
 *
 */
import { type PermissionCheckResult, type PermissionConfig, type ToolInvocationDescriptor } from '../execution/types.js';
/**
 *
 */
export declare const DEFAULT_PERMISSION_CONFIG: PermissionConfig;
/**
 *
 */
export declare class PermissionChecker {
    private config;
    constructor(config?: Partial<PermissionConfig>);
    /**
     *
     */
    check(descriptor: ToolInvocationDescriptor): PermissionCheckResult;
    /**
     *
     */
    static buildSignature(descriptor: ToolInvocationDescriptor): string;
    /**
     *
     */
    private static extractDefaultSignatureContent;
    /**
     *
     */
    private matchesRule;
    /**
     *
     */
    private extractSignatureContent;
    /**
     *
     */
    private matchPattern;
    /**
     *
     */
    addRule(type: 'allow' | 'deny' | 'ask', rule: string): void;
    /**
     *
     */
    removeRule(type: 'allow' | 'deny' | 'ask', rule: string): boolean;
    /**
     *
     */
    getConfig(): PermissionConfig;
}
//# sourceMappingURL=PermissionChecker.d.ts.map