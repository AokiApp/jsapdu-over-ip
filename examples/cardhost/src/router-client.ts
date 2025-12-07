/**
 * WebSocket client for connecting to router
 *
 * Handles:
 * - Connection and reconnection with exponential backoff
 * - Authentication using public-key cryptography
 * - Heartbeat management
 * - Message routing
 */

import WebSocket from 'ws';
import type {
  WebSocketMessage,
  RegisterMessage,
  RegisteredMessage,
  RequestMessage,
  ResponseMessage,
  EventMessage,
  HeartbeatMessage,
} from '@aokiapp/jsapdu-over-ip-examples-shared';
import * as crypto from './crypto.js';

export interface RouterClientConfig {
  url: string;
  uuid: string;
  publicKey: string;
  privateKey: CryptoKey;
  heartbeatInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  onRequest: (request: RequestMessage) => Promise<ResponseMessage>;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Authenticating = 'authenticating',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Failed = 'failed',
}

export class RouterClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.Disconnected;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private config: RouterClientConfig;

  constructor(config: RouterClientConfig) {
    this.config = config;
  }

  /**
   * Start connection to router
   */
  public async connect(): Promise<void> {
    if (
      this.state === ConnectionState.Connecting ||
      this.state === ConnectionState.Connected
    ) {
      console.log('Already connected or connecting');
      return;
    }

    this.state = ConnectionState.Connecting;
    console.log(`Connecting to router at ${this.config.url}...`);

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('error', (error) => this.onError(error));
      this.ws.on('close', () => this.onClose());
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from router
   */
  public disconnect(): void {
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = ConnectionState.Disconnected;
  }

  /**
   * Send event to router
   */
  public async sendEvent(event: string, data: unknown): Promise<void> {
    if (this.state !== ConnectionState.Connected || !this.ws) {
      throw new Error('Not connected to router');
    }

    const message: EventMessage = {
      type: 'event',
      event,
      data,
      sourceCardhost: this.config.uuid,
    };

    this.send(message);
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  private async onOpen(): Promise<void> {
    console.log('WebSocket connection opened');
    this.state = ConnectionState.Authenticating;

    // Send registration message with authentication
    await this.register();
  }

  private async register(): Promise<void> {
    // Create challenge for authentication
    const challenge = crypto.createChallenge();
    const signature = await crypto.createAuthResponse(
      this.config.privateKey,
      challenge
    );

    const registerMessage: RegisterMessage = {
      type: 'register',
      uuid: this.config.uuid,
      name: `Cardhost-${this.config.uuid.substring(0, 8)}`,
      secret: undefined, // deprecated, using public-key auth instead
      capabilities: {
        readers: 0, // Will be updated after platform initialization
      },
      // Add authentication fields (extension to base protocol)
      publicKey: this.config.publicKey,
      challenge,
      signature,
    } as RegisterMessage & {
      publicKey: string;
      challenge: string;
      signature: string;
    };

    this.send(registerMessage);
  }

  private async onMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'registered':
          await this.handleRegistered(message);
          break;
        case 'request':
          await this.handleRequest(message);
          break;
        case 'heartbeat':
          await this.handleHeartbeat(message);
          break;
        default:
          console.warn('Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      console.error('Failed to process message:', error);
    }
  }

  private async handleRegistered(
    message: RegisteredMessage
  ): Promise<void> {
    if (message.success) {
      console.log('Successfully registered with router');
      this.state = ConnectionState.Connected;
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      if (this.config.onConnected) {
        this.config.onConnected();
      }
    } else {
      console.error('Registration failed:', message.message);
      this.ws?.close();
    }
  }

  private async handleRequest(message: RequestMessage): Promise<void> {
    try {
      const response = await this.config.onRequest(message);
      this.send(response);
    } catch (error) {
      const errorResponse: ResponseMessage = {
        type: 'response',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      };
      this.send(errorResponse);
    }
  }

  private async handleHeartbeat(_message: HeartbeatMessage): Promise<void> {
    // Respond to heartbeat
    const response: HeartbeatMessage = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    };
    this.send(response);
  }

  private onError(error: Error): void {
    console.error('WebSocket error:', error);
  }

  private onClose(): void {
    console.log('WebSocket connection closed');
    this.stopHeartbeat();

    if (this.state === ConnectionState.Connected) {
      if (this.config.onDisconnected) {
        this.config.onDisconnected();
      }
    }

    this.state = ConnectionState.Disconnected;
    this.scheduleReconnect();
  }

  private send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not open');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      const heartbeat: HeartbeatMessage = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      };
      this.send(heartbeat);
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.state = ConnectionState.Failed;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms...`
    );

    this.state = ConnectionState.Reconnecting;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}
