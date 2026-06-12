/**
 * CodeHighlighter - with line-level caching to avoid re-highlighting unchanged lines
 * Supports diff rendering when language === 'diff'
 */
import React from 'react';
interface CodeHighlighterProps {
    content: string;
    language?: string;
    filePath?: string;
    showLineNumbers?: boolean;
    terminalWidth?: number;
    startLine?: number;
}
export declare const CodeHighlighter: React.FC<CodeHighlighterProps>;
export default CodeHighlighter;
//# sourceMappingURL=CodeHighlighter.d.ts.map