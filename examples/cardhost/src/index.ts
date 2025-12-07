/**
 * Cardhost Main Entry Point
 * Uses SmartCardPlatformAdapter from jsapdu-over-ip library
 */

import { SmartCardPlatformAdapter } from "@aokiapp/jsapdu-over-ip/server";
import { RouterServerTransport } from "./router-transport.js";
import { loadConfig, saveConfig, type CardhostConfig } from "./config.js";
import { generateKeyPair, exportPublicKey, exportPrivateKey, importPublicKey, importPrivateKey } from "./crypto.js";
import { getPlatform } from "./platform.js";
import { startMonitor } from "./monitor/index.js";

async function main() {
  console.log("=== Cardhost Starting ===");

  // Load configuration
  let config: CardhostConfig = await loadConfig();
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

  // Get platform (tries PC/SC, falls back to mock)
  console.log("Initializing smart card platform...");
  const platform = await getPlatform();
  await platform.init();

  // Create router transport
  console.log("Creating router transport...");
  const transport = new RouterServerTransport({
    routerUrl: config.routerUrl,
    uuid: config.uuid,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  });

  // Create adapter - LIBRARY HANDLES ALL RPC
  console.log("Creating SmartCardPlatformAdapter...");
  const adapter = new SmartCardPlatformAdapter(platform, transport);

  // Start adapter
  console.log("Starting adapter...");
  await adapter.start();
  console.log("✅ Cardhost is running - adapter handles all RPC!");

  // Start monitor (optional)
  if (config.monitorPort) {
    console.log(`Starting monitor on port ${config.monitorPort}...`);
    await startMonitor(config.monitorPort, config.uuid);
    console.log(
      `✅ Monitor available at http://localhost:${config.monitorPort}`
    );
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n=== Cardhost Shutting Down ===");
    try {
      await adapter.stop();
      await platform.release();
      console.log("✅ Shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
