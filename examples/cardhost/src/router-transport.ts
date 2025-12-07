/**
 * RouterServerTransport - ServerTransport implementation for cardhost
 * Connects to router via WebSocket
 */

import type {
  ServerTransport,
  RpcRequest,
  RpcResponse,
  RpcEvent,
} from "@aokiapp/jsapdu-over-ip";
import WebSocket from "ws";
import { signChallenge, generatePublicKeyPEM } from "./crypto.js";

export interface RouterServerTransportConfig {
  routerUrl: string;
  uuid: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  reconnectDelay?: number;
}

interface RouterMessage {
  type: "auth-challenge" | "auth-success" | "rpc-request" | "rpc-response" | "rpc-event";
  data?: any;
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

      this.ws.on("open", () => {
        clearTimeout(timeout);
        console.log("[RouterServerTransport] WebSocket connected");
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
      case "auth-challenge": {
        // Router sends challenge for authentication
        const challenge = message.data.challenge;
        const publicKeyPEM = await generatePublicKeyPEM(this.config.publicKey);
        const signature = await signChallenge(
          challenge,
          this.config.privateKey
        );

        const authResponse: RouterMessage = {
          type: "auth-success",
          data: {
            uuid: this.config.uuid,
            publicKey: publicKeyPEM,
            signature,
          },
        };

        this.ws!.send(JSON.stringify(authResponse));
        break;
      }

      case "auth-success": {
        console.log("[RouterServerTransport] Authentication successful");
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
