/**
 * Platform initialization for cardhost
 * Examples should demonstrate real PC/SC usage only
 */

import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";

/**
 * Get PC/SC platform instance
 * This is an example - it requires real PC/SC hardware and drivers
 */
export async function getPlatform(): Promise<SmartCardPlatform> {
  try {
    // Dynamic import to make it optional - using type assertion for modules that may not be installed
    const pcscModule = await import("@aokiapp/jsapdu-pcsc" as any).catch(() => null);
    if (!pcscModule) {
      throw new Error("@aokiapp/jsapdu-pcsc not installed");
    }
    const { PcscPlatformManager } = pcscModule;
    const platformManager = PcscPlatformManager.getInstance();
    const platform = platformManager.getPlatform();
    console.log("Using PC/SC platform");
    return platform;
  } catch (error) {
    console.error(
      "\n❌ PC/SC platform not available\n" +
      "\nThis example requires:\n" +
      "  - PC/SC middleware installed (pcscd on Linux, built-in on macOS/Windows)\n" +
      "  - A smart card reader connected\n" +
      "  - @aokiapp/jsapdu-pcsc package installed\n" +
      "\nFor development without hardware, consider:\n" +
      "  - Using InMemoryTransport for unit tests\n" +
      "  - Creating a separate mock example\n" +
      "\nError details:",
      error
    );
    throw new Error("PC/SC platform required for this example");
  }
}
