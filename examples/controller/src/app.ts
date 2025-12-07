/**
 * Controller Application
 * Uses RemoteSmartCardPlatform from jsapdu-over-ip library
 */

import { RemoteSmartCardPlatform } from "@aokiapp/jsapdu-over-ip/client";
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import { RouterClientTransport } from "./router-transport.js";

export interface ControllerConfig {
  routerUrl: string;
  cardhostUuid: string;
}

export interface ApduCommand {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: number[];
  le?: number;
}

export interface ApduResponse {
  sw1: number;
  sw2: number;
  data: number[];
}

/**
 * Controller application using jsapdu-over-ip library
 */
export class ControllerApp {
  private platform: RemoteSmartCardPlatform | null = null;
  private transport: RouterClientTransport | null = null;
  private config: ControllerConfig | null = null;

  /**
   * Connect to a cardhost via router
   */
  async connect(config: ControllerConfig): Promise<void> {
    this.config = config;

    // Create custom transport for router communication
    this.transport = new RouterClientTransport({
      routerUrl: config.routerUrl,
      cardhostUuid: config.cardhostUuid,
    });

    // Create RemoteSmartCardPlatform - LIBRARY HANDLES EVERYTHING
    this.platform = new RemoteSmartCardPlatform(this.transport);

    // Initialize platform
    await this.platform.init();

    console.log("[ControllerApp] Connected to cardhost:", config.cardhostUuid);
  }

  /**
   * Disconnect from cardhost
   */
  async disconnect(): Promise<void> {
    if (this.platform) {
      await this.platform.release();
      this.platform = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.config = null;
    console.log("[ControllerApp] Disconnected");
  }

  /**
   * Get list of available devices
   */
  async getDevices(): Promise<any[]> {
    if (!this.platform) {
      throw new Error("Not connected");
    }

    return await this.platform.getDeviceInfo();
  }

  /**
   * Send APDU command to card
   */
  async sendApdu(
    deviceId: string,
    command: ApduCommand,
  ): Promise<ApduResponse> {
    if (!this.platform) {
      throw new Error("Not connected");
    }

    // Get device
    const device = await this.platform.acquireDevice(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    // Wait for card if needed
    const isCardPresent = await device.isCardPresent();
    if (!isCardPresent) {
      await device.waitForCardPresence(5000);
    }

    // Start session
    const card = await device.startSession();

    try {
      // Create CommandApdu
      const data = command.data
        ? new Uint8Array(command.data)
        : new Uint8Array(0);
      const apdu = new CommandApdu(
        command.cla,
        command.ins,
        command.p1,
        command.p2,
        data.length > 0 ? data : null,
        command.le ?? null,
      );

      // Transmit APDU - LIBRARY HANDLES RPC TRANSPARENTLY
      const response = await card.transmit(apdu);

      return {
        sw1: response.sw1,
        sw2: response.sw2,
        data: Array.from(response.data),
      };
    } finally {
      // Release card
      await card.release();
      await device.release();
    }
  }

  /**
   * Get ATR from card
   */
  async getAtr(deviceId: string): Promise<number[]> {
    if (!this.platform) {
      throw new Error("Not connected");
    }

    const device = await this.platform.acquireDevice(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const isCardPresent = await device.isCardPresent();
    if (!isCardPresent) {
      await device.waitForCardPresence(5000);
    }

    const card = await device.startSession();

    try {
      const atr = await card.getAtr();
      return Array.from(atr);
    } finally {
      await card.release();
      await device.release();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.platform !== null && this.platform.isInitialized();
  }
}
