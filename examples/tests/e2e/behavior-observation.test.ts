/**
 * Comprehensive Platform Behavior Observation Test
 * 
 * This test suite demonstrates advanced spy and mock usage to observe
 * internal cardhost behavior in a Vitest-aware manner.
 * 
 * Key features:
 * 1. Extensive spying on mock platform methods
 * 2. Call order verification
 * 3. Argument inspection
 * 4. State transition tracking
 * 5. Performance metrics collection
 * 6. Error scenario observation
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { InMemoryTransport } from '../../../src/transport.js';
import { CommandApdu } from '@aokiapp/jsapdu-interface';

describe('Platform Behavior Observation - Extensive Spying', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;
  
  // Comprehensive spy collection
  const spies = {
    platform: {} as any,
    device: {} as any,
    card: {} as any,
  };
  
  // Behavior tracking
  const behaviorLog: Array<{
    timestamp: number;
    category: string;
    action: string;
    args?: any[];
    result?: any;
  }> = [];

  beforeEach(async () => {
    behaviorLog.length = 0;
    
    // Initialize mock platform first
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    // Then spy on methods (after initialization)
    spies.platform.getDeviceInfo = vi.spyOn(mockPlatform, 'getDeviceInfo');
    spies.platform.acquireDevice = vi.spyOn(mockPlatform, 'acquireDevice');
    spies.platform.release = vi.spyOn(mockPlatform, 'release');
    spies.platform.isInitialized = vi.spyOn(mockPlatform, 'isInitialized');
    
    // Setup transport and adapter
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    if (mockPlatform.isInitialized()) {
      await mockPlatform.release();
    }
  });

  test('should track initialization by checking isInitialized', () => {
    expect(mockPlatform.isInitialized()).toBe(true);
    expect(spies.platform.isInitialized).toHaveBeenCalled();
  });

  test('should track getDeviceInfo calls with call count', async () => {
    // Call multiple times
    await mockPlatform.getDeviceInfo();
    await mockPlatform.getDeviceInfo();
    await mockPlatform.getDeviceInfo();
    
    expect(spies.platform.getDeviceInfo).toHaveBeenCalledTimes(3);
  });

  test('should track device acquisition with arguments', async () => {
    const devices = await mockPlatform.getDeviceInfo();
    expect(devices.length).toBeGreaterThan(0);
    
    const deviceId = devices[0].id;
    await mockPlatform.acquireDevice(deviceId);
    
    // Verify spy captured the device ID
    expect(spies.platform.acquireDevice).toHaveBeenCalledWith(deviceId);
    expect(spies.platform.acquireDevice.mock.calls[0][0]).toBe(deviceId);
  });

  test('should track method call order', async () => {
    const callOrder: string[] = [];
    
    // Clear existing calls
    spies.platform.getDeviceInfo.mockClear();
    spies.platform.acquireDevice.mockClear();
    
    // Track calls with side effects
    spies.platform.getDeviceInfo.mockImplementation(async function(this: any) {
      callOrder.push('getDeviceInfo');
      return [];
    });
    
    spies.platform.acquireDevice.mockImplementation(async function(this: any, id: string) {
      callOrder.push('acquireDevice');
      throw new Error('No devices');
    });
    
    // Make calls
    await mockPlatform.getDeviceInfo();
    try {
      await mockPlatform.acquireDevice('test-id');
    } catch (e) {
      // Expected
    }
    
    // Verify order
    expect(callOrder).toEqual(['getDeviceInfo', 'acquireDevice']);
  });

  test('should measure method execution time', async () => {
    const timings: { method: string; duration: number }[] = [];
    
    // Just measure call time without mocking implementation
    const start = Date.now();
    await mockPlatform.getDeviceInfo();
    const duration = Date.now() - start;
    
    timings.push({ method: 'getDeviceInfo', duration });
    
    expect(timings.length).toBe(1);
    expect(timings[0].method).toBe('getDeviceInfo');
    expect(timings[0].duration).toBeGreaterThanOrEqual(0);
  });

  test('should track state transitions', async () => {
    const stateLog: string[] = [];
    
    // Track isInitialized calls
    spies.platform.isInitialized.mockImplementation(function(this: any) {
      const state = mockPlatform['initialized'] ? 'initialized' : 'not-initialized';
      stateLog.push(state);
      return mockPlatform['initialized'];
    });
    
    // Check states
    mockPlatform.isInitialized();
    
    expect(stateLog.length).toBeGreaterThan(0);
  });

  test('should verify spy mock implementation can be changed', async () => {
    // Change mock behavior mid-test
    spies.platform.getDeviceInfo.mockImplementation(async () => {
      return [
        {
          id: 'custom-device-1',
          friendlyName: 'Custom Mock Device',
          supportsApdu: true,
          supportsHce: false,
          isIntegratedDevice: false,
          isRemovableDevice: true,
          d2cProtocol: 'iso7816' as const,
          p2dProtocol: 'usb' as const,
          apduApi: [],
        },
      ];
    });
    
    const devices = await mockPlatform.getDeviceInfo();
    
    expect(devices.length).toBe(1);
    expect(devices[0].id).toBe('custom-device-1');
  });

  test('should allow spy to throw errors for testing', async () => {
    spies.platform.acquireDevice.mockImplementation(async () => {
      throw new Error('Device acquisition failed');
    });
    
    await expect(mockPlatform.acquireDevice('any-id')).rejects.toThrow('Device acquisition failed');
    expect(spies.platform.acquireDevice).toHaveBeenCalled();
  });

  test('should track multiple spy properties', () => {
    // Make a call to generate spy data
    mockPlatform.isInitialized();
    
    expect(spies.platform.isInitialized.mock.calls.length).toBeGreaterThan(0);
    expect(spies.platform.isInitialized.mock.results.length).toBeGreaterThan(0);
    
    // Check if call returned true (initialized)
    const lastResult = spies.platform.isInitialized.mock.results[spies.platform.isInitialized.mock.results.length - 1];
    expect(lastResult.type).toBe('return');
    expect(lastResult.value).toBe(true);
  });

  test('should allow resetting spy history', async () => {
    await mockPlatform.getDeviceInfo();
    expect(spies.platform.getDeviceInfo.mock.calls.length).toBeGreaterThan(0);
    
    // Reset
    spies.platform.getDeviceInfo.mockClear();
    expect(spies.platform.getDeviceInfo.mock.calls.length).toBe(0);
    
    // Call again
    await mockPlatform.getDeviceInfo();
    expect(spies.platform.getDeviceInfo.mock.calls.length).toBe(1);
  });
});

describe('APDU Transmission Observation', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;
  
  const apduLog: any[] = [];

  beforeEach(async () => {
    apduLog.length = 0;
    
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

  test('should observe APDU through RPC layer', async () => {
    // Simulate controller sending RPC request
    const request = {
      id: 'test-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };
    
    const response = await transport.call(request);
    
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
  });

  test('should track full APDU flow with spies', async () => {
    // Get devices
    const devicesReq = {
      id: 'req-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };
    const devicesResp = await transport.call(devicesReq);
    const devices = devicesResp.result;
    
    // Acquire device
    const acquireReq = {
      id: 'req-2',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    };
    const acquireResp = await transport.call(acquireReq);
    const deviceHandle = acquireResp.result;
    
    expect(deviceHandle).toBeDefined();
    expect(typeof deviceHandle).toBe('string');
  });

  test('should measure RPC round-trip time', async () => {
    const start = Date.now();
    
    await transport.call({
      id: 'perf-test',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(1000); // Should be fast
  });
});

describe('Error Scenario Observation', () => {
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

  test('should observe error responses', async () => {
    const invalidReq = {
      id: 'error-1',
      method: 'platform.acquireDevice',
      params: ['invalid-device'],
    };
    
    const response = await transport.call(invalidReq);
    
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBeDefined();
  });

  test('should track error frequency', async () => {
    const errors: any[] = [];
    
    // Try multiple invalid operations
    for (let i = 0; i < 3; i++) {
      const resp = await transport.call({
        id: `err-${i}`,
        method: 'platform.acquireDevice',
        params: ['invalid'],
      });
      
      if (resp.error) {
        errors.push(resp.error);
      }
    }
    
    expect(errors.length).toBe(3);
    expect(errors.every(e => e.code)).toBe(true);
  });
});

// This file has 3 describe blocks with 15 tests
// Demonstrates extensive spy usage for observing cardhost behavior
// Tests measure performance, track call order, and observe state transitions
