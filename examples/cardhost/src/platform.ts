/**
 * Platform initialization for cardhost
 * Tries to use real PC/SC, falls back to mock if unavailable
 * Pattern based on readthecard implementation
 */

import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";
import { CommandApdu, ResponseApdu } from "@aokiapp/jsapdu-interface";

// Environment variable to force mock
const USE_MOCK =
  process.env.USE_MOCK_PLATFORM === "true" ||
  process.env.USE_MOCK_PLATFORM === "1";

/**
 * Simple mock platform for fallback when PC/SC is unavailable
 * This is only used when real hardware cannot be accessed
 */
class SimpleMockPlatform implements SmartCardPlatform {
  private initialized = false;
  private devices: Map<string, any> = new Map();

  async init(): Promise<void> {
    this.initialized = true;
    console.log("[SimpleMockPlatform] Initialized (fallback mode)");
  }

  async release(_force?: boolean): Promise<void> {
    this.initialized = false;
    this.devices.clear();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.release();
  }

  async getDeviceInfo(): Promise<any[]> {
    return [
      {
        id: "mock-reader-0",
        friendlyName: "Mock Card Reader",
        description: "Fallback mock reader (PC/SC not available)",
        supportsApdu: true,
        supportsHce: false,
        isIntegratedDevice: false,
        isRemovableDevice: true,
        d2cProtocol: "iso7816",
        p2dProtocol: "usb",
        apduApi: ["mock"],
      },
    ];
  }

  async acquireDevice(id: string): Promise<any> {
    if (!this.initialized) {
      throw new Error("Platform not initialized");
    }

    let device = this.devices.get(id);
    if (!device) {
      device = new MockDevice(id);
      this.devices.set(id, device);
    }

    return device;
  }

  on(_event: string, _cb: any): () => void {
    return () => {};
  }
}

class MockDevice {
  constructor(private id: string) {}

  getDeviceInfo() {
    return {
      id: this.id,
      friendlyName: "Mock Card Reader",
    };
  }

  async isDeviceAvailable(): Promise<boolean> {
    return true;
  }

  async isCardPresent(): Promise<boolean> {
    return true;
  }

  async startSession(): Promise<any> {
    return new MockCard();
  }

  async waitForCardPresence(_timeout: number): Promise<void> {
    // Mock: card is always present
  }

  async release(): Promise<void> {
    // No-op
  }

  on(_event: string, _cb: any): () => void {
    return () => {};
  }

  isSessionActive(): boolean {
    return false;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.release();
  }
}

class MockCard {
  private atr = new Uint8Array([
    0x3b, 0x8f, 0x80, 0x01, 0x80, 0x4f, 0x0c, 0xa0, 0x00, 0x00, 0x00, 0x63,
    0x50, 0x4b, 0x43, 0x53, 0x2d, 0x31, 0x35, 0x56,
  ]);

  async getAtr(): Promise<Uint8Array> {
    return this.atr;
  }

  async transmit(command: CommandApdu | Uint8Array): Promise<ResponseApdu | Uint8Array> {
    // Simple echo with success status
    let isRawMode = command instanceof Uint8Array;
    
    const sw1 = 0x90;
    const sw2 = 0x00;
    const data = new Uint8Array(0);

    if (isRawMode) {
      const result = new Uint8Array(data.length + 2);
      result.set(data);
      result[data.length] = sw1;
      result[data.length + 1] = sw2;
      return result;
    }

    const dataCasted = new Uint8Array(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    ) as Uint8Array<ArrayBuffer>;
    return new ResponseApdu(dataCasted, sw1, sw2);
  }

  async reset(): Promise<void> {
    // No-op
  }

  async release(): Promise<void> {
    // No-op
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.release();
  }

  on(_event: string, _cb: any): () => void {
    return () => {};
  }
}

/**
 * Get platform instance - tries PC/SC first, falls back to mock
 */
export async function getPlatform(): Promise<SmartCardPlatform> {
  if (USE_MOCK) {
    console.log("Using mock platform (forced by USE_MOCK_PLATFORM)");
    return new SimpleMockPlatform();
  }

  // Try to load real PC/SC platform
  try {
    const { PcscPlatformManager } = await import("@aokiapp/jsapdu-pcsc");
    const platformManager = PcscPlatformManager.getInstance();
    const platform = platformManager.getPlatform();
    console.log("Using real PC/SC platform");
    return platform;
  } catch (error) {
    console.warn(
      "PC/SC platform not available, falling back to mock:",
      error
    );
    return new SimpleMockPlatform();
  }
}
