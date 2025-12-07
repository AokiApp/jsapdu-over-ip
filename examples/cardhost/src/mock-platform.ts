/**
 * Mock SmartCardPlatform for testing
 * Based on readthecard's mock implementation but simplified for examples
 */

import { CommandApdu, ResponseApdu } from "@aokiapp/jsapdu-interface";

/**
 * Mock SmartCardDeviceInfo
 */
class MockSmartCardDeviceInfo {
  readonly id: string;
  readonly devicePath?: string;
  readonly friendlyName?: string;
  readonly description?: string;
  readonly supportsApdu: boolean;
  readonly supportsHce: boolean;
  readonly isIntegratedDevice: boolean;
  readonly isRemovableDevice: boolean;
  readonly d2cProtocol: "iso7816" | "nfc" | "integrated" | "other" | "unknown";
  readonly p2dProtocol:
    | "usb"
    | "ble"
    | "nfc"
    | "integrated"
    | "other"
    | "unknown";
  readonly apduApi: string[];

  constructor(id: string) {
    this.id = id;
    this.friendlyName = `Mock Card Reader ${id}`;
    this.description = "Mock Smart Card Reader for Testing";
    this.supportsApdu = true;
    this.supportsHce = false;
    this.isIntegratedDevice = false;
    this.isRemovableDevice = true;
    this.d2cProtocol = "iso7816";
    this.p2dProtocol = "usb";
    this.apduApi = ["mock"];
  }
}

/**
 * Mock SmartCard
 */
class MockSmartCard {
  private parentDevice: MockSmartCardDevice;
  private atr = new Uint8Array([
    0x3b, 0x8f, 0x80, 0x01, 0x80, 0x4f, 0x0c, 0xa0, 0x00, 0x00, 0x00, 0x63,
    0x50, 0x4b, 0x43, 0x53, 0x2d, 0x31, 0x35, 0x56,
  ]);

  constructor(parentDevice: MockSmartCardDevice) {
    this.parentDevice = parentDevice;
  }

  async getAtr(): Promise<Uint8Array> {
    return this.atr;
  }

  async transmit(
    command: CommandApdu | Uint8Array,
  ): Promise<ResponseApdu | Uint8Array> {
    let cmd: CommandApdu;
    let isRawMode = false;

    if (command instanceof Uint8Array) {
      cmd = CommandApdu.fromUint8Array(
        new Uint8Array(
          command.buffer.slice(
            command.byteOffset,
            command.byteOffset + command.byteLength,
          ),
        ) as Uint8Array<ArrayBuffer>,
      );
      isRawMode = true;
    } else {
      cmd = command;
    }

    // Simple echo response for testing
    let sw1 = 0x90;
    let sw2 = 0x00;
    let responseData: Uint8Array = new Uint8Array(0);

    // SELECT FILE (A4)
    if (cmd.ins === 0xa4) {
      sw1 = 0x90;
      sw2 = 0x00;
    }
    // GET RESPONSE (C0)
    else if (cmd.ins === 0xc0) {
      sw1 = 0x90;
      sw2 = 0x00;
    }
    // READ BINARY (B0)
    else if (cmd.ins === 0xb0) {
      // Return some test data
      responseData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      sw1 = 0x90;
      sw2 = 0x00;
    }
    // Unknown command
    else {
      sw1 = 0x6d;
      sw2 = 0x00;
    }

    if (isRawMode) {
      const result = new Uint8Array(responseData.length + 2);
      result.set(responseData);
      result[responseData.length] = sw1;
      result[responseData.length + 1] = sw2;
      return result;
    }

    const responseDataCasted = new Uint8Array(
      responseData.buffer.slice(
        responseData.byteOffset,
        responseData.byteOffset + responseData.byteLength,
      ),
    ) as Uint8Array<ArrayBuffer>;
    return new ResponseApdu(responseDataCasted, sw1, sw2);
  }

  async reset(): Promise<void> {
    // Reset card state
  }

  async release(): Promise<void> {
    this.parentDevice.cardReleased();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.release();
  }

  on(_event: string, _cb: any): () => void {
    return () => {};
  }
}

/**
 * Mock SmartCardDevice
 */
class MockSmartCardDevice {
  private parentPlatform: MockSmartCardPlatform;
  private info: MockSmartCardDeviceInfo;
  private cardPresent = true;
  private card: MockSmartCard | null = null;
  private sessionActive = false;

  constructor(parentPlatform: MockSmartCardPlatform, id: string) {
    this.parentPlatform = parentPlatform;
    this.info = new MockSmartCardDeviceInfo(id);
  }

  getDeviceInfo(): MockSmartCardDeviceInfo {
    return this.info;
  }

  isSessionActive(): boolean {
    return this.sessionActive;
  }

  async isDeviceAvailable(): Promise<boolean> {
    return true;
  }

  async isCardPresent(): Promise<boolean> {
    return this.cardPresent;
  }

  async startSession(): Promise<MockSmartCard> {
    if (!this.cardPresent) {
      throw new Error("Card not present");
    }
    this.card = new MockSmartCard(this);
    this.sessionActive = true;
    return this.card;
  }

  async waitForCardPresence(_timeout: number): Promise<void> {
    this.cardPresent = true;
  }

  async release(): Promise<void> {
    if (this.card) {
      this.card = null;
    }
    this.sessionActive = false;
    this.parentPlatform.deviceReleased(this.info.id);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.release();
  }

  on(_event: string, _cb: any): () => void {
    return () => {};
  }

  cardReleased(): void {
    this.card = null;
    this.sessionActive = false;
  }
}

/**
 * Mock SmartCardPlatform
 */
export class MockSmartCardPlatform {
  private initialized = false;
  private devices: Map<string, MockSmartCardDevice> = new Map();
  private deviceInfos: MockSmartCardDeviceInfo[] = [
    new MockSmartCardDeviceInfo("mock-reader-0"),
  ];

  async init(): Promise<void> {
    this.initialized = true;
    console.log("[MockSmartCardPlatform] Initialized");
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

  async getDeviceInfo(): Promise<MockSmartCardDeviceInfo[]> {
    return this.deviceInfos;
  }

  async acquireDevice(id: string): Promise<MockSmartCardDevice> {
    if (!this.initialized) {
      throw new Error("Platform not initialized");
    }

    const info = this.deviceInfos.find((d) => d.id === id);
    if (!info) {
      throw new Error(`Device not found: ${id}`);
    }

    let device = this.devices.get(id);
    if (!device) {
      device = new MockSmartCardDevice(this, id);
      this.devices.set(id, device);
    }

    return device;
  }

  deviceReleased(id: string): void {
    this.devices.delete(id);
  }

  on(_event: string, _cb: any): () => void {
    return () => {};
  }
}

let mockPlatformInstance: MockSmartCardPlatform | null = null;

export function getMockPlatform(): MockSmartCardPlatform {
  if (!mockPlatformInstance) {
    mockPlatformInstance = new MockSmartCardPlatform();
  }
  return mockPlatformInstance;
}
