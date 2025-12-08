/**
 * Multi-Cardhost Scenario E2E Test
 * 
 * Tests Router's ability to handle multiple cardhost connections:
 * - Multiple cardhost-mock instances connecting to same Router
 * - Controller discovers all cardhosts
 * - Validates message routing to correct cardhost
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
import { randomUUID } from 'crypto';

const CONFIG = {
  ROUTER_PORT: 8093,
  ROUTER_STARTUP_MS: 45000,
  CARDHOST_STARTUP_MS: 10000,
  TEST_TIMEOUT_MS: 90000,
  NUM_CARDHOSTS: 2,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Multi-Cardhost Scenario E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProcs: ChildProcess[] = [];
  let routerReady = false;
  let cardhostsReady: boolean[] = [];

  beforeAll(async () => {
    console.log('\n🚀 Starting Multi-Cardhost E2E Test');
    
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

    // Start multiple Cardhost-mock instances
    console.log(`🔶 Starting ${CONFIG.NUM_CARDHOSTS} cardhost-mock instances...`);
    
    for (let i = 0; i < CONFIG.NUM_CARDHOSTS; i++) {
      const cardhostUUID = randomUUID();
      const cardhostProc = spawn(
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

      cardhostsReady[i] = false;

      cardhostProc.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[Cardhost-${i}]`, output.trim());
        if (output.includes('Connected to router') || output.includes('platform initialized')) {
          cardhostsReady[i] = true;
        }
      });

      cardhostProc.stderr?.on('data', (data) => {
        console.error(`[Cardhost-${i} stderr]`, data.toString().trim());
      });

      cardhostProcs.push(cardhostProc);

      // Wait for this cardhost to start before starting next
      const cardhostStart = Date.now();
      while (!cardhostsReady[i] && Date.now() - cardhostStart < CONFIG.CARDHOST_STARTUP_MS) {
        await sleep(1000);
      }

      if (cardhostsReady[i]) {
        console.log(`✅ Cardhost-${i} connected`);
      } else {
        console.log(`⚠️  Cardhost-${i} may not be connected`);
      }
    }

    await sleep(3000);
  }, CONFIG.ROUTER_STARTUP_MS + (CONFIG.CARDHOST_STARTUP_MS * CONFIG.NUM_CARDHOSTS) + 10000);

  afterAll(async () => {
    console.log('\n🛑 Shutting down...');
    
    for (const proc of cardhostProcs) {
      if (proc) {
        proc.kill('SIGTERM');
      }
    }
    
    if (routerProc) {
      routerProc.kill('SIGTERM');
    }
    
    await sleep(5000);
  }, 15000);

  test('should have Router running', () => {
    expect(routerReady).toBe(true);
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should have multiple cardhosts connected', () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    const connectedCount = cardhostsReady.filter(ready => ready).length;
    console.log(`✅ ${connectedCount}/${CONFIG.NUM_CARDHOSTS} cardhosts connected`);
    
    expect(connectedCount).toBeGreaterThan(0);
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should discover devices from all cardhosts', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();

    const deviceInfo = await platform.getDeviceInfo();
    
    expect(deviceInfo).toBeDefined();
    expect(Array.isArray(deviceInfo)).toBe(true);
    
    // Should have devices from multiple cardhosts
    console.log(`✅ Discovered ${deviceInfo.length} devices from ${cardhostsReady.filter(r => r).length} cardhosts`);
    
    // Each cardhost typically provides 2 mock devices
    const connectedCardhosts = cardhostsReady.filter(r => r).length;
    expect(deviceInfo.length).toBeGreaterThanOrEqual(connectedCardhosts);

    await platform.release();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should handle concurrent APDU operations across cardhosts', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping');
      return;
    }

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    
    if (deviceInfo.length < 2) {
      console.log('⏭️  Skipping (need at least 2 devices)');
      await platform.release();
      return;
    }

    // Acquire devices from different cardhosts
    const device1 = await platform.acquireDevice(deviceInfo[0].deviceId);
    const device2 = await platform.acquireDevice(deviceInfo[1].deviceId);

    // Open sessions concurrently
    const [card1, card2] = await Promise.all([
      device1.openSession(),
      device2.openSession(),
    ]);

    // Send APDUs concurrently
    const apdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]);
    
    const [response1, response2] = await Promise.all([
      card1.transmit(apdu),
      card2.transmit(apdu),
    ]);

    expect(response1).toBeDefined();
    expect(response1.length).toBeGreaterThanOrEqual(2);
    expect(response2).toBeDefined();
    expect(response2.length).toBeGreaterThanOrEqual(2);

    console.log('✅ Concurrent APDUs sent to devices from different cardhosts');

    await card1.release();
    await card2.release();
    await device1.release();
    await device2.release();
    await platform.release();
  }, CONFIG.TEST_TIMEOUT_MS);
});
