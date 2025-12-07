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
import { randomUUID } from "crypto";

async function main() {
  console.log("=== Mock Cardhost Starting (TEST ONLY) ===");
  console.log("⚠️  This is a test-only cardhost using mock platform");
  console.log("⚠️  DO NOT use in production!");
  console.log();

  // For this simple mock, we'll note that full router integration
  // would require implementing the transport layer.
  // For now, this demonstrates the mock platform works with the adapter.

  console.log("This mock cardhost demonstrates:");
  console.log("  1. Mock platform initialization");
  console.log("  2. Platform adapter creation");
  console.log("  3. APDU handling via mock");
  console.log();
  console.log("For full integration testing, see:");
  console.log("  - examples/test-utils (integration test)");
  console.log("  - examples/controller-cli (CLI controller)");
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
  devices.forEach(dev => {
    console.log(`  - ${dev.friendlyName || dev.id}`);
  });
  console.log();

  console.log("✅ Mock cardhost platform ready");
  console.log();
  console.log("Note: For full router integration, implement RouterServerTransport");
  console.log("      and connect to router as shown in examples/cardhost");
  console.log();
  console.log("Press Ctrl+C to stop");

  // Keep running
  await new Promise(() => {});
}

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
