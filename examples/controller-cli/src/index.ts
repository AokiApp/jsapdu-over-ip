#!/usr/bin/env node
/**
 * CLI Controller for jsapdu-over-ip
 * 
 * This provides a command-line interface for testing and AI interaction
 * with the jsapdu-over-ip system.
 */

import { RemoteSmartCardPlatform } from "@aokiapp/jsapdu-over-ip/client";
import { CommandApdu, type SmartCardDevice, type SmartCard } from "@aokiapp/jsapdu-interface";
import type {
  ClientTransport,
  RpcRequest,
  RpcResponse,
  RpcEvent,
} from "@aokiapp/jsapdu-over-ip";
import * as readline from "readline";
import WebSocket from "ws";

interface CLIConfig {
  routerUrl: string;
  cardhostUuid: string;
  sessionToken?: string;
}

/**
 * Simple ClientTransport for Node.js CLI
 */
class SimpleClientTransport implements ClientTransport {
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

class CLIController {
  private platform?: RemoteSmartCardPlatform;
  private transport?: SimpleClientTransport;
  private rl: readline.Interface;

  constructor(private config: CLIConfig) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
  }

  async start() {
    console.log("🚀 jsapdu-over-ip CLI Controller");
    console.log(`   Router: ${this.config.routerUrl}`);
    console.log(`   Cardhost: ${this.config.cardhostUuid}\n`);

    try {
      await this.connect();
      await this.repl();
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  }

  private async connect() {
    console.log("📡 Connecting to router...");
    
    this.transport = new SimpleClientTransport(this.config.routerUrl);
    this.platform = new RemoteSmartCardPlatform(this.transport);
    await this.platform.init();

    console.log("✅ Connected to remote platform\n");
  }

  private async repl() {
    console.log("Available commands:");
    console.log("  devices - List available devices");
    console.log("  select <deviceId> - Select a device");
    console.log("  apdu <hex> - Send APDU command (e.g., 00A4040000)");
    console.log("  atr - Get card ATR");
    console.log("  help - Show this help");
    console.log("  exit - Exit the CLI\n");

    let selectedDevice: SmartCardDevice | null = null;
    let cardSession: SmartCard | null = null;

    const prompt = () => {
      this.rl.question("> ", async (line) => {
        const input = line.trim();
        
        if (!input) {
          prompt();
          return;
        }

        const [cmd, ...args] = input.split(/\s+/);

        try {
          switch (cmd.toLowerCase()) {
            case "devices": {
              if (!this.platform) {
                console.log("❌ Not connected");
                break;
              }
              const devices = await this.platform.getDeviceInfo();
              console.log(`\n📱 Found ${devices.length} device(s):`);
              devices.forEach((dev, i) => {
                console.log(`  ${i}: ${dev.friendlyName || dev.id}`);
                console.log(`     ID: ${dev.id}`);
                console.log(`     Supports APDU: ${dev.supportsApdu}`);
              });
              console.log();
              break;
            }

            case "select": {
              if (!this.platform) {
                console.log("❌ Not connected");
                break;
              }
              if (args.length === 0) {
                console.log("❌ Usage: select <deviceId>");
                break;
              }
              
              const deviceId = args[0];
              console.log(`\n🔌 Acquiring device ${deviceId}...`);
              selectedDevice = await this.platform.acquireDevice(deviceId);
              console.log("✅ Device acquired");
              
              // Check if card is present
              const present = await selectedDevice.isCardPresent();
              console.log(`   Card present: ${present}`);
              
              if (present) {
                console.log("📇 Starting card session...");
                cardSession = await selectedDevice.startSession();
                console.log("✅ Card session started\n");
              } else {
                console.log("⚠️  No card present\n");
              }
              break;
            }

            case "atr": {
              if (!cardSession) {
                console.log("❌ No card session active. Use 'select' first.");
                break;
              }
              
              const atr = await cardSession.getAtr();
              const atrBytes = Array.from(atr as Uint8Array);
              console.log(`\n🎫 ATR: ${atrBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`);
              break;
            }

            case "apdu": {
              if (!cardSession) {
                console.log("❌ No card session active. Use 'select' first.");
                break;
              }
              
              if (args.length === 0) {
                console.log("❌ Usage: apdu <hex> (e.g., 00A4040000)");
                break;
              }

              const hexStr = args.join("").replace(/\s+/g, "");
              if (!/^[0-9a-fA-F]+$/.test(hexStr) || hexStr.length < 8 || hexStr.length % 2 !== 0) {
                console.log("❌ Invalid APDU hex string (must be even length hex, at least 8 chars)");
                break;
              }

              // Parse hex string to bytes
              const matches = hexStr.match(/.{1,2}/g);
              if (!matches) {
                console.log("❌ Failed to parse hex string");
                break;
              }
              const bytes = new Uint8Array(matches.map(b => parseInt(b, 16)));
              
              // Parse APDU components
              // Minimum: CLA INS P1 P2 (4 bytes)
              const cla = bytes[0];
              const ins = bytes[1];
              const p1 = bytes[2];
              const p2 = bytes[3];
              
              // Determine APDU case based on remaining bytes
              let data: Uint8Array | null = null;
              let le: number | null = null;
              
              if (bytes.length === 4) {
                // Case 1: No Lc, no Le
                data = null;
                le = null;
              } else if (bytes.length === 5) {
                // Case 2: Le only (expecting response)
                le = bytes[4];
                data = null;
              } else {
                // Case 3 or 4: Lc + data (+ optional Le)
                const lc = bytes[4];
                if (bytes.length >= 5 + lc) {
                  data = bytes.slice(5, 5 + lc);
                  if (bytes.length > 5 + lc) {
                    // Case 4: Has Le after data
                    le = bytes[5 + lc];
                  }
                } else {
                  console.log("❌ Invalid APDU: Lc doesn't match data length");
                  break;
                }
              }

              const apdu = new CommandApdu(cla, ins, p1, p2, data as Uint8Array<ArrayBuffer> | null, le);
              
              console.log(`\n📤 Sending APDU: ${hexStr}`);
              console.log(`   CLA: 0x${cla.toString(16).padStart(2, '0')}`);
              console.log(`   INS: 0x${ins.toString(16).padStart(2, '0')}`);
              console.log(`   P1:  0x${p1.toString(16).padStart(2, '0')}`);
              console.log(`   P2:  0x${p2.toString(16).padStart(2, '0')}`);
              if (data && data.length > 0) {
                const dataBytes = Array.from(data);
                console.log(`   Data: ${dataBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
              }
              
              const response = await cardSession.transmit(apdu);
              
              console.log(`\n📥 Response:`);
              if (response.data.length > 0) {
                const responseBytes = Array.from(response.data) as number[];
                console.log(`   Data: ${responseBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
              }
              console.log(`   SW:   ${response.sw1.toString(16).padStart(2, '0')} ${response.sw2.toString(16).padStart(2, '0')}`);
              console.log(`   Status: ${response.sw1 === 0x90 && response.sw2 === 0x00 ? '✅ Success' : '⚠️  Error'}\n`);
              break;
            }

            case "help": {
              console.log("\nAvailable commands:");
              console.log("  devices - List available devices");
              console.log("  select <deviceId> - Select a device");
              console.log("  apdu <hex> - Send APDU command (e.g., 00A4040000)");
              console.log("  atr - Get card ATR");
              console.log("  help - Show this help");
              console.log("  exit - Exit the CLI\n");
              break;
            }

            case "exit":
            case "quit": {
              console.log("\n👋 Goodbye!");
              if (cardSession) {
                await cardSession.release();
              }
              if (selectedDevice) {
                await selectedDevice.release();
              }
              if (this.platform) {
                await this.platform.release();
              }
              if (this.transport) {
                await this.transport.close();
              }
              this.rl.close();
              process.exit(0);
              return;
            }

            default: {
              console.log(`❌ Unknown command: ${cmd}`);
              console.log("   Type 'help' for available commands\n");
              break;
            }
          }
        } catch (error) {
          const err = error as Error;
          console.error(`❌ Error: ${err.message}\n`);
        }

        prompt();
      });
    };

    prompt();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: controller-cli <routerUrl> <cardhostUuid> [sessionToken]");
  console.error("");
  console.error("Example:");
  console.error("  controller-cli ws://localhost:8080/ws/controller abc-123-def");
  process.exit(1);
}

const config: CLIConfig = {
  routerUrl: args[0],
  cardhostUuid: args[1],
  sessionToken: args[2]
};

const cli = new CLIController(config);
cli.start().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
