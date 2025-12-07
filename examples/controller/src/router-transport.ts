/**
 * RouterClientTransport - ClientTransport implementation for controller
 * Connects to router via WebSocket (browser-compatible)
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
  type: "auth-challenge" | "auth-success" | "rpc-request" | "rpc-response" | "rpc-event";
  data?: any;
}

/**
 * ClientTransport that connects controller to router
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

      // Send request directly - router knows which cardhost based on session
      const message: RouterMessage = {
        type: "rpc-request",
        data: request,
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
        `[RouterClientTransport] Connecting to ${this.config.routerUrl}...`
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
        
        // Send connection request with target cardhost UUID
        const connectMessage: RouterMessage = {
          type: "connect",
          data: {
            cardhostUuid: this.config.cardhostUuid,
          },
        };
        
        this.ws!.send(JSON.stringify(connectMessage));
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: RouterMessage = JSON.parse(event.data);
          this.handleMessage(message, resolve);
        } catch (error) {
          console.error(
            "[RouterClientTransport] Message handling error:",
            error
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
    connectResolve: (value: void) => void
  ): void {
    switch (message.type) {
      case "connected": {
        console.log("[RouterClientTransport] Connected to router, cardhost:", this.config.cardhostUuid);
        this.connected = true;
        connectResolve();
        break;
      }

      case "error": {
        console.error("[RouterClientTransport] Router error:", message.data);
        break;
      }

      case "rpc-event": {
        // Event from cardhost
        const event: RpcEvent = message.data;
        for (const callback of this.eventCallbacks) {
          callback(event);
        }
        break;
      }

      case "rpc-response": {
        // Response to our request
        const response: RpcResponse = message.data;
        const pending = this.pendingCalls.get(response.id);

        if (pending) {
          this.pendingCalls.delete(response.id);
          pending.resolve(response);
        } else {
          console.warn(
            "[RouterClientTransport] Received response for unknown request:",
            response.id
          );
        }
        break;
      }

      default:
        console.warn(
          "[RouterClientTransport] Unknown message type:",
          message.type
        );
    }
  }
}
