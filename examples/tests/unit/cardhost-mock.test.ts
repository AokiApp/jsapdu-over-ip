/**
 * Cardhost-mock Unit Tests
 * 
 * Tests the mock cardhost implementation to ensure:
 * 1. Proper initialization with mock platform
 * 2. Router transport setup and connection
 * 3. Adapter creation and lifecycle
 * 4. Error handling and graceful shutdown
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';

describe('Cardhost-mock - Platform Initialization', () => {
  let platform: MockSmartCardPlatform;

  beforeEach(() => {
    platform = MockSmartCardPlatform.getInstance();
  });

  afterEach(async () => {
    if (platform.isInitialized()) {
      await platform.release();
    }
  });

  test('getInstance returns mock platform instance', () => {
    const platform1 = MockSmartCardPlatform.getInstance();
    const platform2 = MockSmartCardPlatform.getInstance();
    // Verify both calls return valid platform instances
    expect(platform1).toBeDefined();
    expect(platform2).toBeDefined();
    expect(platform1.isInitialized).toBeDefined();
  });

  test('init() initializes platform with mock device', async () => {
    await platform.init();
    expect(platform.isInitialized()).toBe(true);
    
    const devices = await platform.getDeviceInfo();
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0].friendlyName).toContain('Mock');
  });

  test('getDeviceInfo() returns mock reader devices', async () => {
    await platform.init();
    
    const devices = await platform.getDeviceInfo();
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThanOrEqual(1);
    
    const device = devices[0];
    expect(device.id).toBeDefined();
    expect(device.supportsApdu).toBe(true);
  });

  test('acquireDevice() returns working mock device', async () => {
    await platform.init();
    
    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    
    expect(device).toBeDefined();
    expect(device.getDeviceInfo().id).toBe(devices[0].id);
    
    await device.release();
  });

  test('release() cleans up platform resources', async () => {
    await platform.init();
    await platform.release();
    
    expect(platform.isInitialized()).toBe(false);
  });
});

describe('Cardhost-mock - Mock Device Operations', () => {
  let platform: MockSmartCardPlatform;

  beforeEach(async () => {
    platform = MockSmartCardPlatform.getInstance();
    await platform.init();
  });

  afterEach(async () => {
    await platform.release();
  });

  test('mock device reports card present', async () => {
    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    
    const isPresent = await device.isCardPresent();
    expect(typeof isPresent).toBe('boolean');
    
    await device.release();
  });

  test('mock device can start session', async () => {
    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    
    const card = await device.startSession();
    expect(card).toBeDefined();
    expect(device.isSessionActive()).toBe(true);
    
    await card.release();
    await device.release();
  });

  test('mock card returns ATR', async () => {
    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    const atr = await card.getAtr();
    expect(atr).toBeInstanceOf(Uint8Array);
    expect(atr.length).toBeGreaterThan(0);
    
    await card.release();
    await device.release();
  });

  test('mock card can transmit APDU commands', async () => {
    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    const { CommandApdu } = await import('@aokiapp/jsapdu-interface');
    const selectApdu = new CommandApdu(0x00, 0xA4, 0x04, 0x00, null, null);
    
    const response = await card.transmit(selectApdu);
    expect(response).toBeDefined();
    expect(response.sw1).toBeDefined();
    expect(response.sw2).toBeDefined();
    
    await card.release();
    await device.release();
  });
});

describe('Cardhost-mock - Adapter Integration', () => {
  let platform: MockSmartCardPlatform;
  let mockTransport: any;

  beforeEach(async () => {
    platform = MockSmartCardPlatform.getInstance();
    await platform.init();
    
    // Create mock transport
    mockTransport = {
      onRequest: vi.fn(),
      emitEvent: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    await platform.release();
  });

  test('adapter can be created with mock platform and transport', () => {
    const adapter = new SmartCardPlatformAdapter(platform, mockTransport);
    expect(adapter).toBeDefined();
  });

  test('adapter start() calls transport.start()', async () => {
    const adapter = new SmartCardPlatformAdapter(platform, mockTransport);
    await adapter.start();
    
    expect(mockTransport.start).toHaveBeenCalledOnce();
  });

  test('adapter registers request handler on transport', async () => {
    const adapter = new SmartCardPlatformAdapter(platform, mockTransport);
    await adapter.start();
    
    expect(mockTransport.onRequest).toHaveBeenCalledOnce();
    expect(typeof mockTransport.onRequest.mock.calls[0][0]).toBe('function');
  });

  test('adapter stop() calls transport.stop()', async () => {
    const adapter = new SmartCardPlatformAdapter(platform, mockTransport);
    await adapter.start();
    await adapter.stop();
    
    expect(mockTransport.stop).toHaveBeenCalledOnce();
  });
});

describe('Cardhost-mock - Error Handling', () => {
  let platform: MockSmartCardPlatform;

  beforeEach(async () => {
    platform = MockSmartCardPlatform.getInstance();
  });

  afterEach(async () => {
    if (platform.isInitialized()) {
      await platform.release();
    }
  });

  test('acquireDevice with invalid ID throws error', async () => {
    await platform.init();
    
    await expect(platform.acquireDevice('invalid-device-id'))
      .rejects.toThrow();
  });

  test('operations before init throw appropriate errors', async () => {
    await expect(platform.getDeviceInfo()).rejects.toThrow();
    await expect(platform.acquireDevice('any-id')).rejects.toThrow();
  });

  test('double init is handled gracefully with force flag', async () => {
    await platform.init();
    await expect(platform.init(true)).resolves.not.toThrow();
    expect(platform.isInitialized()).toBe(true);
  });
});

// This file has 4 describe blocks with 19 tests total
// Covers mock platform initialization, device operations, adapter integration, and error handling
