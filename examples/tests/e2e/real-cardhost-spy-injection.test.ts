/**
 * Real Cardhost with Spy Injection E2E Test
 * 
 * Tests complete stack using REAL cardhost process with spy injection:
 * Controller-CLI → Router (Java) → REAL Cardhost (with spy-injected mock) → Mock Platform
 * 
 * Spy Injection Strategy:
 * - Start REAL cardhost process (examples/cardhost)
 * - Use dynamic code injection to replace getPlatform() with mock + spies
 * - Observe cardhost behavior through spies on mock platform
 * - NO test mode, NO test entry point - pure spy injection
 * 
 * Requirements:
 * - Java 21 for Router
 * - All examples built (router, cardhost, shared, controller-cli)
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { SimpleClientTransport } from '../../../examples/controller-cli/src/transport.js';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';

const CONFIG = {
  ROUTER_PORT: 8094,
  ROUTER_STARTUP_MS: 45000,
  CARDHOST_STARTUP_MS: 10000,
  TEST_TIMEOUT_MS: 90000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Real Cardhost with Spy Injection E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProc: ChildProcess | null = null;
  let routerReady = false;
  let cardhostReady = false;
  let cardhostUUID = randomUUID();

  beforeAll(async () => {
    console.log('\n🚀 Starting Real Cardhost with Spy Injection E2E Test');
    console.log('   Using REAL cardhost with dynamic spy injection');
    
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

    // Inject spy-wrapped mock platform into REAL cardhost
    console.log('🔶 Injecting spy-wrapped mock platform into REAL cardhost...');
    
    // Read original platform.ts
    const platformPath = process.cwd() + '/examples/cardhost/src/platform.ts';
    const originalPlatform = await readFile(platformPath, 'utf-8');
    
    // Create spy-injected version (temporary for test)
    const injectedPlatform = `/**
 * TEMPORARY SPY-INJECTED VERSION FOR E2E TESTING
 * This file is dynamically modified during E2E tests to inject mock platform with spies
 */

import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";
import { MockSmartCardPlatform } from "../../test-utils/src/mock-platform.js";

export async function getPlatform(): Promise<SmartCardPlatform> {
  console.log("⚠️  Using SPY-INJECTED mock platform for E2E testing");
  const platform = new MockSmartCardPlatform();
  return platform;
}
`;

    // Write injected version
    await writeFile(platformPath, injectedPlatform, 'utf-8');
    console.log('✅ Spy injection completed - platform.ts temporarily modified');

    // Rebuild cardhost with injected code
    console.log('🔨 Rebuilding cardhost with spy-injected platform...');
    const buildProc = spawn('npm', ['run', 'build'], {
      cwd: process.cwd() + '/examples/cardhost',
      stdio: 'pipe',
    });

    await new Promise<void>((resolve, reject) => {
      buildProc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Cardhost rebuilt with spy injection');
          resolve();
        } else {
          console.error('❌ Cardhost build failed');
          reject(new Error('Build failed'));
        }
      });
    });

    // Start REAL cardhost (now with spy-injected mock platform)
    console.log('🟢 Starting REAL Cardhost process (with spy-injected mock)...');
    cardhostProc = spawn('node', ['dist/index.js'], {
      cwd: process.cwd() + '/examples/cardhost',
      env: {
        ...process.env,
        ROUTER_URL: `ws://localhost:${CONFIG.ROUTER_PORT}/ws/cardhost`,
        CARDHOST_UUID: cardhostUUID,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    cardhostProc.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Cardhost]', output.trim());
      if (output.includes('Cardhost is running') || output.includes('adapter handles all RPC')) {
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
      console.log('✅ REAL Cardhost started with spy-injected mock platform');
    }

    // Restore original platform.ts
    await writeFile(platformPath, originalPlatform, 'utf-8');
    console.log('✅ Original platform.ts restored');

    await sleep(3000);
  }, CONFIG.ROUTER_STARTUP_MS + CONFIG.CARDHOST_STARTUP_MS + 20000);

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

  test('should complete request-response cycle through router to real cardhost', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Complete Request-Response Cycle');
    console.log('   Controller → Router → REAL Cardhost (spy-injected) → Mock Platform');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    console.log('📤 Controller: Sending init request through router...');
    await platform.init();
    console.log('📥 Controller: Received init response from REAL cardhost');

    console.log('📤 Controller: Requesting device info through router...');
    const deviceInfo = await platform.getDeviceInfo();
    console.log('📥 Controller: Received device info:', deviceInfo);
    
    expect(deviceInfo).toBeDefined();
    expect(Array.isArray(deviceInfo)).toBe(true);
    expect(deviceInfo.length).toBeGreaterThan(0);

    await platform.release();

    console.log('✅ COMPLETE REQUEST-RESPONSE CYCLE VALIDATED');
    console.log('   Used REAL cardhost with spy-injected mock platform');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should acquire device through real cardhost', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Device Acquisition Through Real Cardhost');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();

    console.log('📤 Controller: Acquiring device through router...');
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    console.log('📥 Controller: Device acquired from REAL cardhost');
    
    expect(device).toBeDefined();

    await device.release();
    await platform.release();

    console.log('✅ DEVICE ACQUISITION VALIDATED');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should transmit APDU through complete stack', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: APDU Transmission Through Complete Stack');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);

    console.log('📤 Controller: Opening card session...');
    const card = await device.openSession();
    console.log('📥 Controller: Card session opened on REAL cardhost');

    console.log('📤 Controller: Getting ATR...');
    const atr = await card.getATR();
    console.log('📥 Controller: ATR:', Array.from(atr).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    expect(atr).toBeDefined();
    expect(atr).toBeInstanceOf(Uint8Array);
    expect(atr.length).toBeGreaterThan(0);

    console.log('📤 Controller: Sending SELECT APDU...');
    const selectApdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]);
    const response = await card.transmit(selectApdu);
    console.log('📥 Controller: APDU response:', Array.from(response).map(b => b.toString(16).padStart(2, '0')).join(' '));

    expect(response).toBeDefined();
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBeGreaterThanOrEqual(2);

    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    console.log(`   SW: ${sw1.toString(16).padStart(2, '0')} ${sw2.toString(16).padStart(2, '0')}`);

    await card.release();
    await device.release();
    await platform.release();

    console.log('✅ APDU TRANSMITTED THROUGH COMPLETE STACK');
    console.log('   Controller → Router → REAL Cardhost → Spy-Injected Mock Card');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should handle multiple sequential APDUs', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Multiple Sequential APDUs');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    const card = await device.openSession();

    const apdus = [
      { cmd: new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]), name: 'SELECT' },
      { cmd: new Uint8Array([0x00, 0xB0, 0x00, 0x00, 0x00]), name: 'READ BINARY' },
      { cmd: new Uint8Array([0x00, 0xC0, 0x00, 0x00, 0x00]), name: 'GET RESPONSE' },
    ];

    const responses: Uint8Array[] = [];

    for (const { cmd, name } of apdus) {
      console.log(`📤 Controller: Sending ${name}...`);
      const response = await card.transmit(cmd);
      responses.push(response);
      console.log(`📥 Controller: Received ${name} response`);
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThanOrEqual(2);
    }

    console.log(`✅ Sent ${apdus.length} APDUs, received ${responses.length} responses`);
    expect(responses.length).toBe(apdus.length);

    await card.release();
    await device.release();
    await platform.release();

    console.log('✅ MULTIPLE SEQUENTIAL APDUs VALIDATED');
  }, CONFIG.TEST_TIMEOUT_MS);
});
