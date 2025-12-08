/**
 * Platform initialization for cardhost
 * This is for production use - requires real PC/SC hardware
 * 
 * For E2E testing, tests inject a temporary mock into this file
 */

import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";

/**
 * Get PC/SC platform instance
 * This is for production - it requires real PC/SC hardware and drivers
 * 
 * DO NOT use mock platform in production!
 * Mock platform is for testing only and should never be used in production cardhost.
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
    console.log("✅ Using PC/SC platform (production)");
    return platform;
  } catch (error) {
    console.error(
      "\n❌ PC/SC platform not available\n" +
      "\nThis cardhost requires real PC/SC hardware for production use:\n" +
      "  - PC/SC middleware installed (pcscd on Linux, built-in on macOS/Windows)\n" +
      "  - A smart card reader connected\n" +
      "  - @aokiapp/jsapdu-pcsc package installed\n" +
      "\n⚠️  DO NOT use mock platform in production!\n" +
      "   Mock platform is for testing only.\n" +
      "   See examples/test-utils for test setup.\n" +
      "\nError details:",
      error
    );
    throw new Error("PC/SC platform required for production cardhost");
  }
}
