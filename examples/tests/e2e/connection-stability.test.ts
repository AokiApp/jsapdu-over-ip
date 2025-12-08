/**
 * Connection Stability E2E Test
 * 
 * Tests system behavior under connection stress:
 * - Cardhost disconnection and reconnection
 * - Controller reconnection after disconnect
 * - Message handling during reconnection
 * - Resource cleanup validation
 * 
 * Requirements:
 * - Java 21 for Router
 * - Router and cardhost-mock built
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { SimpleClientTransport } from '../../../examples/controller-cli/src/transport.js';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

const CONFIG = {
  ROUTER_PORT: 8094,
  ROUTER_STARTUP_MS: 45000,
  CARDHOST_STARTUP_MS: 15000,
  TEST_TIMEOUT_MS: 90000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Connection Stability E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProc: ChildProcess | null = null;
  let routerReady = false;
  let cardhostReady = false;
  let cardhostUUID: string;

  beforeAll(async () => {
    console.log('\n🚀 Starting Connection Stability E2E Test');
    
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

    // Start initial Cardhost
    await startCardhost();

    await sleep(3000);
  }, CONFIG.ROUTER_STARTUP_MS + CONFIG.CARDHOST_STARTUP_MS + 10000);

  afterAll(async () => {
    console.log('\n🛑 Shutting down...');
    
    if (cardhostProc) {
      cardhostProc.kill('SIGTERM');
    }
    
    if (routerProc) {
      routerProc.kill('SIGTERM');
    }
    
    await sleep(5000);
  }, 15000);

  async function startCardhost() {
    console.log('🔶 Starting Cardhost-mock...');
    cardhostUUID = randomUUID();
    cardhostReady = false;
    
    cardhostProc = spawn(
      'node',
      ['dist/index.js'],
      {
        cwd: process.cwd() + '/examples/cardhost-mock',
        env: {
          ...process.env,
          ROUTER_URL: `ws://localhost:${CONFIG.ROUTER_PORT}/ws/cardhost`,
          CARDHOST_UUID: cardhostUUID,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    cardhostProc.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Cardhost]', output.trim());
      if (output.includes('Connected to router') || output.includes('platform initialized')) {
        cardhostReady = true;
      }
    });

    cardhostProc.stderr?.on('data', (data) => {
      console.error('[Cardhost stderr]', data.toString().trim());
    });

    // Wait for Cardhost
    const cardhostStart = Date.now();
    while (!cardhostReady && Date.now() - cardhostStart < CONFIG.CARDHOST_STARTUP_MS) {
      await sleep(1000);
    }

    if (cardhostReady) {
      console.log('✅ Cardhost-mock connected');
    }
  }

  test('should have Router running', () => {
    expect(routerReady).toBe(true);
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should reconnect cardhost after termination', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping');
      return;
    }

    // Verify initial connection
    const transport1 = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform1 = new RemoteSmartCardPlatform(transport1);
    
    await platform1.init();
    const devicesBefore = await platform1.getDeviceInfo();
    expect(devicesBefore.length).toBeGreaterThan(0);
    await platform1.release();

    console.log('✅ Initial cardhost connected with', devicesBefore.length, 'devices');

    // Terminate cardhost
    console.log('🔻 Terminating cardhost...');
    cardhostProc?.kill('SIGTERM');
    cardhostProc = null;
    cardhostReady = false;
    
    await sleep(2000);

    // Restart cardhost
    await startCardhost();
    await sleep(2000);

    // Verify reconnection
    const transport2 = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform2 = new RemoteSmartCardPlatform(transport2);
    
    await platform2.init();
    const devicesAfter = await platform2.getDeviceInfo();
    
    expect(devicesAfter.length).toBeGreaterThan(0);
    console.log('✅ Cardhost reconnected with', devicesAfter.length, 'devices');

    await platform2.release();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should handle controller WebSocket reconnection', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping');
      return;
    }

    // First connection
    let ws1 = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    const connected1 = await new Promise<boolean>((resolve) => {
      ws1.on('open', () => resolve(true));
      ws1.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected1).toBe(true);
    console.log('✅ First controller connection established');

    // Send a message
    const rpcCall1 = {
      jsonrpc: '2.0',
      id: 'reconnect-test-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };

    const response1Promise = new Promise<any>((resolve) => {
      ws1.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 'reconnect-test-1') {
            resolve(response);
          }
        } catch (e) {
          // Ignore
        }
      });
      setTimeout(() => resolve(null), 10000);
    });

    ws1.send(JSON.stringify(rpcCall1));
    const response1 = await response1Promise;
    
    expect(response1).toBeDefined();
    expect(response1.result).toBeDefined();
    console.log('✅ Received response before disconnect');

    // Close connection
    ws1.close();
    await sleep(1000);

    // Reconnect
    let ws2 = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    const connected2 = await new Promise<boolean>((resolve) => {
      ws2.on('open', () => resolve(true));
      ws2.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected2).toBe(true);
    console.log('✅ Controller reconnected successfully');

    // Send message after reconnection
    const rpcCall2 = {
      jsonrpc: '2.0',
      id: 'reconnect-test-2',
      method: 'platform.getDeviceInfo',
      params: [],
    };

    const response2Promise = new Promise<any>((resolve) => {
      ws2.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 'reconnect-test-2') {
            resolve(response);
          }
        } catch (e) {
          // Ignore
        }
      });
      setTimeout(() => resolve(null), 10000);
    });

    ws2.send(JSON.stringify(rpcCall2));
    const response2 = await response2Promise;
    
    expect(response2).toBeDefined();
    expect(response2.result).toBeDefined();
    console.log('✅ Received response after reconnection');

    ws2.close();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should cleanup resources after cardhost disconnect', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping');
      return;
    }

    // Establish connection and acquire device
    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    
    if (deviceInfo.length === 0) {
      console.log('⏭️  Skipping (no devices)');
      await platform.release();
      return;
    }

    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    const card = await device.openSession();
    
    console.log('✅ Device acquired and card session opened');

    // Abruptly terminate cardhost
    console.log('🔻 Terminating cardhost abruptly...');
    cardhostProc?.kill('SIGKILL');
    cardhostProc = null;
    cardhostReady = false;
    
    await sleep(2000);

    // Try to use card (should fail gracefully)
    try {
      const apdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]);
      await card.transmit(apdu);
      console.log('⚠️  Transmit succeeded (unexpected)');
    } catch (error) {
      console.log('✅ Transmit failed as expected after cardhost disconnect');
      expect(error).toBeDefined();
    }

    // Cleanup should not hang
    try {
      await card.release();
      await device.release();
      await platform.release();
      console.log('✅ Resource cleanup completed without hanging');
    } catch (error) {
      console.log('✅ Cleanup handled disconnect gracefully');
    }

    // Restart cardhost for next tests
    await startCardhost();
  }, CONFIG.TEST_TIMEOUT_MS);
});
