/**
 * RouterClientTransport - ClientTransport implementation for router communication
 * Implements ClientTransport interface from jsapdu-over-ip library
 */

import type {
  ClientTransport,
  RpcRequest,
  RpcResponse,
  RpcEvent,
} from "@aokiapp/jsapdu-over-ip";

export interface RouterClientTransportConfig {
  routerUrl: string;
  cardhostUuid: string;
}

interface RouterMessage {
  type: "auth-challenge" | "auth-success" | "rpc-request" | "rpc-response";
  data?: any;
}

/**
 * ClientTransport implementation that connects to router via WebSocket
 */
export class RouterClientTransport implements ClientTransport {
  private ws: WebSocket | null = null;
  private config: RouterClientTransportConfig;
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private pendingCalls: Map<
    string,
    {
      resolve: (response: RpcResponse) => void;
      reject: (error: Error) => void;
    }
  > = new Map();
  private eventCallbacks: Set<(event: RpcEvent) => void> = new Set();
  private requestId = 0;

  constructor(config: RouterClientTransportConfig) {
    this.config = config;
  }

  /**
   * Send RPC request and wait for response
   */
  async call(request: RpcRequest): Promise<RpcResponse> {
    // Ensure connected
    if (!this.connected) {
      if (!this.connectPromise) {
        this.connectPromise = this.connect();
      }
      await this.connectPromise;
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      // Store pending request
      this.pendingCalls.set(request.id, { resolve, reject });

      // Send request to router
      const message: RouterMessage = {
        type: "rpc-request",
        data: {
          target: this.config.cardhostUuid,
          request,
        },
      };

      this.ws.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingCalls.has(request.id)) {
          this.pendingCalls.delete(request.id);
          reject(new Error("RPC request timeout"));
        }
      }, 30000);
    });
  }

  /**
   * Register event listener
   */
  onEvent(callback: (event: RpcEvent) => void): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    this.connected = false;
    this.connectPromise = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reject all pending calls
    for (const [id, { reject }] of this.pendingCalls) {
      reject(new Error("Transport closed"));
      this.pendingCalls.delete(id);
    }
  }

  /**
   * Connect to router
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(
        `[RouterClientTransport] Connecting to ${this.config.routerUrl}...`,
      );

      this.ws = new WebSocket(this.config.routerUrl);

      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error("Connection timeout"));
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        console.log("[RouterClientTransport] WebSocket connected");
        this.connected = true;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: RouterMessage = JSON.parse(event.data);
          this.handleMessage(message, resolve);
        } catch (error) {
          console.error(
            "[RouterClientTransport] Message handling error:",
            error,
          );
        }
      };

      this.ws.onclose = () => {
        console.log("[RouterClientTransport] WebSocket closed");
        this.connected = false;
        this.ws = null;
      };

      this.ws.onerror = (error: Event) => {
        console.error("[RouterClientTransport] WebSocket error:", error);
      };
    });
  }

  /**
   * Handle incoming messages from router
   */
  private handleMessage(
    message: RouterMessage,
    connectResolve: (value: void) => void,
  ): void {
    switch (message.type) {
      case "auth-challenge": {
        // For controller, we might skip auth or use simple token
        // For now, just acknowledge
        const authResponse: RouterMessage = {
          type: "auth-success",
          data: {
            target: this.config.cardhostUuid,
          },
        };
        this.ws!.send(JSON.stringify(authResponse));
        break;
      }

      case "auth-success": {
        console.log("[RouterClientTransport] Authentication successful");
        connectResolve();
        break;
      }

      case "rpc-response": {
        const data = message.data;

        // Check if it's an event
        if (data.event) {
          const event: RpcEvent = data;
          for (const callback of this.eventCallbacks) {
            callback(event);
          }
          return;
        }

        // It's a response
        const response: RpcResponse = data;
        const pending = this.pendingCalls.get(response.id);

        if (pending) {
          this.pendingCalls.delete(response.id);
          pending.resolve(response);
        } else {
          console.warn(
            "[RouterClientTransport] Received response for unknown request:",
            response.id,
          );
        }
        break;
      }

      default:
        console.warn(
          "[RouterClientTransport] Unknown message type:",
          message.type,
        );
    }
  }
}
