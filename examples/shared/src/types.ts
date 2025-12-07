/**
 * Shared Types for jsapdu-over-ip Examples
 */

/**
 * Cardhost information (from router API)
 */
export interface CardhostInfo {
  uuid: string;
  name?: string;
  status: 'connected' | 'disconnected';
  connectedAt: string; // ISO 8601
  lastHeartbeat?: string; // ISO 8601
  capabilities?: {
    readers: number;
    supportedProtocols?: string[];
  };
}

/**
 * Detailed cardhost information
 */
export interface CardhostDetails extends CardhostInfo {
  readers?: Array<{
    name: string;
    hasCard: boolean;
  }>;
  statistics?: {
    totalCommands: number;
    uptime: number; // seconds
    lastCommandAt?: string; // ISO 8601
  };
}

/**
 * Controller session information
 */
export interface ControllerSession {
  sessionId: string;
  wsUrl: string;
  expiresAt: string; // ISO 8601
}

/**
 * Error response from API
 */
export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

/**
 * JSON-RPC Error Codes
 */
export enum RpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  CardhostNotFound = -32000,
  CardhostTimeout = -32001,
  CardNotPresent = -32002,
  ApduError = -32003,
  AuthenticationFailed = -32004,
}

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Failed = 'failed',
}

/**
 * Configuration for WebSocket connection
 */
export interface WebSocketConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number; // milliseconds
  maxReconnectAttempts?: number;
  heartbeatInterval?: number; // milliseconds
  heartbeatTimeout?: number; // milliseconds
}

/**
 * Default WebSocket configuration
 */
export const defaultWebSocketConfig: Partial<WebSocketConfig> = {
  reconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  heartbeatTimeout: 90000,
};
