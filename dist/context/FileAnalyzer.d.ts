/**
 *
 *
 *
 */
import type { Message } from '../agent/types.js';
import type { FileReference, FileContent } from './types.js';
export declare class FileAnalyzer {
    /** 最多包含的文件数量 */
    private static readonly MAX_FILES;
    /** 单个文件最大行数 */
    private static readonly MAX_LINES_PER_FILE;
    /** 单个文件最大字符数 */
    private static readonly MAX_CHARS_PER_FILE;
    /**
     *
     */
    static analyzeFiles(messages: Message[]): FileReference[];
    /**
     *
     */
    private static extractFilePathsFromContent;
    /**
     *
     */
    private static extractFilePathsFromToolCall;
    /**
     *
     */
    private static updateFileReference;
    /**
     *
     */
    private static isValidFilePath;
    /**
     *
     */
    static readFilesContent(filePaths: string[]): Promise<FileContent[]>;
    /**
     *
     */
    static getFileSummary(filePath: string): Promise<string | null>;
    /**
     *
     */
    private static formatFileSize;
}
//# sourceMappingURL=FileAnalyzer.d.ts.map