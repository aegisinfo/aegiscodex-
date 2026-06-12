/**
 * CustomCommandLoader - 自定义命令加载器
 *
 *
 * - 解析 YAML Frontmatter
 * - 提取命令内容
 * - 支持多目录扫描
 */
import type { CustomCommandDiscoveryResult } from '../types.js';
/**
 *
 */
export declare class CustomCommandLoader {
    /**
     *
     */
    discover(workspaceRoot: string): Promise<CustomCommandDiscoveryResult>;
    /**
     *
     */
    private scanDirectory;
    /**
     *
     */
    private loadCommandFile;
    /**
     *
     */
    private parseFrontmatter;
    /**
     *
     */
    private parseYamlSimple;
    /**
     *
     */
    private toCamelCase;
}
//# sourceMappingURL=CustomCommandLoader.d.ts.map