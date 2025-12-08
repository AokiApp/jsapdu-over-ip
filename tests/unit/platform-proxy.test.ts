/**
 * Platform Proxy Unit Tests
 * 
 * Tests the client-side SmartCardPlatform proxy to ensure:
 * 1. Interface calls are correctly converted to RPC requests
 * 2. RPC responses are correctly converted back to interface results
 * 3. Error handling works properly
 * 4. Device lifecycle is properly tracked
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { RemoteSmartCardPlatform, RemoteSmartCardError } from '../../src/client/platform-proxy.js';
import { InMemoryTransport } from '../../src/transport.js';
import type { RpcRequest, RpcResponse, SerializedDeviceInfo } from '../../src/types.js';

describe('RemoteSmartCardPlatform - RPC Conversion', () => {
  let transport: InMemoryTransport;
  let platform: RemoteSmartCardPlatform;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    platform = new RemoteSmartCardPlatform(transport);
    
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
  });

  test('init() converts to platform.init RPC call', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await platform.init();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('platform.init');
    expect(call.params).toEqual([undefined]);
    expect(platform.isInitialized()).toBe(true);
  });

  test('init(force=true) passes force parameter', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await platform.init(true);

    const call = mockHandler.mock.calls[0][0];
    expect(call.params).toEqual([true]);
  });

  test('release() converts to platform.release RPC call', async () => {
    // Init first
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: null });
    await platform.init();

    // Then release
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: null });
    await platform.release();

    expect(mockHandler).toHaveBeenCalledTimes(2);
    const releaseCall = mockHandler.mock.calls[1][0];
    expect(releaseCall.method).toBe('platform.release');
    expect(platform.isInitialized()).toBe(false);
  });

  test('getDeviceInfo() converts to platform.getDeviceInfo and deserializes', async () => {
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: null });
    await platform.init();

    const mockDeviceInfo: SerializedDeviceInfo = {
      id: 'test-device-1',
      friendlyName: 'Test Reader',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: ['transmit', 'reset'],
    };

    mockHandler.mockResolvedValueOnce({
      id: 'id2',
      result: [mockDeviceInfo],
    });

    const devices = await platform.getDeviceInfo();

    expect(mockHandler).toHaveBeenCalledTimes(2);
    const call = mockHandler.mock.calls[1][0];
    expect(call.method).toBe('platform.getDeviceInfo');
    
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe('test-device-1');
    expect(devices[0].friendlyName).toBe('Test Reader');
    expect(devices[0].supportsApdu).toBe(true);
  });

  test('acquireDevice() converts to platform.acquireDevice and creates proxy', async () => {
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: null });
    await platform.init();

    const mockDeviceInfo: SerializedDeviceInfo = {
      id: 'device-1',
      friendlyName: 'Test Reader',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: ['transmit'],
    };

    // Mock getDeviceInfo call
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: 'device-handle-1' });
    mockHandler.mockResolvedValueOnce({ id: 'id3', result: [mockDeviceInfo] });

    const device = await platform.acquireDevice('device-1');

    expect(device).toBeDefined();
    expect(device.getDeviceInfo().id).toBe('device-1');
  });

  test('throws RemoteSmartCardError on RPC error', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      error: {
        code: 'DEVICE_NOT_FOUND',
        message: 'Device xyz not found',
        data: { deviceId: 'xyz' },
      },
    });

    await expect(platform.init()).rejects.toThrow('Device xyz not found');
    
    // Reset mock for second call
    mockHandler.mockResolvedValueOnce({
      id: 'test-id2',
      error: {
        code: 'DEVICE_NOT_FOUND',
        message: 'Device xyz not found',
        data: { deviceId: 'xyz' },
      },
    });
    
    try {
      await platform.init();
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteSmartCardError);
      expect((error as RemoteSmartCardError).code).toBe('DEVICE_NOT_FOUND');
      expect((error as RemoteSmartCardError).message).toBe('Device xyz not found');
      expect((error as RemoteSmartCardError).data).toEqual({ deviceId: 'xyz' });
    }
  });
});

describe('RemoteSmartCardPlatform - Device Lifecycle', () => {
  let transport: InMemoryTransport;
  let platform: RemoteSmartCardPlatform;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    platform = new RemoteSmartCardPlatform(transport);
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    // Init platform
    mockHandler.mockResolvedValueOnce({ id: 'id', result: null });
    await platform.init();
  });

  test('acquireDevice() twice for same device throws error', async () => {
    const deviceInfo: SerializedDeviceInfo = {
      id: 'device-1',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    };

    mockHandler.mockResolvedValueOnce({ id: 'id1', result: 'handle-1' });
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: [deviceInfo] });
    await platform.acquireDevice('device-1');

    await expect(platform.acquireDevice('device-1')).rejects.toThrow('already acquired');
  });

  test('release() releases all acquired devices', async () => {
    const deviceInfo: SerializedDeviceInfo = {
      id: 'device-1',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    };

    // Acquire device
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: 'handle-1' });
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: [deviceInfo] });
    const device = await platform.acquireDevice('device-1');

    // Mock device.release
    mockHandler.mockResolvedValueOnce({ id: 'id3', result: null });
    // Platform release
    mockHandler.mockResolvedValueOnce({ id: 'id4', result: null });

    await platform.release();

    // Verify device.release was called
    const deviceReleaseCalls = mockHandler.mock.calls.filter(
      call => call[0].method === 'device.release'
    );
    expect(deviceReleaseCalls.length).toBeGreaterThan(0);
  });
});

describe('RemoteSmartCardPlatform - State Management', () => {
  let transport: InMemoryTransport;
  let platform: RemoteSmartCardPlatform;

  beforeEach(() => {
    transport = new InMemoryTransport();
    platform = new RemoteSmartCardPlatform(transport);
  });

  test('isInitialized() returns false before init', () => {
    expect(platform.isInitialized()).toBe(false);
  });

  test('isInitialized() returns true after init', async () => {
    transport.onRequest(async () => ({ id: 'id', result: null }));
    await platform.init();
    expect(platform.isInitialized()).toBe(true);
  });

  test('operations before init throw error', async () => {
    await expect(platform.getDeviceInfo()).rejects.toThrow();
    await expect(platform.acquireDevice('test')).rejects.toThrow();
  });
});

describe('RemoteSmartCardPlatform - Multiple Devices', () => {
  let transport: InMemoryTransport;
  let platform: RemoteSmartCardPlatform;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    platform = new RemoteSmartCardPlatform(transport);
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    mockHandler.mockResolvedValueOnce({ id: 'id', result: null });
    await platform.init();
  });

  test('can acquire multiple different devices', async () => {
    const device1Info: SerializedDeviceInfo = {
      id: 'device-1',
      friendlyName: 'Reader 1',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    };

    const device2Info: SerializedDeviceInfo = {
      id: 'device-2',
      friendlyName: 'Reader 2',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    };

    // Acquire device 1
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: 'handle-1' });
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: [device1Info, device2Info] });
    const dev1 = await platform.acquireDevice('device-1');

    // Acquire device 2
    mockHandler.mockResolvedValueOnce({ id: 'id3', result: 'handle-2' });
    mockHandler.mockResolvedValueOnce({ id: 'id4', result: [device1Info, device2Info] });
    const dev2 = await platform.acquireDevice('device-2');

    expect(dev1.getDeviceInfo().id).toBe('device-1');
    expect(dev2.getDeviceInfo().id).toBe('device-2');
  });
});
