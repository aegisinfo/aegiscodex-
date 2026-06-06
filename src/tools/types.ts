/**
 * 
 */

/**
 * 
 * 
 */
export enum ToolKind {
  
  ReadOnly = 'readonly',
  
  Write = 'write',
  
  Execute = 'execute',
}

/**
 * 
 */
export interface ToolExample {
  description: string;
  params: Record<string, unknown>;
}

/**
 * 
 */
export interface ToolDescription {
  
  short: string;
  
  long?: string;
  
  usageNotes?: string[];
  
  examples?: ToolExample[];
  
  important?: string[];
}

/**
 * 
 */
export enum ToolErrorType {
  
  VALIDATION_ERROR = 'validation_error',
  
  EXECUTION_ERROR = 'execution_error',
  
  PERMISSION_ERROR = 'permission_error',
  
  TIMEOUT_ERROR = 'timeout_error',
  
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * 
 */
export interface ToolError {
  type: ToolErrorType;
  message: string;
  details?: unknown;
}

/**
 * 
 */
export interface ToolResult {
  
  success: boolean;
  
  llmContent: string;
  
  displayContent: string;
  
  error?: ToolError;
  
  metadata?: Record<string, unknown>;
}

/**
 * 
 */
export interface ExecutionContext {
  
  sessionId?: string;
  
  signal?: AbortSignal;
  
  cwd?: string;
}

/**
 */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * 
 */
export interface ToolInvocation<TParams = unknown> {
  
  toolName: string;
  
  params: TParams;
  
  callId?: string;
}

/**
 * 
 */
export interface Tool<TParams = unknown> {
  
  readonly name: string;
  
  readonly displayName: string;
  
  readonly kind: ToolKind;
  
  readonly isReadOnly: boolean;
  
  readonly isConcurrencySafe: boolean;
  
  readonly strict: boolean;
  
  readonly description: ToolDescription;
  
  readonly version: string;
  
  readonly category?: string;
  
  readonly tags: string[];

  
  getFunctionDeclaration(): FunctionDeclaration;

  
  build(params: TParams): ToolInvocation<TParams>;

  
  execute(params: TParams, context?: ExecutionContext): Promise<ToolResult>;

  
  extractSignatureContent?: (params: unknown) => string;

  
  abstractPermissionRule?: (params: unknown) => string;
}
