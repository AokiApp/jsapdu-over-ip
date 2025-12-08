/**
 * Simple WebSocket-based ClientTransport for Node.js CLI
 * 
 * Implements the ClientTransport interface for jsapdu-over-ip
 * using the ws library for WebSocket connections.
 */

import type {
  ClientTransport,
  RpcRequest,
  RpcResponse,
  RpcEvent,
} from "@aokiapp/jsapdu-over-ip";
import WebSocket from "ws";

export class SimpleClientTransport implements ClientTransport {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingCalls: Map<
    string,
    {
      resolve: (response: RpcResponse) => void;
      reject: (error: Error) => void;
    }
  > = new Map();
  private eventCallbacks: Set<(event: RpcEvent) => void> = new Set();

  constructor(private url: string) {}

  async call(request: RpcRequest): Promise<RpcResponse> {
    if (!this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(request.id, { resolve, reject });
      this.ws!.send(JSON.stringify({ type: "rpc-request", data: request }));
    });
  }

  onEvent(callback: (event: RpcEvent) => void): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        this.connected = true;
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === "rpc-response") {
            const response = message.data as RpcResponse;
            const pending = this.pendingCalls.get(response.id);
            if (pending) {
              this.pendingCalls.delete(response.id);
              if (response.error) {
                pending.reject(new Error(response.error.message));
              } else {
                pending.resolve(response);
              }
            }
          } else if (message.type === "rpc-event") {
            const event = message.data as RpcEvent;
            this.eventCallbacks.forEach(cb => cb(event));
          }
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      });

      this.ws.on("error", reject);
      this.ws.on("close", () => {
        this.connected = false;
      });
    });
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
