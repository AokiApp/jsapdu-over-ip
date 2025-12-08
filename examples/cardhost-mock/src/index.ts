/**
 * Mock Cardhost for Testing
 * 
 * This is a test-only version of cardhost that uses mock platform.
 * DO NOT use this in production! Use examples/cardhost for production.
 * 
 * This cardhost is specifically for:
 * - Integration testing
 * - CI/CD pipelines
 * - Development without PC/SC hardware
 */

import { SmartCardPlatformAdapter } from "@aokiapp/jsapdu-over-ip/server";
import { MockSmartCardPlatform } from "@aokiapp/jsapdu-over-ip-examples-test-utils";
import { RouterServerTransport, type RouterServerTransportConfig } from "./router-transport.js";
import { randomUUID } from "crypto";
import { getOrCreateKeyPair, getKeyFingerprint } from "./key-manager.js";
import { join } from "path";
import { homedir } from "os";

async function main() {
  console.log("=== Mock Cardhost Starting (TEST ONLY) ===");
  console.log("⚠️  This is a test-only cardhost using mock platform");
  console.log("⚠️  DO NOT use in production!");
  console.log();

  // Get config from environment or use defaults
  const routerUrl = process.env.ROUTER_URL || 'ws://localhost:8080/ws/cardhost';
  const uuid = process.env.CARDHOST_UUID || `mock-cardhost-${randomUUID()}`;
  
  // Key path: use XDG_CONFIG_HOME or ~/.config
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  const keyPath = process.env.CARDHOST_KEY_PATH || join(configDir, 'jsapdu-cardhost-mock', 'keys', 'cardhost');

  console.log(`Router URL: ${routerUrl}`);
  console.log(`Cardhost UUID: ${uuid}`);
  console.log(`Key path: ${keyPath}`);
  console.log();

  // Get or create persistent key pair (per Issue #2 requirement)
  console.log("Loading persistent key pair...");
  const keyPair = await getOrCreateKeyPair(keyPath);
  const fingerprint = await getKeyFingerprint(keyPair.publicKey);
  console.log(`✅ Key pair loaded (fingerprint: ${fingerprint})`);
  console.log();

  // Initialize mock platform (test only!)
  console.log("Initializing mock platform...");
  const platform = MockSmartCardPlatform.getInstance();
  await platform.init();
  console.log("✅ Mock platform initialized");
  console.log();

  // List devices
  const devices = await platform.getDeviceInfo();
  console.log(`Found ${devices.length} device(s):`);
  devices.forEach((dev: { friendlyName?: string; id: string }) => {
    console.log(`  - ${dev.friendlyName ?? dev.id}`);
  });
  console.log();

  // Create router transport
  console.log("Creating router transport...");
  const transportConfig: RouterServerTransportConfig = {
    routerUrl,
    uuid,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
  const transport = new RouterServerTransport(transportConfig);
  console.log("✅ Router transport created");
  console.log();

  // Create adapter - LIBRARY HANDLES ALL RPC
  console.log("Creating SmartCardPlatformAdapter...");
  const adapter = new SmartCardPlatformAdapter(platform, transport);
  console.log("✅ Adapter created");
  console.log();

  // Start adapter
  console.log("Starting adapter...");
  await adapter.start();
  console.log("✅ Mock Cardhost is running - connected to router!");
  console.log();
  console.log("Mock cardhost is ready to receive APDU commands from CLI controller");
  console.log("Press Ctrl+C to stop");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n=== Mock Cardhost Shutting Down ===");
    
    // Stop adapter first
    try {
      await adapter.stop();
      console.log("✅ Adapter stopped");
    } catch (error) {
      console.error("❌ Adapter stop error:", error);
    }
    
    // Release platform
    try {
      await platform.release();
      console.log("✅ Platform released");
    } catch (error) {
      console.error("❌ Platform release error:", error);
    }
    
    console.log("✅ Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => { void shutdown(); });
  process.on("SIGTERM", () => { void shutdown(); });
}

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
