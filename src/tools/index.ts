/**
 * 
 */

// 类
export {
  ToolKind,
  ToolErrorType,
} from './types.js';

export type {
  Tool,
  ToolResult,
  ToolError,
  ToolDescription,
  ToolExample,
  ExecutionContext,
  FunctionDeclaration,
  ToolInvocation,
} from './types.js';

// 工厂函
export { createTool } from './createTool.js';
export type { ToolConfig } from './createTool.js';

// Schema
export { ToolSchemas, optional } from './schemas.js';

// 注册
export { ToolRegistry, createToolRegistry } from './registry.js';

// 注册表事
export type { ToolRegisteredEvent } from './registry.js';

// 内置工
export {
  readTool,
  editTool,
  writeTool,
  grepTool,
  bashTool,
  getBuiltinTools,
} from './builtin/index.js';

// 执行管
export {
  ExecutionPipeline,
  PermissionMode,
  PermissionResult,
  ToolExecution,
} from './execution/index.js';

export type {
  ExecutionPipelineEvents,
  PipelineStage,
  PipelineExecutionContext,
  ExecutionPipelineConfig,
  ExecutionHistoryEntry,
  PermissionCheckResult,
  PermissionConfig,
  ToolInvocationDescriptor,
  ConfirmationDetails,
  ConfirmationResponse,
  ConfirmationHandler,
  ToolProgress,
  PreToolHookResult,
  PostToolHookParams,
} from './execution/index.js';

// 验
export {
  PermissionChecker,
  DEFAULT_PERMISSION_CONFIG,
  SensitiveFileDetector,
  SensitivityLevel,
} from './validation/index.js';

export type {
  SensitivityResult,
  SensitivityResultWithPath,
} from './validation/index.js';
