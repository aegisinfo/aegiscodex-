/**
 * CodeHighlighter - with line-level caching to avoid re-highlighting unchanged lines
 */

import React, { useMemo, memo } from 'react';
import { Box, Text } from 'ink';
import { common, createLowlight } from 'lowlight';
import { themeManager } from '../../themes/index.js';
import type { SyntaxColors } from '../../themes/types.js';

const lowlight = createLowlight(common);

// Line-level cache: avoids re-highlighting the same line content
// Cache raw HAST nodes instead of React elements
const lineHighlightCache = new Map<string, any>();

function getCachedAst(
  line: string,
  language: string | undefined
): any {
  const cacheKey = `${language || 'auto'}|${line}`;
  const cached = lineHighlightCache.get(cacheKey);
  if (cached) return cached;

  const ast = doHighlightAst(line, language);
  if (lineHighlightCache.size > 2000) {
    const firstKey = lineHighlightCache.keys().next().value;
    if (firstKey) lineHighlightCache.delete(firstKey);
  }
  lineHighlightCache.set(cacheKey, ast);
  return ast;
}

function doHighlightAst(
  line: string,
  language: string | undefined
): any {
  if (!line || line.trim() === '') {
    return { type: 'root', children: [{ type: 'text', value: line || ' ' }] };
  }
  try {
    if (language && lowlight.registered(language)) {
      return lowlight.highlight(language, line);
    }
    if (/^[\s│┌┐└┘├┤┬┴┼─═║╔╗╚╝╠╣╦╩╬|+\-*=<>]+$/.test(line)) {
      return { type: 'root', children: [{ type: 'text', value: line }] };
    }
    return lowlight.highlightAuto(line);
  } catch {
    return { type: 'root', children: [{ type: 'text', value: line }] };
  }
}

interface CodeHighlighterProps {
  content: string;
  language?: string;
  filePath?: string;
  showLineNumbers?: boolean;
  terminalWidth?: number;
  startLine?: number;
}

export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
  content,
  language,
  filePath,
  showLineNumbers = true,
  terminalWidth = 80,
  startLine = 1,
}) => {
  const theme = themeManager.getTheme();
  const syntaxColors = theme.colors.syntax;

  const lines = useMemo(() => content.split('\n'), [content]);

  const totalLines = startLine + lines.length - 1;
  const lineNumberWidth = showLineNumbers ? String(totalLines).length + 1 : 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border.light}
      paddingX={1}
      marginY={1}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          {filePath ? (
            <>
              <Text color={theme.colors.info}>{filePath}</Text>
              {language && (
                <Text color={theme.colors.text.muted} dimColor> {language}</Text>
              )}
            </>
          ) : language ? (
            <Text color={theme.colors.text.muted} dimColor>{language}</Text>
          ) : null}
        </Box>
        <Box>
          <Text color={theme.colors.text.muted} dimColor>/copy</Text>
        </Box>
      </Box>

      {lines.map((line, index) => {
        const lineNumber = startLine + index;
        return (
          <Box key={index} flexDirection="row">
            {showLineNumbers && (
              <Box width={lineNumberWidth} marginRight={1}>
                <Text dimColor>
                  {String(lineNumber).padStart(lineNumberWidth - 1, ' ')}
                </Text>
              </Box>
            )}
            <Box flexShrink={1}>
              <CachedHighlightedLine line={line} language={language} syntaxColors={syntaxColors} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Memoized per-line component using content-based cache
 */
const CachedHighlightedLine: React.FC<{
  line: string;
  language?: string;
  syntaxColors: SyntaxColors;
}> = memo(({ line, language, syntaxColors }) => {
  const ast = useMemo(
    () => getCachedAst(line, language),
    [line, language]
  );
  const rendered = useMemo(
    () => renderHastNode(ast, syntaxColors),
    [ast, syntaxColors]
  );
  return <>{rendered}</>;
});
CachedHighlightedLine.displayName = 'CachedHighlightedLine';

function renderHastNode(
  node: any,
  syntaxColors: SyntaxColors,
  key?: number
): React.ReactNode {
  if (node.type === 'text') {
    return <Text key={key}>{node.value}</Text>;
  }

  if (node.type === 'root') {
    return (
      <>
        {node.children?.map((child: any, index: number) =>
          renderHastNode(child, syntaxColors, index)
        )}
      </>
    );
  }

  if (node.type === 'element') {
    const className = node.properties?.className?.[0] || '';
    const color = getColorForClass(className, syntaxColors);

    const children = node.children?.map((child: any, index: number) =>
      renderHastNode(child, syntaxColors, index)
    );

    return (
      <Text key={key} color={color}>
        {children}
      </Text>
    );
  }

  return <Text key={key}></Text>;
}

function getColorForClass(className: string, syntaxColors: SyntaxColors): string {
  if (className.includes('comment') || className.includes('prolog')) {
    return syntaxColors.comment;
  }
  if (className.includes('string') || className.includes('char') || className.includes('template-string')) {
    return syntaxColors.string;
  }
  if (className.includes('number') || className.includes('boolean') || className.includes('constant')) {
    return syntaxColors.number;
  }
  if (className.includes('keyword') || className.includes('selector') || className.includes('important')) {
    return syntaxColors.keyword;
  }
  if (className.includes('function') || className.includes('method')) {
    return syntaxColors.function;
  }
  if (className.includes('variable') || className.includes('property')) {
    return syntaxColors.variable;
  }
  if (className.includes('operator') || className.includes('punctuation')) {
    return syntaxColors.operator;
  }
  if (className.includes('type') || className.includes('class-name') || className.includes('builtin')) {
    return syntaxColors.type;
  }
  if (className.includes('tag') || className.includes('name')) {
    return syntaxColors.tag;
  }
  if (className.includes('attr')) {
    return syntaxColors.attr;
  }
  return syntaxColors.default;
}

export default CodeHighlighter;
