/**
 * Markdown 解析器
 *
 *
 */
import type { ParsedBlock, InlineSegment } from './types.js';
/**
 *
 */
export declare function parseMarkdown(content: string): ParsedBlock[];
/**
 *
 */
export declare function parseInlineFormats(text: string): InlineSegment[];
/**
 *
 */
export declare function stripMarkdown(text: string): string;
//# sourceMappingURL=parser.d.ts.map