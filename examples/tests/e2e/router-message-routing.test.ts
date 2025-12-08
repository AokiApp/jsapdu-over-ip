/**
 * Router Message Routing E2E Test
 * 
 * This test validates Router's message routing capabilities:
 * - Router started in beforeAll
 * - Cardhost imported as module with extensive spies
 * - Controller sends real commands (no mocks)
 * - Observe cardhost behavior through spies
 * 
 * This approach allows:
 * - Deep inspection of cardhost internals
 * - Validation of RPC method calls
 * - Tracking of state changes
 * - Performance measurement
 * 
 * Requirements:
 * - Java 21 for Router
 * - Router built
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { RouterServerTransport } from '../../../examples/cardhost-mock/src/router-transport.js';
import { getOrCreateKeyPair } from '../../../examples/cardhost-mock/src/key-manager.js';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { join } from 'path';

const CONFIG = {
  ROUTER_PORT: 8092,
  ROUTER_STARTUP_MS: 45000,
  TEST_TIMEOUT_MS: 90000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Router Message Routing with Cardhost Spying', () => {
  let routerProc: ChildProcess | null = null;
  let routerReady = false;
  
  // Cardhost components (imported as modules, not processes)
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let cardhostTransport: RouterServerTransport;
  
  // Spies for observing cardhost behavior
  let platformInitSpy: ReturnType<typeof vi.spyOn>;
  let platformReleaseSpy: ReturnType<typeof vi.spyOn>;
  let platformGetDeviceInfoSpy: ReturnType<typeof vi.spyOn>;
  let platformAcquireDeviceSpy: ReturnType<typeof vi.spyOn>;
  
  // RPC call log
  const rpcCalls: any[] = [];

  beforeAll(async () => {
    console.log('\n🚀 Starting Router Message Routing E2E Test');
    
    // Check Java
    const javaCheck = spawn('java', ['--version']);
    const hasJava = await new Promise<boolean>((resolve) => {
      javaCheck.on('close', (code) => resolve(code === 0));
      javaCheck.on('error', () => resolve(false));
    });

    if (!hasJava) {
      console.log('❌ Java not available');
      return;
    }

    // Start Router
    console.log(`🔷 Starting Router on port ${CONFIG.ROUTER_PORT}...`);
    routerProc = spawn(
      './gradlew',
      ['quarkusDev', `-Dquarkus.http.port=${CONFIG.ROUTER_PORT}`],
      {
        cwd: process.cwd() + '/examples/router',
        env: { ...process.env, JAVA_HOME: CONFIG.JAVA_HOME },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    routerProc.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Listening on:') || output.includes('started in')) {
        routerReady = true;
        console.log('✅ Router started');
      }
    });

    routerProc.stderr?.on('data', (data) => {
      const err = data.toString();
      if (!err.includes('Picked up JAVA_TOOL_OPTIONS')) {
        console.error('[Router]', err);
      }
    });

    // Wait for Router
    const routerStart = Date.now();
    while (!routerReady && Date.now() - routerStart < CONFIG.ROUTER_STARTUP_MS) {
      await sleep(1000);
    }

    if (!routerReady) {
      console.log('❌ Router failed to start');
      return;
    }

    await sleep(2000);

    // Start Cardhost as MODULE (not process) with spies
    console.log('🔶 Starting Cardhost as module with spies...');
    
    // Create real MockSmartCardPlatform
    mockPlatform = MockSmartCardPlatform.getInstance();
    
    // Set up spies BEFORE initializing
    platformInitSpy = vi.spyOn(mockPlatform, 'init');
    platformReleaseSpy = vi.spyOn(mockPlatform, 'release');
    platformGetDeviceInfoSpy = vi.spyOn(mockPlatform, 'getDeviceInfo');
    platformAcquireDeviceSpy = vi.spyOn(mockPlatform, 'acquireDevice');
    
    // Initialize platform
    await mockPlatform.init();
    console.log('✅ Mock platform initialized with spies');

    // Create real key pair (from cardhost-mock's key-manager)
    const keyPath = join('/tmp', `router-test-keys-${Date.now()}`);
    const keyPair = await getOrCreateKeyPair(keyPath);
    console.log('✅ Key pair created');

    // Create RouterServerTransport (from cardhost-mock)
    const cardhostUUID = randomUUID();
    cardhostTransport = new RouterServerTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/cardhost`,
      cardhostUUID,
      keyPair
    );

    // Set up platform adapter
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, cardhostTransport);
    
    // Start adapter (this connects to router)
    await platformAdapter.start();
    console.log('✅ Cardhost adapter started and connected to router');

    await sleep(2000);
  }, CONFIG.ROUTER_STARTUP_MS + 15000);

  afterAll(async () => {
    console.log('\n🛑 Shutting down...');
    
    if (platformAdapter) {
      await platformAdapter.stop();
    }
    
    if (mockPlatform) {
      await mockPlatform.release();
    }
    
    if (routerProc) {
      routerProc.kill('SIGTERM');
    }
    
    await sleep(5000);
  }, 15000);

  beforeEach(() => {
    // Clear call logs between tests
    rpcCalls.length = 0;
    
    // Reset spy call counts
    platformInitSpy?.mockClear();
    platformReleaseSpy?.mockClear();
    platformGetDeviceInfoSpy?.mockClear();
    platformAcquireDeviceSpy?.mockClear();
  });

  test('should have Router and Cardhost connected', () => {
    expect(routerReady).toBe(true);
    expect(mockPlatform).toBeDefined();
    expect(platformAdapter).toBeDefined();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should spy on platform.init call', () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    expect(platformInitSpy).toHaveBeenCalled();
    expect(platformInitSpy).toHaveBeenCalledTimes(1);
    
    console.log('✅ platform.init was called', platformInitSpy.mock.calls.length, 'time(s)');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should observe platform.getDeviceInfo through controller', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    const ws = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
      setTimeout(() => resolve(), 5000);
    });

    // Send getDeviceInfo RPC call
    const rpcCall = {
      jsonrpc: '2.0',
      id: 'spy-test-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };

    const responsePromise = new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 'spy-test-1') {
            resolve(response);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
      setTimeout(() => resolve(null), 10000);
    });

    ws.send(JSON.stringify(rpcCall));

    const response = await responsePromise;
    
    // Verify spy was called
    expect(platformGetDeviceInfoSpy).toHaveBeenCalled();
    expect(platformGetDeviceInfoSpy.mock.calls.length).toBeGreaterThan(0);
    
    console.log('✅ platform.getDeviceInfo called', platformGetDeviceInfoSpy.mock.calls.length, 'time(s)');
    console.log('✅ Response:', response?.result);

    ws.close();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should track RPC call sequence through spies', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    const ws = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
      setTimeout(() => resolve(), 5000);
    });

    // Send multiple RPC calls
    const calls = [
      { id: 'seq-1', method: 'platform.getDeviceInfo', params: [] },
      { id: 'seq-2', method: 'platform.getDeviceInfo', params: [] },
    ];

    const responses: any[] = [];

    for (const call of calls) {
      const responsePromise = new Promise<any>((resolve) => {
        const handler = (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.id === call.id) {
              ws.off('message', handler);
              resolve(response);
            }
          } catch (e) {
            // Ignore
          }
        };
        ws.on('message', handler);
        setTimeout(() => resolve(null), 10000);
      });

      ws.send(JSON.stringify({ jsonrpc: '2.0', ...call }));
      const response = await responsePromise;
      responses.push(response);
    }

    // Verify spies tracked all calls
    expect(platformGetDeviceInfoSpy.mock.calls.length).toBeGreaterThanOrEqual(calls.length);
    
    console.log('✅ Tracked', platformGetDeviceInfoSpy.mock.calls.length, 'platform.getDeviceInfo calls');
    console.log('✅ Received', responses.filter(r => r !== null).length, 'responses');

    ws.close();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should measure RPC call performance with spies', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    const ws = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
      setTimeout(() => resolve(), 5000);
    });

    const startTime = Date.now();

    const rpcCall = {
      jsonrpc: '2.0',
      id: 'perf-test',
      method: 'platform.getDeviceInfo',
      params: [],
    };

    const responsePromise = new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 'perf-test') {
            resolve(response);
          }
        } catch (e) {
          // Ignore
        }
      });
      setTimeout(() => resolve(null), 10000);
    });

    ws.send(JSON.stringify(rpcCall));
    const response = await responsePromise;
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response).toBeDefined();
    expect(platformGetDeviceInfoSpy).toHaveBeenCalled();
    
    console.log('✅ Round-trip time:', duration, 'ms');
    console.log('✅ Call was observed by spy');

    // Performance should be reasonable (< 5 seconds)
    expect(duration).toBeLessThan(5000);

    ws.close();
  }, CONFIG.TEST_TIMEOUT_MS);
});
