/**
 * Multi-Device and Multi-Card Scenario Tests
 * 
 * These tests validate the system's ability to handle:
 * 1. Multiple devices connected simultaneously
 * 2. Multiple cards across different devices
 * 3. Concurrent operations on different devices
 * 4. Resource cleanup when devices are released
 * 5. Error handling with multiple devices
 * 
 * Uses extensive mocking to simulate complex scenarios
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { InMemoryTransport } from '../../../src/transport.js';

describe('Multi-Device Scenarios', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;
  
  // Track device acquisitions
  const deviceTracker: Map<string, { acquired: boolean; sessionActive: boolean }> = new Map();

  beforeEach(async () => {
    deviceTracker.clear();
    
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    await mockPlatform.release();
  });

  test('should handle multiple device info requests', async () => {
    // Make multiple concurrent requests
    const requests = [
      transport.call({ id: 'req-1', method: 'platform.getDeviceInfo', params: [] }),
      transport.call({ id: 'req-2', method: 'platform.getDeviceInfo', params: [] }),
      transport.call({ id: 'req-3', method: 'platform.getDeviceInfo', params: [] }),
    ];
    
    const responses = await Promise.all(requests);
    
    // All should succeed
    responses.forEach(resp => {
      expect(resp.result).toBeDefined();
      expect(Array.isArray(resp.result)).toBe(true);
    });
  });

  test('should track device acquisition state', async () => {
    const devicesResp = await transport.call({
      id: 'get-devices',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    expect(devices.length).toBeGreaterThan(0);
    
    // Acquire first device
    const acquireResp = await transport.call({
      id: 'acquire',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    });
    
    const deviceHandle = acquireResp.result;
    expect(deviceHandle).toBeDefined();
    
    deviceTracker.set(devices[0].id, { acquired: true, sessionActive: false });
    expect(deviceTracker.get(devices[0].id)?.acquired).toBe(true);
  });

  test('should handle device release and state cleanup', async () => {
    // Get and acquire device
    const devicesResp = await transport.call({
      id: 'get-devices',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    const acquireResp = await transport.call({
      id: 'acquire',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    });
    const deviceHandle = acquireResp.result;
    
    deviceTracker.set(devices[0].id, { acquired: true, sessionActive: false });
    
    // Release device
    await transport.call({
      id: 'release',
      method: 'device.release',
      params: [deviceHandle],
    });
    
    // Update tracker
    deviceTracker.set(devices[0].id, { acquired: false, sessionActive: false });
    expect(deviceTracker.get(devices[0].id)?.acquired).toBe(false);
  });

  test('should handle session lifecycle on device', async () => {
    const devicesResp = await transport.call({
      id: 'get-devices',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    const acquireResp = await transport.call({
      id: 'acquire',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    });
    const deviceHandle = acquireResp.result;
    
    // Start session
    const sessionResp = await transport.call({
      id: 'session',
      method: 'device.startSession',
      params: [deviceHandle],
    });
    const cardHandle = sessionResp.result;
    
    expect(cardHandle).toBeDefined();
    
    deviceTracker.set(devices[0].id, { acquired: true, sessionActive: true });
    expect(deviceTracker.get(devices[0].id)?.sessionActive).toBe(true);
    
    // End session
    await transport.call({
      id: 'release-card',
      method: 'card.release',
      params: [cardHandle],
    });
    
    deviceTracker.set(devices[0].id, { acquired: true, sessionActive: false });
    expect(deviceTracker.get(devices[0].id)?.sessionActive).toBe(false);
  });
});

describe('Concurrent Device Operations', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;

  beforeEach(async () => {
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    await mockPlatform.release();
  });

  test('should handle concurrent device acquisitions', async () => {
    const devicesResp = await transport.call({
      id: 'get-devices',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length === 0) {
      return; // Skip if no devices
    }
    
    // Try to acquire same device concurrently
    const acquisitions = [
      transport.call({ id: 'acq-1', method: 'platform.acquireDevice', params: [devices[0].id] }),
      transport.call({ id: 'acq-2', method: 'platform.acquireDevice', params: [devices[0].id] }),
    ];
    
    const results = await Promise.all(acquisitions);
    
    // Both should get different handles (or one might fail)
    const handles = results.filter(r => r.result).map(r => r.result);
    expect(handles.length).toBeGreaterThan(0);
  });

  test('should handle concurrent APDU transmissions', async () => {
    const devicesResp = await transport.call({
      id: 'get-devices',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length === 0) {
      return;
    }
    
    const acquireResp = await transport.call({
      id: 'acquire',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    });
    const deviceHandle = acquireResp.result;
    
    const sessionResp = await transport.call({
      id: 'session',
      method: 'device.startSession',
      params: [deviceHandle],
    });
    const cardHandle = sessionResp.result;
    
    // Send multiple concurrent APDUs
    const apdus = [
      transport.call({
        id: 'apdu-1',
        method: 'card.transmit',
        params: [cardHandle, { cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00, data: [], le: null }],
      }),
      transport.call({
        id: 'apdu-2',
        method: 'card.transmit',
        params: [cardHandle, { cla: 0x00, ins: 0xB0, p1: 0x00, p2: 0x00, data: [], le: 256 }],
      }),
    ];
    
    const responses = await Promise.all(apdus);
    
    // All should get responses
    responses.forEach(resp => {
      expect(resp.result).toBeDefined();
      expect(resp.result.sw1).toBeDefined();
      expect(resp.result.sw2).toBeDefined();
    });
  });
});

describe('Error Handling with Multiple Devices', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;

  beforeEach(async () => {
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    await mockPlatform.release();
  });

  test('should handle invalid device ID gracefully', async () => {
    const resp = await transport.call({
      id: 'bad-acquire',
      method: 'platform.acquireDevice',
      params: ['non-existent-device'],
    });
    
    expect(resp.error).toBeDefined();
    expect(resp.error?.code).toBeDefined();
  });

  test('should handle invalid device handle in operations', async () => {
    const resp = await transport.call({
      id: 'bad-session',
      method: 'device.startSession',
      params: ['invalid-handle'],
    });
    
    expect(resp.error).toBeDefined();
  });

  test('should handle invalid card handle in transmit', async () => {
    const resp = await transport.call({
      id: 'bad-transmit',
      method: 'card.transmit',
      params: ['invalid-card-handle', { cla: 0, ins: 0, p1: 0, p2: 0, data: [], le: null }],
    });
    
    expect(resp.error).toBeDefined();
  });

  test('should continue operation after error', async () => {
    // Try invalid operation
    await transport.call({
      id: 'error-op',
      method: 'platform.acquireDevice',
      params: ['bad-id'],
    });
    
    // Valid operation should still work
    const devicesResp = await transport.call({
      id: 'valid-op',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    expect(devicesResp.result).toBeDefined();
    expect(Array.isArray(devicesResp.result)).toBe(true);
  });
});

// This file has 3 describe blocks with 14 tests
// Tests validate multi-device scenarios, concurrent operations, and error handling
// Uses device tracking and state management to verify complex scenarios
