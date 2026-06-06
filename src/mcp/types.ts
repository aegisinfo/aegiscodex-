/**
 */

import type { EventEmitter } from 'events';

/**
 */
export enum McpConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 
 */
export enum ErrorType {
  NETWORK_TEMPORARY = 'network_temporary',
  NETWORK_PERMANENT = 'network_permanent',
  CONFIG_ERROR = 'config_error',
  AUTH_ERROR = 'auth_error',
  PROTOCOL_ERROR = 'protocol_error',
  UNKNOWN = 'unknown',
}

/**
 * 
 */
export interface ClassifiedError {
  type: ErrorType;
  isRetryable: boolean;
  originalError: Error;
}

/**
 */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, JSONSchemaProperty>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 */
export interface JSONSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: any[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: any;
  oneOf?: JSONSchemaProperty[];
  anyOf?: JSONSchemaProperty[];
  allOf?: JSONSchemaProperty[];
  $ref?: string;
}

/**
 */
export interface McpToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

/**
 */
export interface McpServerConfig {
  
  type: 'stdio' | 'sse' | 'http';
  
  command?: string;
  
  args?: string[];
  
  env?: Record<string, string>;
  
  cwd?: string;
  
  url?: string;
  
  headers?: Record<string, string>;
  oauth?: OAuthConfig;
  healthCheck?: HealthCheckConfig;
  
  enabled?: boolean;
  
  timeout?: number;
  
  description?: string;
}

/**
 */
export interface OAuthConfig {
  enabled: boolean;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;
}

/**
 * 
 */
export interface HealthCheckConfig {
  enabled: boolean;
  
  intervalMs: number;
  
  timeoutMs: number;
  
  maxFailures: number;
}

/**
 */
export interface McpServerInfo {
  
  config: McpServerConfig;
  
  client: McpClientInterface;
  
  status: McpConnectionStatus;
  
  tools: McpToolDefinition[];
  
  serverName?: string;
  
  serverVersion?: string;
  
  connectedAt?: Date;
  
  lastError?: Error;
}

/**
 */
export interface McpClientInterface extends EventEmitter {
  
  readonly connectionStatus: McpConnectionStatus;
  
  readonly availableTools: McpToolDefinition[];
  
  readonly serverName: string;

  
  connectWithRetry(maxRetries?: number, initialDelay?: number): Promise<void>;
  
  disconnect(): Promise<void>;
  
  callTool(name: string, arguments_: Record<string, any>): Promise<McpToolCallResponse>;
  
  reloadTools(): Promise<void>;
}

/**
 */
export interface McpRegistryStatistics {
  totalServers: number;
  connectedServers: number;
  disconnectedServers: number;
  errorServers: number;
  totalTools: number;
}

/**
 */
export interface McpClientEvents {
  connected: (serverInfo: { name: string; version: string }) => void;
  disconnected: () => void;
  error: (error: Error) => void;
  reconnecting: (attempt: number) => void;
  reconnected: () => void;
  reconnectFailed: () => void;
  toolsUpdated: (tools: McpToolDefinition[]) => void;
  unhealthy: (failures: number, error: Error) => void;
}

export interface McpRegistryEvents {
  serverRegistered: (name: string, info: McpServerInfo) => void;
  serverConnected: (name: string, server: { name: string; version: string }) => void;
  serverDisconnected: (name: string) => void;
  serverError: (name: string, error: Error) => void;
  toolsUpdated: (serverName: string, tools: McpToolDefinition[], oldCount: number) => void;
}

/**
 * 
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalMs: 30000,    // 30 
  timeoutMs: 5000,      // 5 
  maxFailures: 3,
};

/**
 * 
 */
export const DEFAULT_CONNECTION_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxReconnectAttempts: 5,
  maxReconnectDelay: 30000,
};
