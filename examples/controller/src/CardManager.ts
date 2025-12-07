/**
 * CardManager - Encapsulates platform logic and state management
 * Separates jsapdu-over-ip usage from React UI concerns
 */

import { RemoteSmartCardPlatform } from "@aokiapp/jsapdu-over-ip/client";
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import { RouterClientTransport } from "./router-transport";

export interface DeviceInfo {
  id: string;
  friendlyName?: string;
  description?: string;
}

export interface ConnectionConfig {
  routerUrl: string;
  cardhostUuid: string;
}

export interface ApduCommand {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: Uint8Array;
}

export interface ApduResponse {
  sw1: number;
  sw2: number;
  data: Uint8Array;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ManagerState {
  status: ConnectionStatus;
  error?: string;
  devices: DeviceInfo[];
}

export type StateListener = (state: ManagerState) => void;

/**
 * CardManager manages the connection to remote cardhost
 * and provides methods for card operations
 */
export class CardManager {
  private platform: RemoteSmartCardPlatform | null = null;
  private transport: RouterClientTransport | null = null;
  private state: ManagerState = {
    status: "disconnected",
    devices: [],
  };
  private listeners: Set<StateListener> = new Set();

  /**
   * Add a state change listener
   */
  addListener(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify of current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state
   */
  getState(): ManagerState {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<ManagerState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Connect to cardhost via router
   */
  async connect(config: ConnectionConfig): Promise<void> {
    if (this.state.status === "connected") {
      throw new Error("Already connected");
    }

    this.setState({ status: "connecting", error: undefined });

    try {
      // Create transport
      this.transport = new RouterClientTransport({
        routerUrl: config.routerUrl,
        cardhostUuid: config.cardhostUuid,
      });

      // Create remote platform
      this.platform = new RemoteSmartCardPlatform(this.transport);

      // Initialize
      await this.platform.init();

      // Load devices
      const devices = await this.platform.getDeviceInfo();

      this.setState({
        status: "connected",
        devices: devices as DeviceInfo[],
      });
    } catch (error) {
      this.setState({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      this.cleanup();
      throw error;
    }
  }

  /**
   * Disconnect from cardhost
   */
  async disconnect(): Promise<void> {
    this.cleanup();
    this.setState({
      status: "disconnected",
      devices: [],
      error: undefined,
    });
  }

  /**
   * Refresh device list
   */
  async refreshDevices(): Promise<void> {
    if (!this.platform || this.state.status !== "connected") {
      throw new Error("Not connected");
    }

    const devices = await this.platform.getDeviceInfo();
    this.setState({ devices: devices as DeviceInfo[] });
  }

  /**
   * Send APDU command to device
   */
  async sendApdu(
    deviceId: string,
    command: ApduCommand
  ): Promise<ApduResponse> {
    if (!this.platform || this.state.status !== "connected") {
      throw new Error("Not connected");
    }

    // Create CommandApdu
    const apdu = new CommandApdu(
      command.cla,
      command.ins,
      command.p1,
      command.p2,
      command.data || null,
      null
    );

    // Get device
    const device = await this.platform.acquireDevice(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    try {
      // Check card presence
      const isPresent = await device.isCardPresent();
      if (!isPresent) {
        await device.waitForCardPresence(5000);
      }

      // Start session
      const card = await device.startSession();

      try {
        // Transmit APDU
        const response = await card.transmit(apdu);

        return {
          sw1: response.sw1,
          sw2: response.sw2,
          data: response.data,
        };
      } finally {
        await card.release();
      }
    } finally {
      await device.release();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.status === "connected";
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.platform) {
      this.platform.release().catch(console.error);
      this.platform = null;
    }

    if (this.transport) {
      this.transport.close().catch(console.error);
      this.transport = null;
    }
  }
}
