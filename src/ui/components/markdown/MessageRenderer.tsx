/**
 * MessageRenderer - renders markdown content with memoization
 *
 * Critical perf note: no useStore hooks inside the memo component!
 * useShowAllThinking is passed as a prop from MessageList to avoid
 * re-rendering every message when the global toggle changes.
 */

import React, { useMemo, useState, useEffect, memo } from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import { parseMarkdown } from './parser.js'
import { themeManager } from '../../themes/index.js'
import { CodeHighlighter } from './CodeHighlighter.js'
import type { ParsedBlock } from './types.js'

interface MessageRendererProps {
  content: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  terminalWidth?: number
  showPrefix?: boolean
  thinking?: string
  isStreaming?: boolean
  /** Passed from parent to avoid hook call inside memo */
  showAllThinking?: boolean
}

// Custom comparator: only re-render if content/thinking actually changed
// or if streaming state toggles. Skip intermediate streaming updates for non-streaming messages.
const messageRendererComparator = (
  prev: MessageRendererProps,
  next: MessageRendererProps
): boolean => {
  if (prev.role !== next.role) return false
  if (prev.isStreaming !== next.isStreaming) return false
  if (prev.showAllThinking !== next.showAllThinking) return false
  if (prev.terminalWidth !== next.terminalWidth) return false
  if (prev.showPrefix !== next.showPrefix) return false
  // Always compare streaming content (changes fast)
  if (next.isStreaming && prev.content !== next.content) return false
  // Only compare content for non-streaming assistant messages when content changed
  if (!next.isStreaming && prev.content !== next.content) return false
  // Always compare content for user messages
  if (next.role === 'user' && prev.content !== next.content) return false
  // Compare thinking state
  if (prev.thinking !== next.thinking) return false
  return true
}

export const MessageRenderer: React.FC<MessageRendererProps> = memo(
  ({
    content,
    role,
    terminalWidth = 80,
    showPrefix = true,
    thinking,
    isStreaming,
    showAllThinking = false,
  }) => {
    // Track streaming state in ref to avoid re-renders of non-streaming messages
    // when a different message is streaming
    const theme = themeManager.getTheme()
    const roleStyle = themeManager.getRoleStyle(role)

    const [localExpanded, setLocalExpanded] = useState(!!isStreaming)

    useEffect(() => {
      if (isStreaming) {
        setLocalExpanded(true)
      } else if (thinking) {
        setLocalExpanded(false)
      }
    }, [isStreaming, thinking])

    const isThinkingExpanded = showAllThinking || localExpanded

    const blocks = useMemo(() => parseMarkdown(content), [content])

    const thinkingBlocks = useMemo(
      () => (thinking ? parseMarkdown(thinking) : []),
      [thinking],
    )

    const filteredBlocks = useMemo(() => {
      return blocks.filter((block, index) => {
        if (block.type !== 'empty') return true
        if (index > 0 && blocks[index - 1].type === 'empty') return false
        // Keep first non-empty block (don't filter first text)
        return false
      })
    }, [blocks])

    const filteredThinkingBlocks = useMemo(() => {
      return thinkingBlocks.filter((block) => block.type !== 'empty')
    }, [thinkingBlocks])

    const thinkingLineCount = useMemo(() => {
      if (!thinking) return 0
      return thinking.split('\n').filter(l => l.trim()).length
    }, [thinking])

    const thinkingPreview = useMemo(() => {
      if (!thinking) return ''
      const firstLine = thinking.split('\n').find(l => l.trim()) || ''
      const maxLen = Math.min(terminalWidth - 30, 60)
      return firstLine.length > maxLen
        ? firstLine.slice(0, maxLen) + '...'
        : firstLine
    }, [thinking, terminalWidth])

    const prefixOffset = showPrefix && roleStyle ? roleStyle.prefix.length + 1 : 0

    return (
      <Box flexDirection="column" marginBottom={1}>
        {filteredThinkingBlocks.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {isThinkingExpanded ? (
              <>
                <Box marginBottom={0}>
                  <Text color={theme.colors.text.muted} dimColor>
                    {showPrefix && roleStyle && <Text>{roleStyle.prefix} </Text>}
                    <Text italic>thinking...</Text>
                  </Text>
                </Box>
                <Box
                  flexDirection="column"
                  marginLeft={prefixOffset}
                  borderStyle="round"
                  borderColor={theme.colors.border.light}
                  paddingX={1}
                >
                  {filteredThinkingBlocks.map((block, index) => (
                    <Box key={index}>
                      <Text color={theme.colors.text.muted} dimColor italic>
                        {block.content}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </>
            ) : (
              <Box marginLeft={prefixOffset}>
                <Text color={theme.colors.text.muted} dimColor>
                  <Text>▸ </Text>
                  <Text italic>thought</Text>
                  <Text> · {thinkingLineCount} lines</Text>
                  {thinkingPreview && (
                    <Text> · {thinkingPreview}</Text>
                  )}
                </Text>
              </Box>
            )}
          </Box>
        )}

        {filteredBlocks.map((block, index) => (
          <BlockRenderer
            key={index}
            block={block}
            isFirst={index === 0 && filteredThinkingBlocks.length === 0}
            roleStyle={showPrefix ? roleStyle : undefined}
            terminalWidth={terminalWidth}
            theme={theme}
          />
        ))}

        {isStreaming && (
          <StreamingCursor prefixOffset={prefixOffset} />
        )}
      </Box>
    )
  },
  messageRendererComparator,
)

MessageRenderer.displayName = 'MessageRenderer'

// ===== Streaming Cursor Component =====

const StreamingCursor: React.FC<{ prefixOffset: number }> = React.memo(
  ({ prefixOffset }) => {
    const theme = themeManager.getTheme()
    return (
      <Box marginLeft={prefixOffset}>
        <Text color={theme.colors.primary}>▌</Text>
      </Box>
    )
  }
)

StreamingCursor.displayName = 'StreamingCursor'

// ===== 

interface BlockRendererProps {
  block: ParsedBlock
  isFirst: boolean
  roleStyle?: { color: string; prefix: string; bold?: boolean }
  terminalWidth: number
  theme: ReturnType<typeof themeManager.getTheme>
}

const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isFirst,
  roleStyle,
  terminalWidth,
  theme,
}) => {
  const prefixWidth = roleStyle?.prefix.length ?? 0
  const contentWidth = terminalWidth - prefixWidth - 2

  if (block.type === 'empty') {
    return null
  }

  return (
    <Box flexDirection="row">
      {isFirst && roleStyle && (
        <Box marginRight={1}>
          <Text color={roleStyle.color} bold={roleStyle.bold}>
            {roleStyle.prefix}
          </Text>
        </Box>
      )}
      {!isFirst && roleStyle && <Box width={prefixWidth + 1} />}

      <Box flexGrow={1} flexShrink={1}>
        {block.type === 'code' ? (
          <CodeBlock
            content={block.content}
            language={block.language}
            filePath={block.filePath}
            theme={theme}
          />
        ) : block.type === 'heading' ? (
          <Heading
            content={block.content}
            level={block.level || 1}
            theme={theme}
          />
        ) : block.type === 'list' ? (
          <ListItem
            content={block.content}
            listType={block.listType}
            marker={block.marker}
            indent={block.indent}
            theme={theme}
          />
        ) : block.type === 'hr' ? (
          <HorizontalRule width={contentWidth} theme={theme} />
        ) : block.type === 'table' && block.tableData ? (
          <TableRenderer
            headers={block.tableData.headers}
            rows={block.tableData.rows}
            alignments={block.tableData.alignments}
            theme={theme}
          />
        ) : block.type === 'blockquote' ? (
          <Blockquote content={block.content} theme={theme} />
        ) : (
          <TextBlock content={block.content} theme={theme} />
        )}
      </Box>
    </Box>
  )
}

// ===== 

interface ThemedProps {
  theme: ReturnType<typeof themeManager.getTheme>
}

const CodeBlock: React.FC<
  { content: string; language?: string; filePath?: string } & ThemedProps
> = ({ content, language, filePath }) => {
  return (
    <CodeHighlighter
      content={content}
      language={language}
      filePath={filePath}
      showLineNumbers={true}
    />
  )
}

const Heading: React.FC<{ content: string; level: number } & ThemedProps> = ({
  content,
  level,
  theme,
}) => {
  const color =
    level === 1
      ? theme.colors.primary
      : level === 2
        ? theme.colors.secondary
        : level === 3
          ? theme.colors.accent
          : theme.colors.text.primary

  const marginY = level <= 2 ? 1 : 0
  const underline = level === 1

  const hasInlineFormat = /\*\*|`|~~|\[.*\]\(/.test(content)

  return (
    <Box flexDirection="column" marginY={marginY}>
      {hasInlineFormat ? (
        <Text color={color} bold underline={underline}>
          <HeadingInlineText
            content={content}
            theme={theme}
            baseColor={color}
          />
        </Text>
      ) : (
        <Text color={color} bold underline={underline}>
          {content}
        </Text>
      )}
    </Box>
  )
}

const ListItem: React.FC<
  {
    content: string
    listType?: 'ul' | 'ol'
    marker?: string
    indent?: number
  } & ThemedProps
> = ({ content, listType, marker, indent = 0, theme }) => {
  const indentStr = '  '.repeat(Math.floor(indent / 2))
  const bulletColor =
    listType === 'ol' ? theme.colors.info : theme.colors.success

  return (
    <Box>
      <Text>
        {indentStr}
        <Text color={bulletColor}>{marker || '•'}</Text>{' '}
      </Text>
      <Text wrap="wrap">
        <InlineText content={content} theme={theme} />
      </Text>
    </Box>
  )
}

const HorizontalRule: React.FC<{ width: number } & ThemedProps> = ({
  width,
  theme,
}) => (
  <Box marginY={1}>
    <Text color={theme.colors.border.light}>
      {'─'.repeat(Math.max(width, 10))}
    </Text>
  </Box>
)

const stripMarkdownForWidth = (text: string): string => {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

const TableRenderer: React.FC<
  {
    headers: string[]
    rows: string[][]
    alignments: ('left' | 'center' | 'right')[]
  } & ThemedProps
> = ({ headers, rows, alignments, theme }) => {
  const columnWidths = headers.map((header, index) => {
    const headerWidth = stringWidth(stripMarkdownForWidth(header))
    const maxRowWidth = Math.max(
      0,
      ...rows.map((row) =>
        stringWidth(stripMarkdownForWidth(row[index] || '')),
      ),
    )
    return Math.max(headerWidth, maxRowWidth) + 2
  })

  const renderCell = (
    content: string,
    width: number,
    align: 'left' | 'center' | 'right',
  ) => {
    const actualWidth = stringWidth(stripMarkdownForWidth(content))
    const padding = Math.max(0, width - actualWidth)
    if (align === 'center') {
      const left = Math.floor(padding / 2)
      const right = padding - left
      return ' '.repeat(left) + content + ' '.repeat(right)
    }
    if (align === 'right') {
      return ' '.repeat(padding) + content
    }
    return content + ' '.repeat(padding)
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={theme.colors.border.light}>│</Text>
        {headers.map((header, index) => (
          <React.Fragment key={index}>
            <Text bold color={theme.colors.primary}>
              {renderCell(
                header,
                columnWidths[index],
                alignments[index] || 'left',
              )}
            </Text>
            <Text color={theme.colors.border.light}>│</Text>
          </React.Fragment>
        ))}
      </Box>

      <Box>
        <Text color={theme.colors.border.light}>├</Text>
        {columnWidths.map((width, index) => (
          <React.Fragment key={index}>
            <Text color={theme.colors.border.light}>{'─'.repeat(width)}</Text>
            <Text color={theme.colors.border.light}>
              {index < columnWidths.length - 1 ? '┼' : '┤'}
            </Text>
          </React.Fragment>
        ))}
      </Box>

      {rows.map((row, rowIndex) => (
        <Box key={rowIndex}>
          <Text color={theme.colors.border.light}>│</Text>
          {headers.map((_, colIndex) => {
            const cellContent = row[colIndex] || ''
            const paddedContent = renderCell(
              cellContent,
              columnWidths[colIndex],
              alignments[colIndex] || 'left',
            )
            const hasInlineFormat = /\*\*|`|~~|\[.*\]\(/.test(cellContent)
            return (
              <React.Fragment key={colIndex}>
                {hasInlineFormat ? (
                  <Text>
                    <InlineText content={paddedContent} theme={theme} />
                  </Text>
                ) : (
                  <Text>{paddedContent}</Text>
                )}
                <Text color={theme.colors.border.light}>│</Text>
              </React.Fragment>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

const Blockquote: React.FC<{ content: string } & ThemedProps> = ({
  content,
  theme,
}) => (
  <Box>
    <Text color={theme.colors.border.light}>│ </Text>
    <Text color={theme.colors.text.muted} italic wrap="wrap">
      {content}
    </Text>
  </Box>
)

const TOOLCALL_RE = /^\s{2,}(\S+)\s*(.*?)\s*(✓|✗.*)$/

const ToolCallLine: React.FC<{ content: string } & ThemedProps> = ({
  content,
  theme,
}) => {
  const m = content.match(TOOLCALL_RE)
  if (!m) return <Text dimColor>{content}</Text>

  const [, name, args, result] = m
  const isErr = result.startsWith('✗')

  return (
    <Box>
      <Text dimColor color={theme.colors.text.muted}>{'  '}</Text>
      <Text dimColor color={theme.colors.text.secondary}>{name}</Text>
      {args ? <Text dimColor color={theme.colors.text.muted}>{' '}{args}</Text> : null}
      <Text dimColor color={isErr ? theme.colors.error : theme.colors.success}>{' '}{result}</Text>
    </Box>
  )
}

const TextBlock: React.FC<{ content: string } & ThemedProps> = ({
  content,
  theme,
}) => {
  if (TOOLCALL_RE.test(content)) {
    return <ToolCallLine content={content} theme={theme} />
  }

  return (
    <Text wrap="wrap">
      <InlineText content={content} theme={theme} />
    </Text>
  )
}

const HeadingInlineText: React.FC<
  { content: string; baseColor: string } & ThemedProps
> = ({ content, theme, baseColor }) => {
  const segments = parseInline(content)

  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'bold':
            return (
              <Text key={i} bold color={theme.colors.text.primary}>
                {seg.text}
              </Text>
            )
          case 'code':
            return (
              <Text key={i} color={theme.colors.accent}>
                {seg.text}
              </Text>
            )
          case 'strikethrough':
            return (
              <Text key={i} strikethrough color={theme.colors.text.muted}>
                {seg.text}
              </Text>
            )
          case 'link':
            return (
              <Text key={i} color={theme.colors.info} underline>
                {seg.text}
              </Text>
            )
          default:
            return <Text key={i}>{seg.text}</Text>
        }
      })}
    </>
  )
}

const InlineText: React.FC<{ content: string } & ThemedProps> = ({
  content,
  theme,
}) => {
  const segments = parseInline(content)

  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'bold':
            return (
              <Text key={i} bold color={theme.colors.text.primary}>
                {seg.text}
              </Text>
            )
          case 'italic':
            return (
              <Text key={i} italic color={theme.colors.text.primary}>
                {seg.text}
              </Text>
            )
          case 'code':
            return (
              <Text key={i} color={theme.colors.accent}>
                {seg.text}
              </Text>
            )
          case 'strikethrough':
            return (
              <Text key={i} strikethrough color={theme.colors.text.muted}>
                {seg.text}
              </Text>
            )
          case 'link':
            return (
              <Text key={i} color={theme.colors.info} underline>
                {seg.text}
              </Text>
            )
          default:
            return (
              <Text key={i} color={theme.colors.text.primary}>
                {seg.text}
              </Text>
            )
        }
      })}
    </>
  )
}

function parseInline(text: string): Array<{ type: string; text: string }> {
  const segments: Array<{ type: string; text: string }> = []

  const tokenPatterns: Array<{ type: string; regex: RegExp; group: number }> = [
    { type: 'code', regex: /`([^`]+)`/g, group: 1 },
    { type: 'bold', regex: /\*\*([^*]+)\*\*/g, group: 1 },
    { type: 'strikethrough', regex: /~~([^~]+)~~/g, group: 1 },
    { type: 'italic', regex: /(?<!\*)\*([^*]+)\*(?!\*)/g, group: 1 },
    { type: 'link', regex: /\[([^\]]+)\]\([^)]+\)/g, group: 1 },
  ]

  interface Token {
    type: string
    text: string
    start: number
    end: number
  }

  const tokens: Token[] = []

  for (const { type, regex, group } of tokenPatterns) {
    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      const overlaps = tokens.some(
        (t) =>
          (start >= t.start && start < t.end) ||
          (end > t.start && end <= t.end),
      )

      if (!overlaps) {
        tokens.push({
          type,
          text: match[group],
          start,
          end,
        })
      }
    }
  }

  tokens.sort((a, b) => a.start - b.start)

  let lastEnd = 0
  for (const token of tokens) {
    if (token.start > lastEnd) {
      segments.push({ type: 'text', text: text.slice(lastEnd, token.start) })
    }
    segments.push({ type: token.type, text: token.text })
    lastEnd = token.end
  }

  if (lastEnd < text.length) {
    segments.push({ type: 'text', text: text.slice(lastEnd) })
  }

  if (segments.length === 0) {
    return [{ type: 'text', text }]
  }

  return segments
}

export default MessageRenderer
