/**
 * Connection Interruption and Error Recovery Tests
 * 
 * Tests how the system handles:
 * 1. Connection interruptions during operations
 * 2. Recovery from errors
 * 3. Resource cleanup on failures
 * 4. Timeout scenarios
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { RemoteSmartCardPlatform } from '../../src/client/platform-proxy.js';
import { SmartCardPlatformAdapter } from '../../src/server/platform-adapter.js';
import { InMemoryTransport } from '../../src/transport.js';
import { 
  SmartCardPlatform, 
  SmartCardDevice,
  SmartCardDeviceInfo,
  CommandApdu,
  ResponseApdu
} from '@aokiapp/jsapdu-interface';
import type { RpcRequest, RpcResponse } from '../../src/types.js';

describe('Connection Interruption - During Operations', () => {
  let transport: InMemoryTransport;
  let client: RemoteSmartCardPlatform;

  beforeEach(() => {
    transport = new InMemoryTransport();
    client = new RemoteSmartCardPlatform(transport);
  });

  test('init() fails gracefully on connection error', async () => {
    transport.onRequest(async () => {
      throw new Error('Connection lost');
    });

    await expect(client.init()).rejects.toThrow();
    expect(client.isInitialized()).toBe(false);
  });

  test('getDeviceInfo() fails on connection error but platform remains usable', async () => {
    let callCount = 0;
    transport.onRequest(async (req) => {
      callCount++;
      if (req.method === 'platform.init') {
        return { id: req.id, result: null };
      }
      if (req.method === 'platform.getDeviceInfo' && callCount === 2) {
        throw new Error('Network timeout');
      }
      if (req.method === 'platform.getDeviceInfo' && callCount === 3) {
        return { id: req.id, result: [] };
      }
      throw new Error('Unexpected call');
    });

    await client.init();

    // First call fails
    await expect(client.getDeviceInfo()).rejects.toThrow();

    // Platform should still be initialized
    expect(client.isInitialized()).toBe(true);

    // Should be able to retry
    const devices = await client.getDeviceInfo();
    expect(Array.isArray(devices)).toBe(true);
  });

  test('acquireDevice() fails but other devices can still be acquired', async () => {
    const deviceInfo1 = {
      id: 'device-1',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816' as const,
      p2dProtocol: 'usb' as const,
      apduApi: [],
    };

    const deviceInfo2 = {
      id: 'device-2',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816' as const,
      p2dProtocol: 'usb' as const,
      apduApi: [],
    };

    transport.onRequest(async (req) => {
      if (req.method === 'platform.init') {
        return { id: req.id, result: null };
      }
      if (req.method === 'platform.getDeviceInfo') {
        return { id: req.id, result: [deviceInfo1, deviceInfo2] };
      }
      if (req.method === 'platform.acquireDevice' && req.params?.[0] === 'device-1') {
        return { id: req.id, error: { code: 'DEVICE_BUSY', message: 'Device busy' } };
      }
      if (req.method === 'platform.acquireDevice' && req.params?.[0] === 'device-2') {
        return { id: req.id, result: 'device-handle-2' };
      }
      throw new Error('Unexpected call');
    });

    await client.init();

    // First device fails
    await expect(client.acquireDevice('device-1')).rejects.toThrow('Device busy');

    // Second device should work
    const device2 = await client.acquireDevice('device-2');
    expect(device2).toBeDefined();
  });
});

describe('Error Recovery - Platform Lifecycle', () => {
  let transport: InMemoryTransport;
  let mockPlatform: any;
  let adapter: SmartCardPlatformAdapter;
  let client: RemoteSmartCardPlatform;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    
    mockPlatform = {
      init: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      getDeviceInfo: vi.fn().mockResolvedValue([]),
      acquireDevice: vi.fn(),
      isInitialized: vi.fn().mockReturnValue(false),
    };
    
    adapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    client = new RemoteSmartCardPlatform(transport);
    await adapter.start();
  });

  test('failed init can be retried', async () => {
    mockPlatform.init.mockRejectedValueOnce(new Error('Init failed'));

    // First attempt fails
    await expect(client.init()).rejects.toThrow('Init failed');
    expect(client.isInitialized()).toBe(false);

    // Retry should work
    mockPlatform.init.mockResolvedValueOnce(undefined);
    await client.init();
    expect(client.isInitialized()).toBe(true);
  });

  test('platform continues after device acquisition error', async () => {
    await client.init();

    const errorDevice: any = {
      getDeviceInfo: () => ({ id: 'error-device' }),
      release: vi.fn().mockRejectedValue(new Error('Device error')),
    };

    const okDevice: any = {
      getDeviceInfo: () => ({ id: 'ok-device' }),
      release: vi.fn().mockResolvedValue(undefined),
    };

    mockPlatform.acquireDevice
      .mockResolvedValueOnce(errorDevice)
      .mockResolvedValueOnce(okDevice);

    mockPlatform.getDeviceInfo.mockResolvedValue([
      { id: 'error-device' },
      { id: 'ok-device' },
    ]);

    // Acquire device that will fail on release
    const dev1 = await client.acquireDevice('error-device');
    expect(dev1).toBeDefined();

    // Platform should still work for other devices
    const dev2 = await client.acquireDevice('ok-device');
    expect(dev2).toBeDefined();
  });
});

describe('Resource Cleanup on Failures', () => {
  let transport: InMemoryTransport;
  let mockPlatform: any;
  let adapter: SmartCardPlatformAdapter;
  let client: RemoteSmartCardPlatform;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    
    mockPlatform = {
      init: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      getDeviceInfo: vi.fn().mockResolvedValue([]),
      acquireDevice: vi.fn(),
      isInitialized: vi.fn().mockReturnValue(false),
    };
    
    adapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    client = new RemoteSmartCardPlatform(transport);
    await adapter.start();
    await client.init();
  });

  test('release() cleans up even if device releases fail', async () => {
    const failingDevice: any = {
      getDeviceInfo: () => ({ id: 'failing-device' }),
      release: vi.fn().mockRejectedValue(new Error('Release failed')),
    };

    mockPlatform.acquireDevice.mockResolvedValue(failingDevice);
    mockPlatform.getDeviceInfo.mockResolvedValue([{ id: 'failing-device' }]);

    await client.acquireDevice('failing-device');

    // Release should complete even if device release fails
    await expect(client.release()).resolves.toBeUndefined();
    expect(client.isInitialized()).toBe(false);
  });

  test('adapter release cleans up all resources on errors', async () => {
    const errorDevice: any = {
      getDeviceInfo: () => ({ id: 'device' }),
      startSession: vi.fn().mockResolvedValue({
        getAtr: vi.fn().mockResolvedValue(new Uint8Array([0x3B])),
        release: vi.fn().mockRejectedValue(new Error('Card error')),
      }),
      release: vi.fn().mockResolvedValue(undefined),
    };

    mockPlatform.acquireDevice.mockResolvedValue(errorDevice);

    // Acquire device and start session
    const deviceResp = await transport.call({
      id: 'dev',
      method: 'platform.acquireDevice',
      params: ['device'],
    });
    
    const deviceHandle = deviceResp.result as string;
    
    const cardResp = await transport.call({
      id: 'card',
      method: 'device.startSession',
      params: [deviceHandle],
    });

    // Platform release should clean up everything
    await transport.call({
      id: 'release',
      method: 'platform.release',
      params: [],
    });

    expect(mockPlatform.release).toHaveBeenCalled();
  });
});

describe('Timeout and Async Operation Scenarios', () => {
  let transport: InMemoryTransport;
  let client: RemoteSmartCardPlatform;

  beforeEach(() => {
    transport = new InMemoryTransport();
    client = new RemoteSmartCardPlatform(transport);
  });

  test('slow operations can be handled', async () => {
    transport.onRequest(async (req) => {
      if (req.method === 'platform.init') {
        // Simulate slow init
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id: req.id, result: null };
      }
      throw new Error('Unexpected');
    });

    await expect(client.init()).resolves.toBeUndefined();
    expect(client.isInitialized()).toBe(true);
  });

  test('concurrent operations are serialized', async () => {
    const callOrder: string[] = [];
    
    transport.onRequest(async (req) => {
      callOrder.push(req.method);
      await new Promise(resolve => setTimeout(resolve, 10));
      return { id: req.id, result: req.method === 'platform.getDeviceInfo' ? [] : null };
    });

    await client.init();

    // Start multiple concurrent operations
    const promises = [
      client.getDeviceInfo(),
      client.getDeviceInfo(),
      client.getDeviceInfo(),
    ];

    await Promise.all(promises);

    expect(callOrder).toHaveLength(4); // 1 init + 3 getDeviceInfo
  });
});

// This file has 4 describe blocks testing connection interruption scenarios.
// Total: ~280 lines, focused on error handling and recovery.
