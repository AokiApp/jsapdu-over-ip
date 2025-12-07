/**
 * WebSocket Protocol Message Types
 * 
 * Defines the message format for communication between
 * controllers, cardhosts, and the router.
 */

/**
 * Base message type discriminator
 */
export type MessageType = 'request' | 'response' | 'event' | 'heartbeat' | 'register' | 'registered';

/**
 * RPC Request Message (Controller → Router → Cardhost)
 */
export interface RequestMessage {
  type: 'request';
  id: string;
  method: string;
  params: unknown[];
  targetCardhost?: string; // UUID of target cardhost (from controller)
}

/**
 * RPC Response Message (Cardhost → Router → Controller)
 */
export interface ResponseMessage {
  type: 'response';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Event Notification Message (Cardhost → Router → Controller)
 */
export interface EventMessage {
  type: 'event';
  event: string;
  data: unknown;
  sourceCardhost?: string; // UUID of originating cardhost
}

/**
 * Heartbeat Message (bidirectional)
 */
export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: string; // ISO 8601 format
}

/**
 * Cardhost Registration Message
 */
export interface RegisterMessage {
  type: 'register';
  uuid: string; // Cardhost UUID
  name?: string; // Optional friendly name
  secret?: string; // Optional authentication secret
  capabilities: {
    readers: number;
    supportedProtocols?: string[];
  };
}

/**
 * Registration Acknowledgment Message
 */
export interface RegisteredMessage {
  type: 'registered';
  success: boolean;
  message: string;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Union type of all WebSocket messages
 */
export type WebSocketMessage =
  | RequestMessage
  | ResponseMessage
  | EventMessage
  | HeartbeatMessage
  | RegisterMessage
  | RegisteredMessage;

/**
 * Type guard for RequestMessage
 */
export function isRequestMessage(msg: WebSocketMessage): msg is RequestMessage {
  return msg.type === 'request';
}

/**
 * Type guard for ResponseMessage
 */
export function isResponseMessage(msg: WebSocketMessage): msg is ResponseMessage {
  return msg.type === 'response';
}

/**
 * Type guard for EventMessage
 */
export function isEventMessage(msg: WebSocketMessage): msg is EventMessage {
  return msg.type === 'event';
}

/**
 * Type guard for HeartbeatMessage
 */
export function isHeartbeatMessage(msg: WebSocketMessage): msg is HeartbeatMessage {
  return msg.type === 'heartbeat';
}

/**
 * Type guard for RegisterMessage
 */
export function isRegisterMessage(msg: WebSocketMessage): msg is RegisterMessage {
  return msg.type === 'register';
}

/**
 * Type guard for RegisteredMessage
 */
export function isRegisteredMessage(msg: WebSocketMessage): msg is RegisteredMessage {
  return msg.type === 'registered';
}
