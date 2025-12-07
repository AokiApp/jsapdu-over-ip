/**
 * WebSocket client for controller
 *
 * Handles connection to router and communication with cardhosts
 */

export type MessageType = 'request' | 'response' | 'event' | 'heartbeat';

export interface RequestMessage {
  type: 'request';
  id: string;
  method: string;
  params: unknown[];
  targetCardhost?: string;
}

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

export interface EventMessage {
  type: 'event';
  event: string;
  data: unknown;
  sourceCardhost?: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: string;
}

export type WebSocketMessage =
  | RequestMessage
  | ResponseMessage
  | EventMessage
  | HeartbeatMessage;

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Failed = 'failed',
}

export interface WebSocketClientConfig {
  url: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onEvent?: (event: EventMessage) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.Disconnected;
  private pendingRequests: Map<
    string,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
    }
  > = new Map();
  private requestIdCounter = 0;
  private heartbeatTimer: number | null = null;

  constructor(private config: WebSocketClientConfig) {}

  /**
   * Connect to router WebSocket
   */
  async connect(): Promise<void> {
    if (
      this.state === ConnectionState.Connecting ||
      this.state === ConnectionState.Connected
    ) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.state = ConnectionState.Connecting;
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.state = ConnectionState.Connected;
        this.startHeartbeat();
        if (this.config.onConnected) {
          this.config.onConnected();
        }
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.state = ConnectionState.Failed;
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.state = ConnectionState.Disconnected;
        this.stopHeartbeat();
        if (this.config.onDisconnected) {
          this.config.onDisconnected();
        }
      };
    });
  }

  /**
   * Disconnect from router
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = ConnectionState.Disconnected;
  }

  /**
   * Send RPC request to cardhost
   */
  async sendRequest(
    method: string,
    params: unknown[],
    targetCardhost: string
  ): Promise<unknown> {
    if (this.state !== ConnectionState.Connected || !this.ws) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${this.requestIdCounter++}`;

      this.pendingRequests.set(id, { resolve, reject });

      const request: RequestMessage = {
        type: 'request',
        id,
        method,
        params,
        targetCardhost,
      };

      this.ws!.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'response':
          this.handleResponse(message);
          break;
        case 'event':
          this.handleEvent(message);
          break;
        case 'heartbeat':
          // Echo heartbeat
          this.send({ type: 'heartbeat', timestamp: new Date().toISOString() });
          break;
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private handleResponse(response: ResponseMessage): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('Received response for unknown request:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  private handleEvent(event: EventMessage): void {
    if (this.config.onEvent) {
      this.config.onEvent(event);
    }
  }

  private send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      });
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
