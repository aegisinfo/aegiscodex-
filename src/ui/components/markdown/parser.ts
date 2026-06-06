/**
 * 
 * 
 */

import type { ParsedBlock, TableData, InlineSegment } from './types.js';

const KNOWN_LANGUAGES = new Set([
  'javascript', 'js', 'typescript', 'ts', 'tsx', 'jsx',
  'python', 'py', 'ruby', 'rb', 'go', 'rust', 'rs',
  'java', 'kotlin', 'kt', 'scala', 'swift', 'c', 'cpp', 'h',
  'csharp', 'cs', 'php', 'lua', 'perl', 'r', 'sql',
  'html', 'css', 'scss', 'sass', 'less',
  'json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'env',
  'bash', 'sh', 'zsh', 'fish', 'powershell', 'ps1',
  'markdown', 'md', 'text', 'txt', 'plain',
  'diff', 'patch', 'dockerfile', 'makefile', 'cmake',
  'graphql', 'gql', 'proto', 'protobuf',
  'vim', 'elixir', 'ex', 'erlang', 'haskell', 'hs',
  'ocaml', 'ml', 'fsharp', 'clojure', 'lisp', 'scheme',
  'dart', 'zig', 'nim', 'v', 'wasm', 'solidity', 'sol',
]);

/**
 * 
 * 
 * 
 *   ```typescript                → { language: 'typescript' }
 *   ```typescript:src/main.tsx   → { language: 'typescript', filePath: 'src/main.tsx' }
 *   ```src/main.tsx              → { language: 'typescript', filePath: 'src/main.tsx' }
 *   ```12:30:src/main.tsx        → { language: undefined, filePath: 'src/main.tsx', startLine: 12 }
 */
function parseCodeBlockSpec(spec: string | null): { language?: string; filePath?: string; startLine?: number } {
  if (!spec) return {};

  // Format: startLine:endLine:filepath (e.g., 12:30:src/main.tsx)
  const lineRefMatch = spec.match(/^(\d+):(\d+):(.+)$/);
  if (lineRefMatch) {
    const filePath = lineRefMatch[3];
    const ext = filePath.split('.').pop()?.toLowerCase();
    return {
      language: ext && KNOWN_LANGUAGES.has(ext) ? ext : undefined,
      filePath,
      startLine: parseInt(lineRefMatch[1], 10),
    };
  }

  // Format: language:filepath (e.g., typescript:src/main.tsx)
  const colonIdx = spec.indexOf(':');
  if (colonIdx > 0) {
    const before = spec.slice(0, colonIdx).toLowerCase();
    const after = spec.slice(colonIdx + 1);
    if (KNOWN_LANGUAGES.has(before) && after.length > 0) {
      return { language: before, filePath: after };
    }
  }

  // Plain language (e.g., typescript)
  if (KNOWN_LANGUAGES.has(spec.toLowerCase())) {
    return { language: spec.toLowerCase() };
  }

  // Might be a file path (contains / or .)
  if (spec.includes('/') || spec.includes('.')) {
    const ext = spec.split('.').pop()?.toLowerCase();
    return {
      language: ext && KNOWN_LANGUAGES.has(ext) ? ext : undefined,
      filePath: spec,
    };
  }

  // Fallback: treat as language
  return { language: spec };
}

/**
 */
const MARKDOWN_PATTERNS = {
  codeBlock: /^(\s*)```([^\s]*?)?\s*$/,
  heading: /^(#{1,6})\s+(.+)/,
  ulItem: /^(\s*)([-*+])\s+(.+)/,
  olItem: /^(\s*)(\d+)\.\s+(.+)/,
  hr: /^[-*_]{3,}\s*$/,
  table: /^\|(.+)\|$/,
  tableSeparator: /^\|[\s]*:?-+:?[\s]*(\|[\s]*:?-+:?[\s]*)+\|?$/,
  blockquote: /^>\s*(.*)$/,
  empty: /^\s*$/,
} as const;

/**
 * 
 */
const INLINE_PATTERNS = {
  bold: /\*\*(.+?)\*\*/g,
  italic: /\*(.+?)\*/g,
  code: /`([^`]+)`/g,
  strikethrough: /~~(.+?)~~/g,
  link: /\[([^\]]+)\]\(([^)]+)\)/g,
} as const;

/**
 * 
 */
export function parseMarkdown(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split(/\r?\n/);

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockSpec: ReturnType<typeof parseCodeBlockSpec> = {};
  let codeBlockIndent = 0;

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableAlignments: ('left' | 'center' | 'right')[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inCodeBlock) {
      const match = line.match(MARKDOWN_PATTERNS.codeBlock);
      if (match && match[2] === undefined) {
        blocks.push({
          type: 'code',
          content: codeBlockContent.join('\n'),
          language: codeBlockSpec.language,
          filePath: codeBlockSpec.filePath,
        });
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockSpec = {};
        codeBlockIndent = 0;
      } else {
        const stripped = codeBlockIndent > 0 && line.startsWith(' '.repeat(codeBlockIndent))
          ? line.slice(codeBlockIndent)
          : line;
        codeBlockContent.push(stripped);
      }
      continue;
    }
    const codeMatch = line.match(MARKDOWN_PATTERNS.codeBlock);
    if (codeMatch) {
      if (inTable) {
        blocks.push(createTableBlock(tableHeaders, tableRows, tableAlignments));
        inTable = false;
        tableHeaders = [];
        tableRows = [];
        tableAlignments = [];
      }
      
      inCodeBlock = true;
      codeBlockIndent = codeMatch[1]?.length || 0;
      codeBlockSpec = parseCodeBlockSpec(codeMatch[2] || null);
      continue;
    }
    if (MARKDOWN_PATTERNS.table.test(line)) {
      const cells = parseTableRow(line);
      
      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
        continue;
      }
      if (MARKDOWN_PATTERNS.tableSeparator.test(line)) {
        tableAlignments = parseTableAlignments(line);
        continue;
      }
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      blocks.push(createTableBlock(tableHeaders, tableRows, tableAlignments));
      inTable = false;
      tableHeaders = [];
      tableRows = [];
      tableAlignments = [];
    }
    if (MARKDOWN_PATTERNS.empty.test(line)) {
      blocks.push({ type: 'empty', content: '' });
      continue;
    }
    if (MARKDOWN_PATTERNS.hr.test(line)) {
      blocks.push({ type: 'hr', content: '' });
      continue;
    }
    const headingMatch = line.match(MARKDOWN_PATTERNS.heading);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        content: headingMatch[2],
        level: headingMatch[1].length,
      });
      continue;
    }
    const ulMatch = line.match(MARKDOWN_PATTERNS.ulItem);
    if (ulMatch) {
      blocks.push({
        type: 'list',
        content: ulMatch[3],
        listType: 'ul',
        marker: ulMatch[2],
        indent: ulMatch[1].length,
      });
      continue;
    }
    const olMatch = line.match(MARKDOWN_PATTERNS.olItem);
    if (olMatch) {
      blocks.push({
        type: 'list',
        content: olMatch[3],
        listType: 'ol',
        marker: olMatch[2] + '.',
        indent: olMatch[1].length,
      });
      continue;
    }
    const blockquoteMatch = line.match(MARKDOWN_PATTERNS.blockquote);
    if (blockquoteMatch) {
      blocks.push({
        type: 'blockquote',
        content: blockquoteMatch[1],
      });
      continue;
    }
    blocks.push({ type: 'text', content: line });
  }
  if (inCodeBlock && codeBlockContent.length > 0) {
    blocks.push({
      type: 'code',
      content: codeBlockContent.join('\n'),
      language: codeBlockSpec.language,
      filePath: codeBlockSpec.filePath,
    });
  }
  if (inTable && tableHeaders.length > 0) {
    blocks.push(createTableBlock(tableHeaders, tableRows, tableAlignments));
  }

  return blocks;
}

/**
 * 
 */
function parseTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
}

/**
 * 
 */
function parseTableAlignments(line: string): ('left' | 'center' | 'right')[] {
  return line
    .slice(1, -1)
    .split('|')
    .map(cell => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
        return 'center';
      }
      if (trimmed.endsWith(':')) {
        return 'right';
      }
      return 'left';
    });
}

/**
 * 
 */
function createTableBlock(
  headers: string[],
  rows: string[][],
  alignments: ('left' | 'center' | 'right')[]
): ParsedBlock {
  return {
    type: 'table',
    content: '',
    tableData: {
      headers,
      rows,
      alignments: alignments.length > 0 ? alignments : headers.map(() => 'left'),
    },
  };
}

/**
 * 
 */
export function parseInlineFormats(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let remaining = text;
  let lastIndex = 0;
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: remaining.slice(lastIndex, match.index),
      });
    }
    
    segments.push({
      type: 'link',
      content: match[1],
      url: match[2],
    });
    
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    segments.push({
      type: 'text',
      content: remaining.slice(lastIndex),
    });
  }
  if (segments.length === 0) {
    return [{ type: 'text', content: text }];
  }

  return segments;
}

/**
 * 
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
