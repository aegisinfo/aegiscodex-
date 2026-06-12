/**
 * SkillRegistry - Skills 注册中心
 *
 *
 *
 */
import type { SkillMetadata, SkillContent, SkillDiscoveryResult } from './types.js';
/**
 * Skills 注册中心（单例）
 */
export declare class SkillRegistry {
    private static instance;
    private skills;
    private initialized;
    private workspaceRoot;
    private constructor();
    /**
     *
     */
    static getInstance(): SkillRegistry;
    /**
     *
     */
    static resetInstance(): void;
    /**
     *
     *
     *
     * 1. 内置 Skills
     * 2. ~/.claude/skills
     * 3. ~/.aegis/skills
     * 4. .claude/skills
     * 5. .aegis/skills（最高优先级）
     */
    initialize(workspaceRoot?: string): Promise<SkillDiscoveryResult>;
    /**
     *
     */
    private loadBuiltinSkills;
    /**
     *
     */
    private scanDirectory;
    /**
     *
     */
    private loadMetadata;
    /**
     *
     */
    loadContent(name: string): Promise<SkillContent | null>;
    /**
     *
     */
    getAllSkills(): SkillMetadata[];
    /**
     *
     */
    getModelInvocableSkills(): SkillMetadata[];
    /**
     *
     */
    getUserInvocableSkills(): SkillMetadata[];
    /**
     *
     */
    hasSkill(name: string): boolean;
    /**
     *
     */
    getSkill(name: string): SkillMetadata | undefined;
    /**
     *
     */
    getCount(): number;
    /**
     *
     */
    refresh(): Promise<SkillDiscoveryResult>;
    /**
     *
     *
     *
     */
    generateAvailableSkillsList(): string;
    /**
     *
     */
    isInitialized(): boolean;
}
export declare function getSkillRegistry(): SkillRegistry;
//# sourceMappingURL=SkillRegistry.d.ts.map