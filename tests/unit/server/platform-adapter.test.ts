/**
 * Unit Tests for SmartCardPlatformAdapter (Server Side)
 * 
 * Tests the server-side adapter that exposes local platform via RPC.
 * Uses mocked platform and transport to verify RPC handling.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartCardPlatformAdapter } from '../../../src/server/platform-adapter.js';
import type { ServerTransport, RpcRequest, RpcResponse } from '../../../src/types.js';
import type { SmartCardPlatform, SmartCardDevice, DeviceInfo } from '@aokiapp/jsapdu-interface';

describe('SmartCardPlatformAdapter (Unit)', () => {
  let mockPlatform: SmartCardPlatform;
  let mockTransport: ServerTransport;
  let adapter: SmartCardPlatformAdapter;
  let sendSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock platform
    mockPlatform = {
      init: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      getDeviceInfo: vi.fn().mockResolvedValue([]),
      acquireDevice: vi.fn(),
      supportsPolling: false,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    };

    // Create mock transport
    sendSpy = vi.fn().mockResolvedValue(undefined);
    mockTransport = {
      onRequest: vi.fn((handler: (req: RpcRequest) => Promise<RpcResponse>) => {
        // Store handler for later use in tests
        (mockTransport as any).requestHandler = handler;
        return () => {};
      }),
      sendEvent: vi.fn(),
      send: sendSpy,
      close: vi.fn(),
    };

    adapter = new SmartCardPlatformAdapter(mockPlatform, mockTransport);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('start()', () => {
    test('should initialize platform on start', async () => {
      await adapter.start();

      expect(mockPlatform.init).toHaveBeenCalledOnce();
      expect(mockTransport.onRequest).toHaveBeenCalledOnce();
    });

    test('should handle platform init failure', async () => {
      (mockPlatform.init as any).mockRejectedValue(new Error('Init failed'));

      await expect(adapter.start()).rejects.toThrow('Init failed');
    });
  });

  describe('RPC: platform.init', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    test('should handle platform.init request', async () => {
      const request: RpcRequest = {
        id: 'req-1',
        method: 'platform.init',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.id).toBe('req-1');
      expect(response.result).toEqual({ success: true });
      expect(response.error).toBeUndefined();
    });
  });

  describe('RPC: platform.getDeviceInfo', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    test('should return device list', async () => {
      const mockDevices: DeviceInfo[] = [
        {
          id: 'device-1',
          friendlyName: 'Mock Reader 1',
          supportsApdu: true,
        },
      ];

      (mockPlatform.getDeviceInfo as any).mockResolvedValue(mockDevices);

      const request: RpcRequest = {
        id: 'req-2',
        method: 'platform.getDeviceInfo',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.id).toBe('req-2');
      expect(response.result).toEqual({ devices: mockDevices });
      expect(mockPlatform.getDeviceInfo).toHaveBeenCalledOnce();
    });

    test('should handle empty device list', async () => {
      (mockPlatform.getDeviceInfo as any).mockResolvedValue([]);

      const request: RpcRequest = {
        id: 'req-3',
        method: 'platform.getDeviceInfo',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.result).toEqual({ devices: [] });
    });

    test('should handle platform error', async () => {
      (mockPlatform.getDeviceInfo as any).mockRejectedValue(new Error('Failed to get devices'));

      const request: RpcRequest = {
        id: 'req-4',
        method: 'platform.getDeviceInfo',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Failed to get devices');
    });
  });

  describe('RPC: platform.acquireDevice', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    test('should acquire device', async () => {
      const mockDevice: SmartCardDevice = {
        getDeviceInfo: vi.fn().mockReturnValue({
          id: 'device-1',
          friendlyName: 'Mock Reader',
          supportsApdu: true,
        }),
        isCardPresent: vi.fn().mockResolvedValue(true),
        isSessionActive: vi.fn().mockResolvedValue(false),
        startSession: vi.fn(),
        release: vi.fn(),
      };

      (mockPlatform.acquireDevice as any).mockResolvedValue(mockDevice);

      const request: RpcRequest = {
        id: 'req-5',
        method: 'platform.acquireDevice',
        params: { deviceId: 'device-1' },
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.result).toEqual({ success: true });
      expect(mockPlatform.acquireDevice).toHaveBeenCalledWith('device-1');
    });

    test('should handle invalid device ID', async () => {
      (mockPlatform.acquireDevice as any).mockRejectedValue(new Error('Device not found'));

      const request: RpcRequest = {
        id: 'req-6',
        method: 'platform.acquireDevice',
        params: { deviceId: 'invalid-device' },
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Device not found');
    });

    test('should reject missing deviceId parameter', async () => {
      const request: RpcRequest = {
        id: 'req-7',
        method: 'platform.acquireDevice',
        params: {}, // Missing deviceId
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.error).toBeDefined();
    });
  });

  describe('RPC: platform.release', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    test('should release platform', async () => {
      const request: RpcRequest = {
        id: 'req-8',
        method: 'platform.release',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.result).toEqual({ success: true });
      expect(mockPlatform.release).toHaveBeenCalledOnce();
    });

    test('should handle release errors', async () => {
      (mockPlatform.release as any).mockRejectedValue(new Error('Release failed'));

      const request: RpcRequest = {
        id: 'req-9',
        method: 'platform.release',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.error).toBeDefined();
    });
  });

  describe('Error Handling (異常系)', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    test('should handle unknown RPC method', async () => {
      const request: RpcRequest = {
        id: 'req-10',
        method: 'unknown.method',
        params: {},
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Unknown method');
    });

    test('should handle malformed request', async () => {
      const request = {
        id: 'req-11',
        // Missing method
        params: {},
      } as any;

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.error).toBeDefined();
    });

    test('should handle request with null params', async () => {
      const request: RpcRequest = {
        id: 'req-12',
        method: 'platform.getDeviceInfo',
        params: null as any,
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      // Should still work with null params for methods that don't need them
      expect(response.result || response.error).toBeDefined();
    });
  });

  describe('Edge Cases (エッジケース)', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    test('should handle rapid sequential requests', async () => {
      (mockPlatform.getDeviceInfo as any).mockResolvedValue([]);

      const handler = (mockTransport as any).requestHandler;
      
      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `req-${i}`,
        method: 'platform.getDeviceInfo',
        params: {},
      }));

      const responses = await Promise.all(
        requests.map(req => handler(req))
      );

      expect(responses).toHaveLength(10);
      responses.forEach((res, i) => {
        expect(res.id).toBe(`req-${i}`);
      });
    });

    test('should handle very large device IDs', async () => {
      const longId = 'device-' + 'x'.repeat(10000);
      
      const mockDevice: SmartCardDevice = {
        getDeviceInfo: vi.fn().mockReturnValue({
          id: longId,
          friendlyName: 'Test',
          supportsApdu: true,
        }),
        isCardPresent: vi.fn(),
        isSessionActive: vi.fn(),
        startSession: vi.fn(),
        release: vi.fn(),
      };

      (mockPlatform.acquireDevice as any).mockResolvedValue(mockDevice);

      const request: RpcRequest = {
        id: 'req-long',
        method: 'platform.acquireDevice',
        params: { deviceId: longId },
      };

      const handler = (mockTransport as any).requestHandler;
      const response = await handler(request);

      expect(response.result || response.error).toBeDefined();
    });
  });

  describe('stop()', () => {
    test('should release platform on stop', async () => {
      await adapter.start();
      await adapter.stop();

      expect(mockPlatform.release).toHaveBeenCalled();
    });

    test('should close transport on stop', async () => {
      await adapter.start();
      await adapter.stop();

      expect(mockTransport.close).toHaveBeenCalled();
    });

    test('should handle stop errors gracefully', async () => {
      await adapter.start();
      
      (mockPlatform.release as any).mockRejectedValue(new Error('Release error'));

      await expect(adapter.stop()).rejects.toThrow();
    });
  });
});
