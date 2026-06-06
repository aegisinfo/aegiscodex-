/**
 */

/**
 * 
 */
export type BlockType = 
  | 'text'
  | 'code'
  | 'heading'
  | 'table'
  | 'list'
  | 'hr'
  | 'empty'
  | 'blockquote';

/**
 * 
 */
export type ListType = 'ul' | 'ol';

/**
 * 
 */
export interface TableData {
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
}

/**
 * 
 */
export interface ParsedBlock {
  type: BlockType;
  content: string;
  language?: string;
  
  filePath?: string;
  level?: number;
  listType?: ListType;
  marker?: string;
  tableData?: TableData;
  indent?: number;
}

/**
 * 
 */
export type InlineFormatType = 
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'strikethrough'
  | 'text';

/**
 * 
 */
export interface InlineSegment {
  type: InlineFormatType;
  content: string;
  url?: string;
}
