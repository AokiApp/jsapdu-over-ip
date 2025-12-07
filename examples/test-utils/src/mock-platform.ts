/**
 * Mock SmartCard Platform for Testing
 * 
 * This mock implementation allows testing without physical hardware.
 * It simulates a simple card that responds to basic APDU commands.
 */

import {
  SmartCardPlatform,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCard,
  EmulatedCard,
  SmartCardError,
} from "@aokiapp/jsapdu-interface";
import { CommandApdu, ResponseApdu } from "@aokiapp/jsapdu-interface";

/**
 * Mock platform that simulates a single card reader
 */
export class MockSmartCardPlatform extends SmartCardPlatform {
  private devices: Map<string, MockSmartCardDevice> = new Map();

  constructor() {
    super();
  }

  public static getInstance(): MockSmartCardPlatform {
    return new MockSmartCardPlatform();
  }

  public async init(force?: boolean): Promise<void> {
    if (!force) {
      this.assertNotInitialized();
    }
    
    // Set initialized first
    this.initialized = true;
    
    // Create a mock device
    const device = new MockSmartCardDevice(this, "mock-reader-0");
    this.devices.set(device.getDeviceInfo().id, device);
    
    console.log("✓ Mock platform initialized with 1 device");
  }

  public async release(force?: boolean): Promise<void> {
    if (!force) {
      this.assertInitialized();
    }
    
    // Release all devices
    for (const device of this.devices.values()) {
      await device.release();
    }
    this.devices.clear();
    
    this.initialized = false;
    console.log("✓ Mock platform released");
  }

  public async getDeviceInfo(): Promise<SmartCardDeviceInfo[]> {
    this.assertInitialized();
    return Array.from(this.devices.values()).map(d => d.getDeviceInfo());
  }

  public async acquireDevice(id: string): Promise<SmartCardDevice> {
    this.assertInitialized();
    
    if (!id || typeof id !== 'string') {
      throw new SmartCardError("INVALID_PARAMETER", "Device ID must be a non-empty string");
    }
    
    const device = this.devices.get(id);
    if (!device) {
      throw new SmartCardError("READER_ERROR", `Device ${id} not found`);
    }
    
    return device;
  }
}

/**
 * Mock device info
 */
class MockDeviceInfo extends SmartCardDeviceInfo {
  constructor(public readonly id: string) {
    super();
  }

  public readonly devicePath = "/dev/mock-reader";
  public readonly friendlyName = "Mock Smart Card Reader";
  public readonly description = "Virtual smart card reader for testing";
  public readonly supportsApdu = true;
  public readonly supportsHce = false;
  public readonly isIntegratedDevice = false;
  public readonly isRemovableDevice = true;
  public readonly d2cProtocol = "iso7816" as const;
  public readonly p2dProtocol = "usb" as const;
  public readonly apduApi = ["mock"];
  public readonly antennaInfo = undefined;
}

/**
 * Mock device that simulates card presence and sessions
 */
class MockSmartCardDevice extends SmartCardDevice {
  private deviceInfo: MockDeviceInfo;
  private sessionActive = false;
  private cardPresent = true; // Start with card present

  constructor(platform: SmartCardPlatform, id: string) {
    super(platform);
    this.deviceInfo = new MockDeviceInfo(id);
  }

  public getDeviceInfo(): SmartCardDeviceInfo {
    return this.deviceInfo;
  }

  public isSessionActive(): boolean {
    return this.sessionActive;
  }

  public async isDeviceAvailable(): Promise<boolean> {
    return true;
  }

  public async isCardPresent(): Promise<boolean> {
    return this.cardPresent;
  }

  public async startSession(): Promise<SmartCard> {
    if (this.sessionActive) {
      throw new SmartCardError("ALREADY_CONNECTED", "Session already active");
    }
    
    if (!this.cardPresent) {
      throw new SmartCardError("CARD_NOT_PRESENT", "Card not present");
    }

    this.sessionActive = true;
    const mockCard = new MockSmartCard(this);
    this.card = mockCard;
    console.log("✓ Mock card session started");
    return mockCard;
  }

  public async waitForCardPresence(timeout: number): Promise<void> {
    if (this.cardPresent) {
      return;
    }
    
    // Simulate waiting
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!this.cardPresent) {
      throw new SmartCardError("TIMEOUT", "Card not present after timeout");
    }
  }

  public async startHceSession(): Promise<EmulatedCard> {
    throw new SmartCardError("UNSUPPORTED_OPERATION", "HCE not supported on mock device");
  }

  public async release(): Promise<void> {
    if (this.card) {
      await this.card.release();
      this.card = null;
    }
    this.sessionActive = false;
    console.log("✓ Mock device released");
  }
}

/**
 * Mock smart card that responds to basic APDUs
 */
class MockSmartCard extends SmartCard {
  private released = false;

  constructor(device: SmartCardDevice) {
    super(device);
  }

  public async getAtr(): Promise<Uint8Array> {
    this.assertNotReleased();
    // Return a realistic ATR (3B 9F 96 80 1F C7 80 31 A0 73 BE 21 13 67 43 20 07 18 00 00 01 A5)
    return new Uint8Array([
      0x3b, 0x9f, 0x96, 0x80, 0x1f, 0xc7, 0x80, 0x31,
      0xa0, 0x73, 0xbe, 0x21, 0x13, 0x67, 0x43, 0x20,
      0x07, 0x18, 0x00, 0x00, 0x01, 0xa5
    ]);
  }

  public async transmit(apdu: CommandApdu): Promise<ResponseApdu>;
  public async transmit(apdu: Uint8Array): Promise<Uint8Array>;
  public async transmit(apdu: CommandApdu | Uint8Array): Promise<ResponseApdu | Uint8Array> {
    this.assertNotReleased();
    
    let commandBytes: Uint8Array;
    let returnApdu = false;
    
    if (apdu instanceof CommandApdu) {
      commandBytes = apdu.toUint8Array();
      returnApdu = true;
    } else {
      commandBytes = apdu;
    }

    // Mock responses for common commands
    const response = this.mockApduResponse(commandBytes);
    
    if (returnApdu) {
      // Split response into data and status word
      const sw1 = response[response.length - 2];
      const sw2 = response[response.length - 1];
      const data = response.slice(0, response.length - 2);
      return new ResponseApdu(data, sw1, sw2);
    } else {
      return response;
    }
  }

  private mockApduResponse(command: Uint8Array): Uint8Array {
    // Log the command for debugging
    console.log(`📨 Mock card received APDU: ${Array.from(command).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    
    const cla = command[0];
    const ins = command[1];
    
    // SELECT command (00 A4 04 00)
    if (cla === 0x00 && ins === 0xa4) {
      console.log("📤 Mock card responding to SELECT");
      // Return success with FCI data
      return new Uint8Array([
        0x6f, 0x10, 0x84, 0x08, 0xa0, 0x00, 0x00, 0x00,
        0x03, 0x00, 0x00, 0x00, 0xa5, 0x04, 0x9f, 0x65,
        0x01, 0xff, 0x90, 0x00
      ]);
    }
    
    // GET DATA (00 CA)
    if (cla === 0x00 && ins === 0xca) {
      console.log("📤 Mock card responding to GET DATA");
      // Return some mock data
      return new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x90, 0x00]);
    }
    
    // READ BINARY (00 B0)
    if (cla === 0x00 && ins === 0xb0) {
      console.log("📤 Mock card responding to READ BINARY");
      // Return mock file data
      return new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f,
        0x72, 0x6c, 0x64, 0x21, 0x90, 0x00
      ]); // "Hello World!" + SW 9000
    }
    
    // Default: return success (9000)
    console.log("📤 Mock card responding with success");
    return new Uint8Array([0x90, 0x00]);
  }

  public async reset(): Promise<void> {
    this.assertNotReleased();
    console.log("✓ Mock card reset");
  }

  public async release(): Promise<void> {
    if (!this.released) {
      this.released = true;
      console.log("✓ Mock card session released");
    }
  }

  private assertNotReleased(): void {
    if (this.released) {
      throw new SmartCardError("NOT_CONNECTED", "Card session already released");
    }
  }
}
