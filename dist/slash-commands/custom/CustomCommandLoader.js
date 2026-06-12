/**
 * CustomCommandLoader - 自定义命令加载器
 *
 *
 * - 解析 YAML Frontmatter
 * - 提取命令内容
 * - 支持多目录扫描
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
/**
 *
 */
export class CustomCommandLoader {
    /**
     *
     */
    async discover(workspaceRoot) {
        const commands = [];
        const warnings = [];
        const scannedDirs = [];
        // 定义扫描目录（按优先级排序，后面的覆盖前面
        const directories = [
            // 用户级命令（最低优先
            {
                path: path.join(os.homedir(), '.aegis', 'commands'),
                source: 'user',
                sourceDir: 'aegis',
                priority: 1,
            },
            {
                path: path.join(os.homedir(), '.claude', 'commands'),
                source: 'user',
                sourceDir: 'claude',
                priority: 2,
            },
            // 项目级命令（最高优先
            {
                path: path.join(workspaceRoot, '.aegis', 'commands'),
                source: 'project',
                sourceDir: 'aegis',
                priority: 3,
            },
            {
                path: path.join(workspaceRoot, '.claude', 'commands'),
                source: 'project',
                sourceDir: 'claude',
                priority: 4,
            },
        ];
        // 扫描每个目
        for (const dir of directories) {
            if (!fs.existsSync(dir.path)) {
                continue;
            }
            scannedDirs.push(dir.path);
            try {
                const discovered = await this.scanDirectory(dir.path, dir.source, dir.sourceDir);
                commands.push(...discovered.commands);
                warnings.push(...discovered.warnings);
            }
            catch (error) {
                warnings.push(`扫描目录失败 ${dir.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { commands, warnings, scannedDirs };
    }
    /**
     *
     */
    async scanDirectory(dirPath, source, sourceDir, namespace) {
        const commands = [];
        const warnings = [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                // 递归扫描子目录（创建命名空
                const subNamespace = namespace ? `${namespace}/${entry.name}` : entry.name;
                const subResult = await this.scanDirectory(fullPath, source, sourceDir, subNamespace);
                commands.push(...subResult.commands);
                warnings.push(...subResult.warnings);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                // 加载 Markdown 命令文
                try {
                    const command = await this.loadCommandFile(fullPath, source, sourceDir, namespace);
                    if (command) {
                        commands.push(command);
                    }
                }
                catch (error) {
                    warnings.push(`加载命令失败 ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        return { commands, warnings };
    }
    /**
     *
     */
    async loadCommandFile(filePath, source, sourceDir, namespace) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { config, body } = this.parseFrontmatter(content);
        // 从文件名提取命令
        const fileName = path.basename(filePath, '.md');
        const name = fileName.toLowerCase();
        // 跳过空内
        if (!body.trim()) {
            return null;
        }
        return {
            name,
            namespace,
            config,
            content: body,
            path: filePath,
            source,
            sourceDir,
        };
    }
    /**
     *
     */
    parseFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        if (!match) {
            return { config: {}, body: content };
        }
        const [, frontmatter, body] = match;
        const config = this.parseYamlSimple(frontmatter);
        return { config, body };
    }
    /**
     *
     */
    parseYamlSimple(yaml) {
        const config = {};
        const lines = yaml.split('\n');
        let currentKey = null;
        let arrayBuffer = [];
        let inArray = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            // 数组
            if (trimmed.startsWith('- ')) {
                if (inArray && currentKey) {
                    arrayBuffer.push(trimmed.slice(2).trim());
                }
                continue;
            }
            // 保存之前的数
            if (inArray && currentKey && arrayBuffer.length > 0) {
                config[this.toCamelCase(currentKey)] = arrayBuffer;
                arrayBuffer = [];
                inArray = false;
            }
            // 键值
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex !== -1) {
                const key = trimmed.slice(0, colonIndex).trim();
                const value = trimmed.slice(colonIndex + 1).trim();
                currentKey = key;
                if (value === '') {
                    // 可能是数组开
                    inArray = true;
                    arrayBuffer = [];
                }
                else {
                    // 普通
                    const camelKey = this.toCamelCase(key);
                    if (value === 'true') {
                        config[camelKey] = true;
                    }
                    else if (value === 'false') {
                        config[camelKey] = false;
                    }
                    else {
                        config[camelKey] = value;
                    }
                }
            }
        }
        // 处理最后的数
        if (inArray && currentKey && arrayBuffer.length > 0) {
            config[this.toCamelCase(currentKey)] = arrayBuffer;
        }
        return config;
    }
    /**
     *
     */
    toCamelCase(str) {
        return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
}
//# sourceMappingURL=CustomCommandLoader.js.map