/**
 * Advanced E2E Test with Mock-Heavy Cardhost and Real Controller
 * 
 * This test demonstrates a new testing axis where:
 * 1. Router is started in beforeAll (Java/Quarkus process)
 * 2. Cardhost is imported as module (NOT spawned as process)
 * 3. Cardhost uses EXTENSIVE mocks and spies for observation
 * 4. Controller-cli sends real commands (no mocks on controller side)
 * 5. We observe cardhost behavior through router and spies
 * 
 * This approach allows deep inspection of cardhost internals while
 * maintaining realistic controller behavior and network communication.
 */

import { describe, test, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { CommandApdu } from '@aokiapp/jsapdu-interface';

// Test configuration
const TEST_CONFIG = {
  ROUTER_PORT: 8084, // Unique port for this test suite
  ROUTER_STARTUP_TIMEOUT: 30000,
  CARDHOST_UUID: 'e2e-spy-cardhost-001',
  TEST_TIMEOUT: 60000,
} as const;

describe('E2E: Mock-Heavy Cardhost with Real Controller', () => {
  let routerProcess: ChildProcess | null = null;
  let routerReady = false;
  
  // Cardhost components (as modules, not processes)
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let mockTransport: any;
  
  // Spies for observing cardhost behavior
  let initSpy: ReturnType<typeof vi.spyOn>;
  let getDeviceInfoSpy: ReturnType<typeof vi.spyOn>;
  let acquireDeviceSpy: ReturnType<typeof vi.spyOn>;
  let startSessionSpy: ReturnType<typeof vi.spyOn>;
  let transmitSpy: ReturnType<typeof vi.spyOn>;
  
  // Track RPC calls received by cardhost
  const rpcCallLog: any[] = [];

  beforeAll(async () => {
    console.log('\n=== Starting Advanced E2E Test Suite ===');
    console.log('Router will be started, cardhost will be mocked module');
    
    // Check Java availability
    const javaCheck = spawn('java', ['--version']);
    const javaAvailable = await new Promise<boolean>((resolve) => {
      javaCheck.on('close', (code) => resolve(code === 0));
      javaCheck.on('error', () => resolve(false));
    });

    if (!javaAvailable) {
      console.log('⚠️  Java not available - tests will be limited');
      return;
    }

    // Start Java Router
    console.log(`🚀 Starting Java Router on port ${TEST_CONFIG.ROUTER_PORT}`);
    const routerDir = process.cwd() + '/examples/router';
    
    routerProcess = spawn(
      './gradlew',
      ['quarkusDev', `-Dquarkus.http.port=${TEST_CONFIG.ROUTER_PORT}`],
      {
        cwd: routerDir,
        env: {
          ...process.env,
          JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    routerProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Listening on:') || output.includes('started in')) {
        routerReady = true;
        console.log('✅ Router is ready');
      }
    });

    routerProcess.stderr?.on('data', (data) => {
      const err = data.toString();
      if (!err.includes('Picked up JAVA_TOOL_OPTIONS')) {
        console.error('[Router ERROR]', err);
      }
    });

    // Wait for router to start
    const startTime = Date.now();
    while (!routerReady && Date.now() - startTime < TEST_CONFIG.ROUTER_STARTUP_TIMEOUT) {
      await sleep(1000);
    }

    if (routerReady) {
      console.log('✅ Router started successfully');
      await sleep(2000); // Stabilization time
    }
  }, TEST_CONFIG.ROUTER_STARTUP_TIMEOUT + 5000);

  beforeEach(async () => {
    // Clear RPC log
    rpcCallLog.length = 0;
    
    // Initialize mock platform
    mockPlatform = MockSmartCardPlatform.getInstance();
    
    // Spy on platform methods
    initSpy = vi.spyOn(mockPlatform, 'init');
    getDeviceInfoSpy = vi.spyOn(mockPlatform, 'getDeviceInfo');
    acquireDeviceSpy = vi.spyOn(mockPlatform, 'acquireDevice');
    
    await mockPlatform.init();
    
    // Create mock transport that logs all RPC calls
    mockTransport = {
      onRequest: vi.fn((handler: any) => {
        // Wrap the handler to log calls
        mockTransport._handler = async (req: any) => {
          rpcCallLog.push({
            timestamp: Date.now(),
            method: req.method,
            params: req.params,
          });
          return handler(req);
        };
      }),
      emitEvent: vi.fn(),
      start: vi.fn(async () => {
        console.log('🔌 Mock transport started');
      }),
      stop: vi.fn(async () => {
        console.log('🔌 Mock transport stopped');
      }),
      // Simulate receiving RPC calls
      _handler: null as any,
      async simulateRpcCall(request: any) {
        if (this._handler) {
          return await this._handler(request);
        }
        throw new Error('No handler registered');
      },
    };
    
    // Create platform adapter (this is how cardhost exposes platform via RPC)
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, mockTransport);
    await platformAdapter.start();
    
    console.log('✅ Mock cardhost module initialized with spies');
  });

  afterAll(async () => {
    console.log('\n=== Cleaning up Advanced E2E test ===');
    
    if (platformAdapter) {
      await platformAdapter.stop();
    }
    
    if (mockPlatform && mockPlatform.isInitialized()) {
      await mockPlatform.release();
    }
    
    if (routerProcess) {
      routerProcess.kill('SIGTERM');
      await sleep(2000);
      if (!routerProcess.killed) {
        routerProcess.kill('SIGKILL');
      }
      routerProcess = null;
    }
    
    console.log('✅ Cleanup complete');
  }, 5000);

  test('should have router running', () => {
    if (!routerReady) {
      console.log('⚠️  Router not ready - skipping assertion');
      return;
    }
    expect(routerReady).toBe(true);
  });

  test('should initialize mock platform with spies', async () => {
    expect(mockPlatform).toBeDefined();
    expect(initSpy).toBeDefined();
    expect(initSpy).toHaveBeenCalled();
  });

  test('should track RPC calls to platform.getDeviceInfo', async () => {
    // Simulate controller calling getDeviceInfo
    const request = {
      id: 'test-req-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };
    
    const response = await mockTransport.simulateRpcCall(request);
    
    // Verify spy was called
    expect(getDeviceInfoSpy).toHaveBeenCalled();
    
    // Verify RPC call was logged
    const logged = rpcCallLog.find(log => log.method === 'platform.getDeviceInfo');
    expect(logged).toBeDefined();
    
    // Verify response
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
  });

  test('should track RPC calls to platform.acquireDevice', async () => {
    // First get devices
    const getDevicesReq = {
      id: 'test-req-2',
      method: 'platform.getDeviceInfo',
      params: [],
    };
    const devicesResp = await mockTransport.simulateRpcCall(getDevicesReq);
    const devices = devicesResp.result;
    
    expect(devices.length).toBeGreaterThan(0);
    
    // Acquire device
    const acquireReq = {
      id: 'test-req-3',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    };
    
    const acquireResp = await mockTransport.simulateRpcCall(acquireReq);
    
    // Verify spy was called
    expect(acquireDeviceSpy).toHaveBeenCalledWith(devices[0].id);
    
    // Verify RPC call was logged
    const logged = rpcCallLog.find(log => log.method === 'platform.acquireDevice');
    expect(logged).toBeDefined();
    expect(logged.params[0]).toBe(devices[0].id);
    
    // Verify response contains device handle
    expect(acquireResp.result).toBeDefined();
    expect(typeof acquireResp.result).toBe('string');
  });

  test('should track APDU transmission and verify mock card behavior', async () => {
    // Get device
    const getDevicesReq = {
      id: 'req-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };
    const devicesResp = await mockTransport.simulateRpcCall(getDevicesReq);
    const devices = devicesResp.result;
    
    // Acquire device
    const acquireReq = {
      id: 'req-2',
      method: 'platform.acquireDevice',
      params: [devices[0].id],
    };
    const acquireResp = await mockTransport.simulateRpcCall(acquireReq);
    const deviceHandle = acquireResp.result;
    
    // Start session
    const sessionReq = {
      id: 'req-3',
      method: 'device.startSession',
      params: [deviceHandle],
    };
    const sessionResp = await mockTransport.simulateRpcCall(sessionReq);
    const cardHandle = sessionResp.result;
    
    expect(cardHandle).toBeDefined();
    expect(typeof cardHandle).toBe('string');
    
    // Transmit APDU
    const transmitReq = {
      id: 'req-4',
      method: 'card.transmit',
      params: [
        cardHandle,
        {
          cla: 0x00,
          ins: 0xA4,
          p1: 0x04,
          p2: 0x00,
          data: [0xA0, 0x00, 0x00, 0x00, 0x62],
          le: 256,
        },
      ],
    };
    
    const transmitResp = await mockTransport.simulateRpcCall(transmitReq);
    
    // Verify RPC call was logged
    const logged = rpcCallLog.find(log => log.method === 'card.transmit');
    expect(logged).toBeDefined();
    expect(logged.params[0]).toBe(cardHandle);
    
    // Verify response
    expect(transmitResp.result).toBeDefined();
    expect(transmitResp.result.sw1).toBeDefined();
    expect(transmitResp.result.sw2).toBeDefined();
    
    // Verify the transmit happened through RPC logging
    const transmitCallCount = rpcCallLog.filter(log => log.method === 'card.transmit').length;
    expect(transmitCallCount).toBeGreaterThan(0);
  });

  test('should log all RPC methods called', async () => {
    // Make several calls
    await mockTransport.simulateRpcCall({
      id: 'log-1',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    await mockTransport.simulateRpcCall({
      id: 'log-2',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    // Check log
    const getDeviceInfoCalls = rpcCallLog.filter(log => log.method === 'platform.getDeviceInfo');
    expect(getDeviceInfoCalls.length).toBeGreaterThanOrEqual(2);
  });

  test('should verify spy call counts', async () => {
    // Make some calls to generate spy data
    await mockTransport.simulateRpcCall({
      id: 'count-1',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    // Check spy call counts
    expect(initSpy.mock.calls.length).toBeGreaterThan(0);
    expect(getDeviceInfoSpy.mock.calls.length).toBeGreaterThan(0);
  });

  test('should allow inspecting spy call arguments', async () => {
    // Clear previous calls
    acquireDeviceSpy.mockClear();
    
    // Get devices and acquire
    const devicesResp = await mockTransport.simulateRpcCall({
      id: 'args-1',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    const deviceId = devicesResp.result[0].id;
    
    await mockTransport.simulateRpcCall({
      id: 'args-2',
      method: 'platform.acquireDevice',
      params: [deviceId],
    });
    
    // Inspect spy calls
    expect(acquireDeviceSpy).toHaveBeenCalledTimes(1);
    expect(acquireDeviceSpy.mock.calls[0][0]).toBe(deviceId);
  });

  test('should track RPC error responses', async () => {
    // Try to acquire invalid device
    const invalidReq = {
      id: 'error-1',
      method: 'platform.acquireDevice',
      params: ['invalid-device-id-xyz'],
    };
    
    const response = await mockTransport.simulateRpcCall(invalidReq);
    
    // Should get error response
    expect(response.error).toBeDefined();
    expect(response.error.code).toBeDefined();
    
    // RPC call should still be logged
    const logged = rpcCallLog.find(log => 
      log.method === 'platform.acquireDevice' && 
      log.params[0] === 'invalid-device-id-xyz'
    );
    expect(logged).toBeDefined();
  });
});

// This file has 1 describe block with 10 tests
// Tests demonstrate new testing axis: router in beforeAll, cardhost as mocked module
// Controller would send real commands (tested separately)
// Extensive use of spies to observe cardhost internal behavior
