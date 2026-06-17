/**
 * MessageRenderer - renders markdown content with memoization
 *
 * Critical perf note: no useStore hooks inside the memo component!
 * useShowAllThinking is passed as a prop from MessageList to avoid
 * re-rendering every message when the global toggle changes.
 *
 * Supports Content Block model (Claude-style):
 * - text blocks → rendered as markdown
 * - thinking blocks → collapsible with preview
 * - tool_use blocks → formatted tool calls with status
 * - tool_result blocks → tool output
 */

import React, { useMemo, useState, useEffect, useRef, memo } from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import { parseMarkdown } from './parser.js'
import { themeManager } from '../../themes/index.js'
import { CodeHighlighter } from './CodeHighlighter.js'
import type { ParsedBlock } from './types.js'
import type { ContentBlock, ToolCallStatus } from '../../../store/types.js'

interface MessageRendererProps {
  content: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  terminalWidth?: number
  showPrefix?: boolean
  thinking?: string
  isStreaming?: boolean
  /** Passed from parent to avoid hook call inside memo */
  showAllThinking?: boolean
  /** Content blocks for Claude-style structured rendering */
  contentBlocks?: ContentBlock[]
}

/**
 * Custom comparator: prevent re-renders only when nothing has changed.
 * During streaming, content changes every delta — we MUST re-render to show them.
 * The old code had `!next.isStreaming` which blocked ALL streaming content updates.
 */
const messageRendererComparator = (
  prev: MessageRendererProps,
  next: MessageRendererProps
): boolean => {
  if (prev.role !== next.role) return false
  if (prev.isStreaming !== next.isStreaming) return false
  
  if (prev.terminalWidth !== next.terminalWidth) return false
  if (prev.showPrefix !== next.showPrefix) return false
  // Always compare content — even during streaming, we need to show deltas
  if (prev.content !== next.content) return false
  // Compare thinking state
  if (prev.thinking !== next.thinking) return false
  // Compare content blocks
  if (prev.contentBlocks !== next.contentBlocks) return false
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
    contentBlocks,
  }) => {
    const theme = themeManager.getTheme()
    const roleStyle = themeManager.getRoleStyle(role)

    const isThinkingExpanded = true

    // Incremental markdown parse cache — avoids re-parsing stable content
    // during streaming by detecting append-only growth and reusing blocks.
    const parseCacheRef = useRef<{ content: string; blocks: ParsedBlock[] }>({ content: '', blocks: [] });

    const blocks = useMemo(() => {
      const cache = parseCacheRef.current;
      if (content === cache.content) return cache.blocks;

      // Incremental: content only grew (append-only streaming delta)
      if (content.startsWith(cache.content) && cache.content.length > 0) {
        const delta = content.slice(cache.content.length);
        const deltaFirstLine = delta.split('\n')[0];
        // Fast path: delta is pure text (no block-starting patterns like ```, #, -, >, |)
        if (!/^```|^#{1,6}\s|^[-*+]\s|^\d+\.\s|^>\s|^\s*$|^\|/.test(deltaFirstLine)) {
          const newBlocks = cache.blocks.slice();
          const lastBlock = newBlocks[newBlocks.length - 1];
          if (lastBlock && lastBlock.type === 'text') {
            newBlocks[newBlocks.length - 1] = { ...lastBlock, content: lastBlock.content + delta };
            parseCacheRef.current = { content, blocks: newBlocks };
            return newBlocks;
          }
        }
      }

      // Full re-parse for structural changes or first render
      const parsed = parseMarkdown(content);
      parseCacheRef.current = { content, blocks: parsed };
      return parsed;
    }, [content])

    const thinkingBlocks = useMemo(
      () => (thinking ? parseMarkdown(thinking) : []),
      [thinking],
    )

    const filteredBlocks = useMemo(() => {
      return blocks.filter((block, index) => {
        if (block.type !== 'empty') return true
        // Filter out leading empty blocks
        if (index === 0) return false
        // Deduplicate consecutive empty blocks (keep one for paragraph spacing)
        if (blocks[index - 1].type === 'empty') return false
        // Keep a single empty block between non-empty blocks for spacing
        return true
      })
    }, [blocks])

    const filteredThinkingBlocks = useMemo(() => {
      return thinkingBlocks.filter((block) => block.type !== 'empty')
    }, [thinkingBlocks])

    

    const prefixOffset = showPrefix && roleStyle && roleStyle.prefix ? roleStyle.prefix.length + 1 : 0

    const hasToolBlocks = contentBlocks && contentBlocks.some(b => b.type === 'tool_use' || b.type === 'tool_result')

    // ===== Content-block-driven rendering (Claude Code style) =====
    // When contentBlocks are present, render from the structured block model
    // instead of the flat markdown string.
    const shouldUseContentBlocks = contentBlocks && contentBlocks.length > 0;

    // User messages: compact "> prefix" style with theme primary color
    if (role === 'user') {
      return (
        <Box flexDirection="row" marginBottom={0}>
          <Box marginRight={1} flexShrink={0}>
            <Text color={theme.colors.primary}>{'>'}</Text>
          </Box>
          <Box flexGrow={1} paddingX={1}>
            <Text color={theme.colors.primary} wrap="wrap">{content}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" marginBottom={0}>
        {/* Thinking block — rendered inline */}
        {shouldUseContentBlocks ? (
          <ContentBlockRenderer
            contentBlocks={contentBlocks!}
            content={content}
            theme={theme}
            isStreaming={isStreaming}
            roleStyle={roleStyle}
            terminalWidth={terminalWidth}
            prefixOffset={prefixOffset}
          />
        ) : (
          <>
            {/* Legacy path: flat thinking + markdown rendering */}
            {!!thinking && (
              <Box flexDirection="column">
                {isStreaming ? (
                  <>
                    <Box>
                      <Text color={theme.colors.text.muted} dimColor>
                        <ThinkingIcon />
                        <Text color={theme.colors.text.muted} dimColor italic>thinking</Text>
                      </Text>
                    </Box>
                    <Box flexDirection="column" marginLeft={0}>
                      {filteredThinkingBlocks.map((block, index) => (
                        <Box key={index}>
                          <Text color={theme.colors.text.muted} dimColor italic>
                            {block.content}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  </>
                ) : thinking.length > 0 ? (
                  <>
                    <Box>
                      <Text color={theme.colors.text.muted} dimColor>
                        <Text color={theme.colors.primary}>{'□ '}</Text>
                        <Text color={theme.colors.text.muted} dimColor italic>thought</Text>
                      </Text>
                    </Box>
                    <Box flexDirection="column" marginLeft={0}>
                      {filteredThinkingBlocks.map((block, index) => (
                        <Box key={index}>
                          <Text color={theme.colors.text.muted} dimColor italic>
                            {block.content}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  </>
                ) : null}
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
          </>
        )}

        {/* Tool actions — only in legacy path; content block path renders inline */}
        {!shouldUseContentBlocks && hasToolBlocks && (
          <ActionsBlock
            contentBlocks={contentBlocks!}
            theme={theme}
            prefixOffset={prefixOffset}
          />
        )}

        {isStreaming && (
          <StreamingCursor prefixOffset={prefixOffset} hasContent={content.length > 0 || (thinking?.length ?? 0) > 0} />
        )}
      </Box>
    )
  },
  messageRendererComparator,
)

MessageRenderer.displayName = 'MessageRenderer'

// ===== Content Block Renderer (Claude Code style — inline rendering) =====

interface ContentBlockRendererProps {
  contentBlocks: ContentBlock[]
  content: string
  theme: any
  isStreaming?: boolean
  roleStyle?: { color: string; prefix: string; bold?: boolean }
  terminalWidth: number
  prefixOffset: number
}

/**
 * ContentBlockRenderer — renders structured content blocks inline.
 * Matches Claude Code's rendering: text blocks as markdown, thinking blocks inline,
 * tool_use blocks as ● colored lines, all in sequence.
 */
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({
  contentBlocks,
  content,
  theme,
  isStreaming,
  roleStyle,
  terminalWidth,
  prefixOffset,
}) => {
  const roleStyleWithPrefix = roleStyle && roleStyle.prefix ? roleStyle : undefined;

  // Track whether we've emitted the prefix for the first block only
  // Using a Set ref to persist across map callbacks within a single render pass
  const prefixRef = useRef({ emitted: false });
  prefixRef.current.emitted = false;

  const emitPrefix = (): React.ReactNode | null => {
    if (prefixRef.current.emitted || !roleStyleWithPrefix) return null;
    prefixRef.current.emitted = true;
    return (
      <Box marginRight={1}>
        <Text color={roleStyleWithPrefix.color} bold={roleStyleWithPrefix.bold}>
          {roleStyleWithPrefix.prefix}
        </Text>
      </Box>
    );
  };

  return (
    <>
      {contentBlocks.map((block, idx) => {
        if (block.type === 'thinking') {
          const isActive = isStreaming && idx === contentBlocks.length - 1;
          const filtered = parseMarkdown(block.thinking).filter(b => b.type !== 'empty');

          return (
            <Box key={`cb-think-${idx}`} flexDirection="column">
              {emitPrefix()}
              {isActive ? (
                <>
                  <Box>
                    <Text color={theme.colors.text.muted} dimColor>
                      <ThinkingIcon />
                      <Text color={theme.colors.text.muted} dimColor italic>thinking</Text>
                    </Text>
                  </Box>
                  <Box flexDirection="column" marginLeft={2}>
                    {filtered.map((b, i) => (
                      <Box key={i}>
                        <Text color={theme.colors.text.muted} dimColor italic>{b.content}</Text>
                      </Box>
                    ))}
                  </Box>
                </>
              ) : block.thinking ? (
                <>
                  <Box>
                    <Text color={theme.colors.text.muted} dimColor>
                      <Text color={theme.colors.primary}>{'□ '}</Text>
                      <Text color={theme.colors.text.muted} dimColor italic>thought</Text>
                    </Text>
                  </Box>
                  <Box flexDirection="column" marginLeft={2}>
                    {filtered.map((b, i) => (
                      <Box key={i}>
                        <Text color={theme.colors.text.muted} dimColor italic>{b.content}</Text>
                      </Box>
                    ))}
                  </Box>
                </>
              ) : null}
            </Box>
          );
        }

        if (block.type === 'text') {
          const parsed = parseMarkdown(block.text);
          const filtered = parsed.filter(b => b.type !== 'empty');
          return (
            <Box key={`cb-text-${idx}`} flexDirection="column">
              {emitPrefix()}
              {filtered.map((b, i) => (
                <BlockRenderer
                  key={i}
                  block={b}
                  isFirst={false}
                  roleStyle={undefined}
                  terminalWidth={terminalWidth}
                  theme={theme}
                />
              ))}
            </Box>
          );
        }

        if (block.type === 'tool_use') {
          const result = contentBlocks.find(
            b => b.type === 'tool_result' && (b as any).tool_use_id === block.id
          ) as (ContentBlock & { type: 'tool_result' }) | undefined

          return (
            <ToolUseBlock
              key={`cb-tool-${block.id || idx}`}
              block={block}
              result={result}
              theme={theme}
              prefixOffset={prefixOffset}
            />
          );
        }

        return null;
      })}

      {/* Render any remaining text content from the message's content prop
          (not duplicated in contentBlocks as text blocks) */}
      {content && contentBlocks.every(b => b.type !== 'text') && (
        <Box key="remaining-text" flexDirection="column">
          {emitPrefix()}
          {parseMarkdown(content)
            .filter(b => b.type !== 'empty')
            .map((b, i) => (
              <BlockRenderer
                key={i}
                block={b}
                isFirst={false}
                roleStyle={undefined}
                terminalWidth={terminalWidth}
                theme={theme}
              />
            ))}
        </Box>
      )}
    </>
  );
};

// ===== Streaming Cursor Component (animated) =====

// Braille spinner — shown before first token (matches Claude Code style)
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPIN_INTERVAL = 80

// Smooth breathing bar — shown while text is streaming
const CURSOR_FRAMES = ['▏', '▎', '▍', '▌', '▌', '▍', '▎', '▏', '▏', ' ', ' ', ' ']
const CURSOR_INTERVAL = 65

const StreamingCursor: React.FC<{ prefixOffset: number; hasContent: boolean }> = React.memo(
  ({ prefixOffset, hasContent }) => {
    const theme = themeManager.getTheme()
    const [frame, setFrame] = useState(0)

    useEffect(() => {
      setFrame(0)
      const interval = setInterval(
        () => setFrame(f => (f + 1) % (hasContent ? CURSOR_FRAMES.length : SPIN_FRAMES.length)),
        hasContent ? CURSOR_INTERVAL : SPIN_INTERVAL
      )
      return () => clearInterval(interval)
    }, [hasContent])

    return (
      <Box marginLeft={prefixOffset}>
        <Text color={theme.colors.primary}>
          {hasContent ? CURSOR_FRAMES[frame] : SPIN_FRAMES[frame]}
        </Text>
      </Box>
    )
  }
)

StreamingCursor.displayName = 'StreamingCursor'

// ===== Animated thinking icon =====
const THINK_FRAMES = ['◌', '○', '◎', '●', '◎', '○']
const THINK_INTERVAL = 180

const ThinkingIcon: React.FC = React.memo(() => {
  const theme = themeManager.getTheme()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % THINK_FRAMES.length), THINK_INTERVAL)
    return () => clearInterval(t)
  }, [])
  return <Text color={theme.colors.primary}>{THINK_FRAMES[frame]}{' '}</Text>
})
ThinkingIcon.displayName = 'ThinkingIcon'

// ===== Tool Use Block (shared between ContentBlockRenderer and ActionsBlock) =====

interface ToolUseBlockProps {
  block: ContentBlock & { type: 'tool_use' }
  result?: ContentBlock & { type: 'tool_result' }
  theme: any
  prefixOffset: number
}

const ToolUseBlock: React.FC<ToolUseBlockProps> = React.memo(({
  block,
  result,
  theme,
  prefixOffset,
}) => {
  const isError   = block.status === 'error'
  const isRunning = block.status === 'running'
  const dotColor  = isError ? DOT_ERR : isRunning ? DOT_RUN : DOT_OK
  const elapsed   = block.completedAt ? formatElapsed(block.completedAt - block.startedAt) : null
  const summary   = getToolSummary(block.name, block.input)
  const { label, path } = splitToolSummary(summary)

  const subLines: Array<{ text: string; isUrl: boolean; isDiff?: boolean; diffType?: '+' | '-' }> = []
  if (result?.content) {
    const lines = result.content.split('\n').filter(l => l.trim())
    const diffLines = lines.filter(l => /^[+-]/.test(l) && !l.startsWith('+++') && !l.startsWith('---'))
    if (diffLines.length > 0) {
      const added   = diffLines.filter(l => l.startsWith('+')).length
      const removed = diffLines.filter(l => l.startsWith('-')).length
      if (added > 0 || removed > 0) {
        subLines.push({ text: `${added > 0 ? `+${added}` : ''}${removed > 0 ? ` -${removed}` : ''} lines`, isUrl: false })
      }
      diffLines.slice(0, 5).forEach(l => {
        subLines.push({ text: l, isUrl: false, isDiff: true, diffType: l.startsWith('+') ? '+' : '-' })
      })
    } else {
      lines.slice(0, 4).forEach(line => {
        const trimmed = line.length > 100 ? line.slice(0, 97) + '…' : line
        subLines.push({ text: trimmed, isUrl: /^https?:\/\//.test(trimmed) })
      })
    }
  }

  return (
    <Box flexDirection="column" marginLeft={prefixOffset}>
      <Box>
        <Text color={dotColor} bold>{'● '}</Text>
        <Text color={theme.colors.text.primary} bold>{label}</Text>
        {path && <Text color={isError ? DOT_ERR : DOT_OK}>{path}</Text>}
        {elapsed && <Text color={theme.colors.text.muted} dimColor>{' '}{elapsed}</Text>}
      </Box>
      {subLines.map((sub, i) => (
        <Box key={i} marginLeft={2}>
          <Text color={theme.colors.text.muted} dimColor>
            {i === 0 ? '└ ' : '  '}
          </Text>
          {sub.isDiff ? (
            <Box backgroundColor={sub.diffType === '+' ? '#0d2b0d' : '#2b0d0d'}>
              <Text color={sub.diffType === '+' ? DOT_OK : DOT_ERR}>{sub.text}</Text>
            </Box>
          ) : sub.isUrl ? (
            <Text color="#58a6ff" underline>{sub.text}</Text>
          ) : (
            <Text color={isError ? DOT_ERR : theme.colors.text.muted} dimColor={!isError}>{sub.text}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}, (prev, next) =>
  prev.block === next.block &&
  prev.result === next.result &&
  prev.theme === next.theme &&
  prev.prefixOffset === next.prefixOffset
)

ToolUseBlock.displayName = 'ToolUseBlock'

// ===== Tool Call Visual Components =====


function shortenPath(p: string): string {
  if (p.length <= 45) return p
  const parts = p.split('/')
  return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : p
}

function getToolSummary(name: string, input: string): string {
  if (!input) return name
  try {
    const args = JSON.parse(input)
    switch (name) {
      case 'Read':
      case 'Write':
      case 'Edit':
        return `${name}(${shortenPath(args.file_path || '')})`
      case 'Bash': {
        const cmd = (args.command || '').trim().replace(/\n/g, ' ')
        return `${name}(${cmd.length > 60 ? cmd.slice(0, 57) + '…' : cmd})`
      }
      case 'Glob':
        return `${name}(${args.pattern || ''})`
      case 'Grep':
        return `${name}(${args.pattern || ''}${args.path ? ` in ${shortenPath(args.path)}` : ''})`
      default: {
        const entries = Object.entries(args)
        if (entries.length === 0) return name
        const [, val] = entries[0]
        const valStr = String(val)
        return `${name}(${valStr.length > 45 ? valStr.slice(0, 42) + '…' : valStr})`
      }
    }
  } catch {
    return name
  }
}

// Split "Name(path)" into {label, path} for separate coloring
function splitToolSummary(summary: string): { label: string; path: string } {
  const m = summary.match(/^([^(]+)(\(.+\))$/)
  if (m) return { label: m[1], path: m[2] }
  return { label: summary, path: '' }
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ===== Colors =====
const DOT_OK  = '#3fb950'
const DOT_ERR = '#f85149'
const DOT_RUN = '#e3b341'

// ===== ActionsBlock — delegates to ToolUseBlock =====

interface ActionsBlockProps {
  contentBlocks: ContentBlock[]
  theme: any
  prefixOffset: number
}

const ActionsBlock: React.FC<ActionsBlockProps> = ({ contentBlocks, theme, prefixOffset }) => {
  const toolBlocks = contentBlocks.filter(b => b.type === 'tool_use')
  if (toolBlocks.length === 0) return null

  return (
    <Box flexDirection="column">
      {contentBlocks.map((block, idx) => {
        if (block.type !== 'tool_use') return null

        const result = contentBlocks.find(
          b => b.type === 'tool_result' && (b as any).tool_use_id === block.id
        ) as (ContentBlock & { type: 'tool_result' }) | undefined

        return (
          <ToolUseBlock
            key={`action-${block.id || idx}`}
            block={block}
            result={result}
            theme={theme}
            prefixOffset={0}
          />
        )
      })}
    </Box>
  )
}

// ===== Block Renderer =====

interface BlockRendererProps {
  block: ParsedBlock
  isFirst: boolean
  roleStyle?: { color: string; prefix: string; bold?: boolean }
  terminalWidth: number
  theme: ReturnType<typeof themeManager.getTheme>
}

const BlockRenderer: React.FC<BlockRendererProps> = React.memo(({
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

  const roleStyleWithPrefix = roleStyle && roleStyle.prefix ? roleStyle : undefined;

  return (
    <Box flexDirection="row">
      {isFirst && roleStyleWithPrefix && (
        <Box marginRight={1}>
          <Text color={roleStyleWithPrefix.color} bold={roleStyleWithPrefix.bold}>
            {roleStyleWithPrefix.prefix}
          </Text>
        </Box>
      )}
      {!isFirst && roleStyleWithPrefix && <Box width={prefixWidth + 1} />}

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
}, (prev, next) =>
  prev.block === next.block &&
  prev.isFirst === next.isFirst &&
  prev.terminalWidth === next.terminalWidth &&
  prev.theme === next.theme
)

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

// VS Code diff colors — reused for Before/After tables
const VS_TABLE_DEL = '#f85149'
const VS_TABLE_ADD = '#3fb950'

function getDiffColumnColor(header: string): string | null {
  const h = header.trim().toLowerCase()
  if (/^(before|old|previous|removed?|from)$/.test(h)) return VS_TABLE_DEL
  if (/^(after|new|updated?|added?|to)$/.test(h))      return VS_TABLE_ADD
  return null
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

  // Detect if any column is a diff column (Before/After/etc.)
  const diffColors = headers.map(h => getDiffColumnColor(h))
  const isDiffTable = diffColors.some(c => c !== null)

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
        {headers.map((header, index) => {
          const diffColor = diffColors[index]
          return (
            <React.Fragment key={index}>
              <Text bold color={diffColor ?? theme.colors.primary}>
                {renderCell(header, columnWidths[index], alignments[index] || 'left')}
              </Text>
              <Text color={theme.colors.border.light}>│</Text>
            </React.Fragment>
          )
        })}
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
            const diffColor = diffColors[colIndex]
            const hasInlineFormat = /\*\*|`|~~|\[.*\]\(/.test(cellContent)
            return (
              <React.Fragment key={colIndex}>
                {diffColor ? (
                  <Text color={diffColor} dimColor={rowIndex % 2 === 0}>
                    {paddedContent}
                  </Text>
                ) : hasInlineFormat ? (
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
