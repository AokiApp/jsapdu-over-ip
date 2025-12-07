/**
 * Mock SmartCard Platform for testing without hardware
 *
 * Implements the jsapdu-interface for simulation purposes
 */

export interface SmartCardReader {
  name: string;
  hasCard: boolean;
}

export interface MockSmartCardPlatform {
  init(): Promise<void>;
  getDeviceInfo(): Promise<SmartCardReader[]>;
  selectReader(readerName: string): Promise<MockSmartCardDevice>;
  cleanup(): Promise<void>;
}

export interface MockSmartCardDevice {
  getReaderName(): string;
  connect(): Promise<MockSmartCard>;
  waitForCardPresent(timeout?: number): Promise<void>;
  waitForCardAbsent(timeout?: number): Promise<void>;
}

export interface MockSmartCard {
  transmit(apdu: Uint8Array): Promise<Uint8Array>;
  disconnect(): Promise<void>;
  getATR(): Uint8Array;
}

/**
 * Mock platform implementation
 */
export class MockPlatform implements MockSmartCardPlatform {
  private readers: Map<string, MockReader> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Simulate readers
    this.readers.set('Mock Reader 0', new MockReader('Mock Reader 0', true));
    this.readers.set('Mock Reader 1', new MockReader('Mock Reader 1', false));

    this.initialized = true;
    console.log('Mock platform initialized with 2 readers');
  }

  async getDeviceInfo(): Promise<SmartCardReader[]> {
    if (!this.initialized) {
      throw new Error('Platform not initialized');
    }

    return Array.from(this.readers.values()).map((reader) => ({
      name: reader.getReaderName(),
      hasCard: reader.hasCard,
    }));
  }

  async selectReader(readerName: string): Promise<MockSmartCardDevice> {
    const reader = this.readers.get(readerName);
    if (!reader) {
      throw new Error(`Reader not found: ${readerName}`);
    }
    return reader;
  }

  async cleanup(): Promise<void> {
    this.readers.clear();
    this.initialized = false;
    console.log('Mock platform cleaned up');
  }

  /**
   * Simulate card insertion for testing
   */
  public insertCard(readerName: string): void {
    const reader = this.readers.get(readerName);
    if (reader) {
      reader.insertCard();
    }
  }

  /**
   * Simulate card removal for testing
   */
  public removeCard(readerName: string): void {
    const reader = this.readers.get(readerName);
    if (reader) {
      reader.removeCard();
    }
  }
}

class MockReader implements MockSmartCardDevice {
  public hasCard: boolean;
  private card: MockCard | null = null;

  constructor(
    private name: string,
    initialCardPresent: boolean = false
  ) {
    this.hasCard = initialCardPresent;
    if (initialCardPresent) {
      this.card = new MockCard();
    }
  }

  getReaderName(): string {
    return this.name;
  }

  async connect(): Promise<MockSmartCard> {
    if (!this.hasCard || !this.card) {
      throw new Error('No card present');
    }
    return this.card;
  }

  async waitForCardPresent(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    while (!this.hasCard) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for card');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async waitForCardAbsent(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    while (this.hasCard) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for card removal');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  public insertCard(): void {
    if (!this.hasCard) {
      this.hasCard = true;
      this.card = new MockCard();
      console.log(`Card inserted into ${this.name}`);
    }
  }

  public removeCard(): void {
    if (this.hasCard) {
      this.hasCard = false;
      this.card = null;
      console.log(`Card removed from ${this.name}`);
    }
  }
}

class MockCard implements MockSmartCard {
  private atr: Uint8Array;

  constructor() {
    // Mock ATR (Answer To Reset) - simulating a generic card
    this.atr = new Uint8Array([
      0x3b, 0x8f, 0x80, 0x01, 0x80, 0x4f, 0x0c, 0xa0, 0x00, 0x00, 0x03, 0x06,
      0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x6a,
    ]);
  }

  getATR(): Uint8Array {
    return this.atr;
  }

  async transmit(apdu: Uint8Array): Promise<Uint8Array> {
    // Mock APDU responses

    // SELECT command (00 A4 ...)
    if (apdu.length >= 2 && apdu[0] === 0x00 && apdu[1] === 0xa4) {
      // Return success (90 00)
      return new Uint8Array([0x90, 0x00]);
    }

    // GET DATA command (00 CA ...)
    if (apdu.length >= 2 && apdu[0] === 0x00 && apdu[1] === 0xca) {
      // Return mock data with success
      return new Uint8Array([
        0x01,
        0x02,
        0x03,
        0x04, // Mock data
        0x90,
        0x00, // Success
      ]);
    }

    // READ BINARY (00 B0 ...)
    if (apdu.length >= 2 && apdu[0] === 0x00 && apdu[1] === 0xb0) {
      // Return mock data
      const data = new Array(16).fill(0).map((_, i) => i);
      return new Uint8Array([...data, 0x90, 0x00]);
    }

    // Default: command not supported
    return new Uint8Array([0x6d, 0x00]);
  }

  async disconnect(): Promise<void> {
    console.log('Mock card disconnected');
  }
}

/**
 * Create a mock platform instance
 */
export function createMockPlatform(): MockSmartCardPlatform {
  return new MockPlatform();
}
