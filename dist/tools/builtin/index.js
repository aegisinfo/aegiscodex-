/**
 *
 */
// 文件工
export { readTool } from './read.js';
export { editTool } from './edit.js';
export { writeTool } from './write.js';
// 搜索工
export { grepTool } from './grep.js';
// Shell 工
export { bashTool } from './bash.js';
// Skills 工
export { skillTool } from './skill.js';
import { readTool } from './read.js';
import { editTool } from './edit.js';
import { writeTool } from './write.js';
import { grepTool } from './grep.js';
import { bashTool } from './bash.js';
import { skillTool } from './skill.js';
/**
 *
 */
export function getBuiltinTools() {
    return [
        // 文件工
        readTool,
        editTool,
        writeTool,
        // 搜索工
        grepTool,
        // Shell 工
        bashTool,
        // Skills 工
        skillTool,
    ];
}
//# sourceMappingURL=index.js.map