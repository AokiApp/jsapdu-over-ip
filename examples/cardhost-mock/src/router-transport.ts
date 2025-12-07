/**
 * RouterServerTransport - ServerTransport implementation for cardhost-mock
 * Connects to router via WebSocket
 * 
 * Simplified version for testing - inlines crypto functions
 */

import type {
  ServerTransport,
  RpcRequest,
  RpcResponse,
  RpcEvent,
} from "@aokiapp/jsapdu-over-ip";
import WebSocket from "ws";
import { webcrypto } from 'crypto';

export interface RouterServerTransportConfig {
  routerUrl: string;
  uuid: string;
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
  reconnectDelay?: number;
}

interface RouterMessage {
  type: "auth-challenge" | "auth-success" | "auth-failed" | "registered" | "rpc-request" | "rpc-response" | "rpc-event";
  data?: any;
}

/**
 * Inline crypto helper: export public key to PEM format
 */
async function generatePublicKeyPEM(publicKey: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey('spki', publicKey);
  return Buffer.from(exported).toString('base64');
}

/**
 * Inline crypto helper: sign challenge with private key
 */
async function signChallenge(privateKey: webcrypto.CryptoKey, challenge: string): Promise<string> {
  const dataBuffer = new TextEncoder().encode(challenge);
  const signature = await webcrypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    privateKey,
    dataBuffer
  );
  return Buffer.from(signature).toString('base64');
}

/**
 * ServerTransport that connects cardhost to router
 */
export class RouterServerTransport implements ServerTransport {
  private ws: WebSocket | null = null;
  private requestHandler?: (request: RpcRequest) => Promise<RpcResponse>;
  private config: RouterServerTransportConfig;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: RouterServerTransportConfig) {
    this.config = {
      reconnectDelay: 5000,
      ...config,
    };
  }

  /**
   * Register RPC request handler - called by SmartCardPlatformAdapter
   */
  onRequest(handler: (request: RpcRequest) => Promise<RpcResponse>): void {
    this.requestHandler = handler;
  }

  /**
   * Send event to controllers via router
   */
  emitEvent(event: RpcEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[RouterServerTransport] Cannot emit event - not connected");
      return;
    }

    const message: RouterMessage = {
      type: "rpc-event",
      data: event,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Start transport - connect to router
   */
  async start(): Promise<void> {
    this.isRunning = true;
    await this.connect();
  }

  /**
   * Stop transport - disconnect from router
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Connect to router with authentication
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(
        `[RouterServerTransport] Connecting to ${this.config.routerUrl}...`
      );

      this.ws = new WebSocket(this.config.routerUrl);

      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error("Connection timeout"));
      }, 10000);

      this.ws.on("open", async () => {
        clearTimeout(timeout);
        console.log("[RouterServerTransport] WebSocket connected");
        
        // Send authentication immediately (simplified - no challenge/response for now)
        const publicKeyPEM = await generatePublicKeyPEM(this.config.publicKey);
        const authMessage: RouterMessage = {
          type: "auth-success",
          data: {
            uuid: this.config.uuid,
            publicKey: publicKeyPEM,
          },
        };
        
        this.ws!.send(JSON.stringify(authMessage));
      });

      this.ws.on("message", async (data: WebSocket.Data) => {
        try {
          const message: RouterMessage = JSON.parse(data.toString());
          await this.handleMessage(message, resolve);
        } catch (error) {
          console.error(
            "[RouterServerTransport] Message handling error:",
            error
          );
        }
      });

      this.ws.on("close", () => {
        console.log("[RouterServerTransport] WebSocket closed");
        this.ws = null;

        if (this.isRunning && !this.reconnectTimeout) {
          console.log(
            `[RouterServerTransport] Reconnecting in ${this.config.reconnectDelay}ms...`
          );
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect().catch((err) =>
              console.error("[RouterServerTransport] Reconnect failed:", err)
            );
          }, this.config.reconnectDelay);
        }
      });

      this.ws.on("error", (error: Error) => {
        console.error("[RouterServerTransport] WebSocket error:", error);
      });
    });
  }

  /**
   * Handle incoming messages from router
   */
  private async handleMessage(
    message: RouterMessage,
    connectResolve: (value: void) => void
  ): Promise<void> {
    switch (message.type) {
      case "registered": {
        console.log("[RouterServerTransport] Registration successful");
        connectResolve();
        break;
      }

      case "rpc-request": {
        // Router forwards RPC request from controller
        const request: RpcRequest = message.data;

        if (!this.requestHandler) {
          const errorResponse: RpcResponse = {
            id: request.id,
            error: {
              code: "NO_HANDLER",
              message: "No request handler registered",
            },
          };
          this.sendRpcResponse(errorResponse);
          return;
        }

        try {
          const response = await this.requestHandler(request);
          this.sendRpcResponse(response);
        } catch (error) {
          const errorResponse: RpcResponse = {
            id: request.id,
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          };
          this.sendRpcResponse(errorResponse);
        }
        break;
      }

      default:
        console.warn(
          "[RouterServerTransport] Unknown message type:",
          message.type
        );
    }
  }

  /**
   * Send RPC response back to router
   */
  private sendRpcResponse(response: RpcResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "[RouterServerTransport] Cannot send response - not connected"
      );
      return;
    }

    const message: RouterMessage = {
      type: "rpc-response",
      data: response,
    };

    this.ws.send(JSON.stringify(message));
  }
}
