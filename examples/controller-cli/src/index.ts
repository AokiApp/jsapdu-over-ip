#!/usr/bin/env node
/**
 * CLI Controller for jsapdu-over-ip
 * 
 * This provides a command-line interface for testing and AI interaction
 * with the jsapdu-over-ip system.
 */

import { RemoteSmartCardPlatform } from "@aokiapp/jsapdu-over-ip/client";
import { type SmartCardDevice, type SmartCard } from "@aokiapp/jsapdu-interface";
import * as readline from "readline";
import { parseApduHex, formatApduForDisplay } from "./apdu-parser.js";
import { SimpleClientTransport } from "./transport.js";

interface CLIConfig {
  routerUrl: string;
  cardhostUuid: string;
  sessionToken?: string;
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
              const parseResult = parseApduHex(hexStr);
              
              if (!parseResult.success) {
                console.log(`❌ ${parseResult.error}`);
                break;
              }

              console.log(`\n📤 Sending APDU: ${hexStr}`);
              console.log(formatApduForDisplay(parseResult));
              
              const response = await cardSession.transmit(parseResult.apdu);
              
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
