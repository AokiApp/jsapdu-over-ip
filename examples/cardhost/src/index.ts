/**
 * Cardhost Main Entry Point
 * Uses SmartCardPlatformAdapter from jsapdu-over-ip library
 * 
 * Can be used in two modes:
 * 1. Standalone mode: Run as a process (node dist/index.js)
 * 2. Library mode: Import startCardhost() for testing/embedding
 */

import { SmartCardPlatformAdapter } from "@aokiapp/jsapdu-over-ip/server";
import { RouterServerTransport } from "./router-transport.js";
import { loadConfig, saveConfig, type CardhostConfig } from "./config.js";
import { generateKeyPair, exportPublicKey, exportPrivateKey, importPublicKey, importPrivateKey } from "./crypto.js";
import { getPlatform } from "./platform.js";
import { startMonitor } from "./monitor/index.js";
import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";

export interface CardhostOptions {
  routerUrl: string;
  uuid: string;
  platform?: SmartCardPlatform; // Optional: provide custom platform (for testing)
  keyPair?: { publicKey: unknown; privateKey: unknown }; // Optional: provide keys (CryptoKey)
  monitorPort?: number;
}

export interface CardhostInstance {
  adapter: SmartCardPlatformAdapter;
  transport: RouterServerTransport;
  platform: SmartCardPlatform;
  stop: () => Promise<void>;
}

/**
 * Start cardhost in library mode
 * Useful for testing and embedding in other applications
 */
export async function startCardhost(options: CardhostOptions): Promise<CardhostInstance> {
  console.log("=== Cardhost Starting (Library Mode) ===");
  console.log(`Cardhost UUID: ${options.uuid}`);
  console.log(`Router URL: ${options.routerUrl}`);

  // Use provided platform or get from getPlatform()
  const platform = options.platform || await getPlatform();
  if (!options.platform) {
    console.log("Initializing smart card platform...");
    await platform.init();
  } else {
    console.log("Using provided platform (e.g., for testing)");
  }

  // Use provided keys or generate new ones
  let keyPair = options.keyPair;
  if (!keyPair) {
    console.log("Generating new key pair for this session...");
    keyPair = await generateKeyPair();
  }

  // Create router transport
  console.log("Creating router transport...");
  const transport = new RouterServerTransport({
    routerUrl: options.routerUrl,
    uuid: options.uuid,
    publicKey: keyPair.publicKey as any,
    privateKey: keyPair.privateKey as any,
  });

  // Create adapter - LIBRARY HANDLES ALL RPC
  console.log("Creating SmartCardPlatformAdapter...");
  const adapter = new SmartCardPlatformAdapter(platform, transport);

  // Start adapter
  console.log("Starting adapter...");
  await adapter.start();
  console.log("✅ Cardhost is running - adapter handles all RPC!");

  // Start monitor (optional)
  if (options.monitorPort) {
    console.log(`Starting monitor on port ${options.monitorPort}...`);
    await startMonitor(options.monitorPort, options.uuid);
    console.log(`✅ Monitor available at http://localhost:${options.monitorPort}`);
  }

  // Return instance for programmatic control
  return {
    adapter,
    transport,
    platform,
    stop: async () => {
      console.log("Stopping cardhost...");
      await adapter.stop();
      if (!options.platform) {
        // Only release platform if we created it
        await platform.release();
      }
      console.log("✅ Cardhost stopped");
    }
  };
}

/**
 * Standalone mode - run as a process
 */
async function main() {
  console.log("=== Cardhost Starting (Standalone Mode) ===");

  // Load configuration
  const config: CardhostConfig = await loadConfig();
  console.log(`Cardhost UUID: ${config.uuid}`);
  console.log(`Router URL: ${config.routerUrl}`);

  // Load or generate keys
  let keyPair;
  if (config.publicKey && config.privateKey) {
    console.log("Loading existing key pair from config...");
    keyPair = {
      publicKey: await importPublicKey(config.publicKey),
      privateKey: await importPrivateKey(config.privateKey),
    };
  } else {
    console.log("Generating new key pair...");
    keyPair = await generateKeyPair();
    const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
    const privateKeyB64 = await exportPrivateKey(keyPair.privateKey);
    config.publicKey = publicKeyB64;
    config.privateKey = privateKeyB64;
    await saveConfig(config);
    console.log("Key pair generated and stored in config");
  }

  // Start cardhost using library mode
  const instance = await startCardhost({
    routerUrl: config.routerUrl,
    uuid: config.uuid,
    keyPair,
    monitorPort: config.monitorPort,
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n=== Cardhost Shutting Down ===");
    try {
      await instance.stop();
      console.log("✅ Shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => { void shutdown(); });
  process.on("SIGTERM", () => { void shutdown(); });
}

// Only run main() if this is the entry point (not imported as library)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
