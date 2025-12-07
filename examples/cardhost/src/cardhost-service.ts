/**
 * Cardhost Service
 *
 * Main service that:
 * - Manages jsapdu platform (PC/SC or mock)
 * - Handles RPC requests from controllers via router
 * - Sends card events to router
 */

import type {
  RequestMessage,
  ResponseMessage,
  RpcErrorCode,
} from '@aokiapp/jsapdu-over-ip-examples-shared';
import type {
  MockSmartCardPlatform,
  SmartCardReader,
} from './mock-platform.js';

export interface CardhostServiceConfig {
  platform: MockSmartCardPlatform;
  onEvent?: (event: string, data: unknown) => void;
}

export class CardhostService {
  private platform: MockSmartCardPlatform;
  private onEvent?: (event: string, data: unknown) => void;
  private activeReaders: Map<string, unknown> = new Map();

  constructor(config: CardhostServiceConfig) {
    this.platform = config.platform;
    this.onEvent = config.onEvent;
  }

  /**
   * Initialize the cardhost service
   */
  public async initialize(): Promise<void> {
    await this.platform.init();
    console.log('Cardhost service initialized');

    // Start monitoring for card events
    this.startCardMonitoring();
  }

  /**
   * Handle RPC request from controller
   */
  public async handleRequest(
    request: RequestMessage
  ): Promise<ResponseMessage> {
    try {
      const result = await this.executeMethod(request.method, request.params);

      return {
        type: 'response',
        id: request.id,
        result,
      };
    } catch (error) {
      return {
        type: 'response',
        id: request.id,
        error: {
          code: this.getErrorCode(error),
          message: error instanceof Error ? error.message : String(error),
          data: error,
        },
      };
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.platform.cleanup();
    console.log('Cardhost service cleaned up');
  }

  /**
   * Execute a method call
   */
  private async executeMethod(
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    // Parse method name (e.g., "platform.getDeviceInfo" or "device.connect")
    const [scope, methodName] = method.split('.');

    switch (scope) {
      case 'platform':
        return await this.executePlatformMethod(methodName, params);
      case 'device':
        return await this.executeDeviceMethod(methodName, params);
      case 'card':
        return await this.executeCardMethod(methodName, params);
      default:
        throw new Error(`Unknown scope: ${scope}`);
    }
  }

  private async executePlatformMethod(
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    switch (method) {
      case 'init':
        return await this.platform.init();

      case 'getDeviceInfo':
        return await this.platform.getDeviceInfo();

      case 'selectReader': {
        const readerName = params[0] as string;
        const device = await this.platform.selectReader(readerName);
        // Store device reference for later use
        this.activeReaders.set(readerName, device);
        return { readerName };
      }

      default:
        throw new Error(`Unknown platform method: ${method}`);
    }
  }

  private async executeDeviceMethod(
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    const readerName = params[0] as string;
    const device = this.activeReaders.get(readerName);

    if (!device) {
      throw new Error(`Device not found: ${readerName}`);
    }

    // In a real implementation, we would call methods on the device object
    // For now, return mock data
    switch (method) {
      case 'connect':
        return { connected: true };

      case 'waitForCardPresent':
        return { cardPresent: true };

      case 'waitForCardAbsent':
        return { cardAbsent: true };

      default:
        throw new Error(`Unknown device method: ${method}`);
    }
  }

  private async executeCardMethod(
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    switch (method) {
      case 'transmit': {
        // APDU transmission
        const apdu = params[0] as number[];
        // In a real implementation, transmit to actual card
        // For now, return mock response
        return {
          response: [0x90, 0x00], // Success response
        };
      }

      case 'disconnect':
        return { disconnected: true };

      case 'getATR':
        return {
          atr: [
            0x3b, 0x8f, 0x80, 0x01, 0x80, 0x4f, 0x0c, 0xa0, 0x00, 0x00, 0x03,
            0x06,
          ],
        };

      default:
        throw new Error(`Unknown card method: ${method}`);
    }
  }

  private getErrorCode(error: unknown): number {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return -32000; // RpcErrorCode.CardhostNotFound
      }
      if (error.message.includes('timeout')) {
        return -32001; // RpcErrorCode.CardhostTimeout
      }
      if (error.message.includes('card') || error.message.includes('Card')) {
        return -32002; // RpcErrorCode.CardNotPresent
      }
    }
    return -32603; // RpcErrorCode.InternalError
  }

  /**
   * Monitor for card insertion/removal events
   */
  private async startCardMonitoring(): Promise<void> {
    // In a real implementation, this would use platform-specific event listeners
    // For now, we'll poll periodically in the mock
    setInterval(async () => {
      try {
        const readers = await this.platform.getDeviceInfo();
        // Check for card state changes and emit events
        // This is simplified - a real implementation would track state changes
      } catch (error) {
        console.error('Error monitoring cards:', error);
      }
    }, 2000);
  }

  /**
   * Emit an event to the router
   */
  private emitEvent(event: string, data: unknown): void {
    if (this.onEvent) {
      this.onEvent(event, data);
    }
  }
}
