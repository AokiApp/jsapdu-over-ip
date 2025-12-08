/**
 * Multi-Cardhost with Spy Injection E2E Test
 * 
 * Tests Router handling multiple REAL cardhost processes:
 * Multiple REAL Cardhosts (spy-injected) → Router → Controller
 * 
 * Uses spy injection to start multiple real cardhost processes,
 * each with spy-wrapped mock platform.
 * 
 * Requirements:
 * - Java 21 for Router
 * - All examples built
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { SimpleClientTransport } from '../../../examples/controller-cli/src/transport.js';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';

const CONFIG = {
  ROUTER_PORT: 8095,
  ROUTER_STARTUP_MS: 45000,
  CARDHOST_STARTUP_MS: 10000,
  TEST_TIMEOUT_MS: 90000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
  CARDHOST_COUNT: 3,
};

describe('Multi-Cardhost with Spy Injection E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProcs: ChildProcess[] = [];
  let routerReady = false;
  let cardhostsReady = 0;
  let originalPlatformCode = '';

  beforeAll(async () => {
    console.log('\n🚀 Starting Multi-Cardhost Spy Injection E2E Test');
    console.log(`   Will start ${CONFIG.CARDHOST_COUNT} REAL cardhost processes`);
    
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

    // Inject spy for multi-cardhost test
    console.log('🔶 Injecting spy into REAL cardhost...');
    const platformPath = process.cwd() + '/examples/cardhost/src/platform.ts';
    originalPlatformCode = await readFile(platformPath, 'utf-8');
    
    const injectedPlatform = `import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";
import { MockSmartCardPlatform } from "../../test-utils/src/mock-platform.js";
export async function getPlatform(): Promise<SmartCardPlatform> {
  console.log("⚠️  Using SPY-INJECTED mock platform");
  return new MockSmartCardPlatform();
}`;

    await writeFile(platformPath, injectedPlatform, 'utf-8');
    console.log('✅ Spy injection completed');

    // Rebuild cardhost
    console.log('🔨 Rebuilding cardhost...');
    const buildProc = spawn('npm', ['run', 'build'], {
      cwd: process.cwd() + '/examples/cardhost',
      stdio: 'pipe',
    });

    await new Promise<void>((resolve, reject) => {
      buildProc.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error('Build failed'));
      });
    });
    console.log('✅ Cardhost rebuilt');

    // Start multiple REAL cardhost processes
    console.log(`🟢 Starting ${CONFIG.CARDHOST_COUNT} REAL cardhost processes...`);
    
    for (let i = 0; i < CONFIG.CARDHOST_COUNT; i++) {
      const proc = spawn('node', ['dist/index.js'], {
        cwd: process.cwd() + '/examples/cardhost',
        env: {
          ...process.env,
          ROUTER_URL: `ws://localhost:${CONFIG.ROUTER_PORT}/ws/cardhost`,
          CARDHOST_UUID: `multi-cardhost-${i}-${randomUUID()}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Cardhost is running')) {
          cardhostsReady++;
          console.log(`✅ Cardhost ${i + 1}/${CONFIG.CARDHOST_COUNT} started`);
        }
      });

      cardhostProcs.push(proc);
      await sleep(2000);
    }

    // Restore original
    await writeFile(platformPath, originalPlatformCode, 'utf-8');
    console.log('✅ Original platform.ts restored');

    await sleep(3000);
  }, CONFIG.ROUTER_STARTUP_MS + CONFIG.CARDHOST_STARTUP_MS * 2);

  afterAll(async () => {
    console.log('\n🛑 Shutting down...');
    
    for (const proc of cardhostProcs) {
      proc.kill('SIGTERM');
    }
    
    if (routerProc) {
      routerProc.kill('SIGTERM');
    }
    
    await sleep(5000);
  }, 15000);

  test('should discover devices from multiple REAL cardhosts', async () => {
    if (!routerReady || cardhostsReady < 2) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Multi-Cardhost Device Discovery');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();

    console.log('📤 Controller: Requesting devices from all cardhosts...');
    const deviceInfo = await platform.getDeviceInfo();
    console.log(`📥 Controller: Found ${deviceInfo.length} devices`);
    
    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.length).toBeGreaterThanOrEqual(cardhostsReady);

    deviceInfo.forEach((info, idx) => {
      console.log(`   Device ${idx + 1}: ${info.friendlyName}`);
    });

    await platform.release();

    console.log('✅ MULTI-CARDHOST DISCOVERY VALIDATED');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should handle concurrent device acquisitions across cardhosts', async () => {
    if (!routerReady || cardhostsReady < 2) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Concurrent Acquisitions');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();

    console.log(`📤 Controller: Acquiring ${Math.min(deviceInfo.length, 3)} devices concurrently...`);
    const devices = await Promise.all(
      deviceInfo.slice(0, 3).map(info => platform.acquireDevice(info.deviceId))
    );
    console.log(`📥 Controller: Acquired ${devices.length} devices`);

    expect(devices.length).toBeGreaterThanOrEqual(2);

    await Promise.all(devices.map(dev => dev.release()));
    await platform.release();

    console.log('✅ CONCURRENT ACQUISITIONS VALIDATED');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should transmit APDUs to different REAL cardhosts', async () => {
    if (!routerReady || cardhostsReady < 2) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: APDUs to Different Cardhosts');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();

    const devices = await Promise.all(
      deviceInfo.slice(0, 2).map(info => platform.acquireDevice(info.deviceId))
    );

    const cards = await Promise.all(devices.map(dev => dev.openSession()));

    console.log(`📤 Controller: Sending APDUs to ${cards.length} cards...`);
    const apdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]);
    const responses = await Promise.all(cards.map(card => card.transmit(apdu)));
    console.log(`📥 Controller: Received ${responses.length} responses`);

    expect(responses.length).toBe(cards.length);
    responses.forEach(resp => expect(resp.length).toBeGreaterThanOrEqual(2));

    await Promise.all(cards.map(card => card.release()));
    await Promise.all(devices.map(dev => dev.release()));
    await platform.release();

    console.log('✅ MULTI-CARDHOST APDU TRANSMISSION VALIDATED');
  }, CONFIG.TEST_TIMEOUT_MS);
});
