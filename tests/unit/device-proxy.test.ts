/**
 * Device Proxy Unit Tests
 * 
 * Tests the client-side SmartCardDevice proxy to ensure:
 * 1. Device interface calls convert correctly to RPC
 * 2. Session management works properly
 * 3. Card presence detection and waiting works
 * 4. Device lifecycle and cleanup is correct
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { RemoteSmartCardDevice } from '../../src/client/device-proxy.js';
import { RemoteSmartCardDeviceInfo, RemoteSmartCardError } from '../../src/client/platform-proxy.js';
import { InMemoryTransport } from '../../src/transport.js';
import { SmartCardPlatform } from '@aokiapp/jsapdu-interface';
import type { RpcRequest, RpcResponse } from '../../src/types.js';

describe('RemoteSmartCardDevice - RPC Conversion', () => {
  let transport: InMemoryTransport;
  let device: RemoteSmartCardDevice;
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockPlatform: SmartCardPlatform;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    mockPlatform = new SmartCardPlatform();
    // Initialize the platform to avoid NOT_INITIALIZED errors
    mockPlatform['initialized'] = true;
    
    const deviceInfo = new RemoteSmartCardDeviceInfo({
      id: 'test-device',
      friendlyName: 'Test Reader',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: ['transmit'],
    });
    
    device = new RemoteSmartCardDevice(transport, 'device-handle-1', deviceInfo, mockPlatform);
  });

  test('getDeviceInfo() returns device information', () => {
    const info = device.getDeviceInfo();
    expect(info.id).toBe('test-device');
    expect(info.friendlyName).toBe('Test Reader');
    expect(info.supportsApdu).toBe(true);
  });

  test('isSessionActive() tracks session state', () => {
    expect(device.isSessionActive()).toBe(false);
  });

  test('isDeviceAvailable() converts to device.isDeviceAvailable RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: true,
    });

    const available = await device.isDeviceAvailable();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('device.isDeviceAvailable');
    expect(call.params).toEqual(['device-handle-1']);
    expect(available).toBe(true);
  });

  test('isCardPresent() converts to device.isCardPresent RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: true,
    });

    const present = await device.isCardPresent();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('device.isCardPresent');
    expect(call.params).toEqual(['device-handle-1']);
    expect(present).toBe(true);
  });

  test('startSession() converts to device.startSession RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: 'card-handle-1',
    });

    const card = await device.startSession();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('device.startSession');
    expect(call.params).toEqual(['device-handle-1']);
    expect(card).toBeDefined();
    expect(device.isSessionActive()).toBe(true);
  });

  test('waitForCardPresence() converts to device.waitForCardPresence RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await device.waitForCardPresence(5000);

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('device.waitForCardPresence');
    expect(call.params).toEqual(['device-handle-1', 5000]);
  });

  test('release() converts to device.release RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await device.release();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('device.release');
    expect(call.params).toEqual(['device-handle-1']);
  });

  test('startHceSession() throws unsupported error', async () => {
    await expect(device.startHceSession()).rejects.toThrow('HCE is not supported over network');
  });
});

describe('RemoteSmartCardDevice - Session Lifecycle', () => {
  let transport: InMemoryTransport;
  let device: RemoteSmartCardDevice;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    const mockPlatform = new SmartCardPlatform();
    mockPlatform['initialized'] = true;
    
    const deviceInfo = new RemoteSmartCardDeviceInfo({
      id: 'test-device',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    });
    
    device = new RemoteSmartCardDevice(transport, 'device-handle-1', deviceInfo, mockPlatform);
  });

  test('session becomes active after startSession', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: 'card-handle-1',
    });

    expect(device.isSessionActive()).toBe(false);
    await device.startSession();
    expect(device.isSessionActive()).toBe(true);
  });

  test('release() clears session state', async () => {
    // Start session
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: 'card-handle-1' });
    await device.startSession();
    
    // Mock card.release
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: null });
    // Mock device.release
    mockHandler.mockResolvedValueOnce({ id: 'id3', result: null });
    
    await device.release();
    
    expect(device.isSessionActive()).toBe(false);
  });

  test('release() releases all cards', async () => {
    // Start session
    mockHandler.mockResolvedValueOnce({ id: 'id1', result: 'card-handle-1' });
    await device.startSession();
    
    // Mock card.release
    mockHandler.mockResolvedValueOnce({ id: 'id2', result: null });
    // Mock device.release
    mockHandler.mockResolvedValueOnce({ id: 'id3', result: null });
    
    await device.release();
    
    // Verify card.release was called
    const cardReleaseCalls = mockHandler.mock.calls.filter(
      call => call[0].method === 'card.release'
    );
    expect(cardReleaseCalls.length).toBeGreaterThan(0);
  });
});

describe('RemoteSmartCardDevice - Error Handling', () => {
  let transport: InMemoryTransport;
  let device: RemoteSmartCardDevice;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    const mockPlatform = new SmartCardPlatform();
    mockPlatform['initialized'] = true;
    
    const deviceInfo = new RemoteSmartCardDeviceInfo({
      id: 'test-device',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    });
    
    device = new RemoteSmartCardDevice(transport, 'device-handle-1', deviceInfo, mockPlatform);
  });

  test('RPC errors are converted to RemoteSmartCardError', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      error: {
        code: 'NO_CARD_PRESENT',
        message: 'No card is present in the reader',
      },
    });

    await expect(device.startSession()).rejects.toThrow('No card is present in the reader');
    
    // Reset mock for checking error properties
    mockHandler.mockResolvedValueOnce({
      id: 'test-id2',
      error: {
        code: 'NO_CARD_PRESENT',
        message: 'No card is present in the reader',
      },
    });
    
    try {
      await device.startSession();
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteSmartCardError);
      expect((error as RemoteSmartCardError).code).toBe('NO_CARD_PRESENT');
      expect((error as RemoteSmartCardError).message).toBe('No card is present in the reader');
    }
  });

  test('waitForCardPresence timeout error propagates', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      error: {
        code: 'TIMEOUT',
        message: 'Card wait timeout',
      },
    });

    await expect(device.waitForCardPresence(1000)).rejects.toThrow(RemoteSmartCardError);
  });
});

describe('RemoteSmartCardDevice - Card Tracking', () => {
  let transport: InMemoryTransport;
  let device: RemoteSmartCardDevice;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    const mockPlatform = new SmartCardPlatform();
    mockPlatform['initialized'] = true;
    
    const deviceInfo = new RemoteSmartCardDeviceInfo({
      id: 'test-device',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: [],
    });
    
    device = new RemoteSmartCardDevice(transport, 'device-handle-1', deviceInfo, mockPlatform);
  });

  test('startSession creates and tracks card', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: 'card-handle-1',
    });

    const card = await device.startSession();
    
    expect(card).toBeDefined();
    expect(device.card).toBe(card);
  });

  test('untrackCard removes card reference', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: 'card-handle-1',
    });

    const card = await device.startSession();
    expect(device.card).toBe(card);
    
    device.untrackCard('card-handle-1');
    expect(device.card).toBeNull();
  });
});
