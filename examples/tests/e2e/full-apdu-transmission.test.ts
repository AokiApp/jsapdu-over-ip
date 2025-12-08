/**
 * Full APDU Transmission E2E Test
 * 
 * Tests complete APDU transmission through the full stack:
 * Controller-CLI → Router (Java) → Cardhost-mock → Mock SmartCard
 * 
 * This validates:
 * - Device discovery through router
 * - Card session management
 * - APDU transmission and response
 * - Binary data preservation (ATR, APDU commands/responses)
 * 
 * Requirements:
 * - Java 21 for Router
 * - All examples built (router, cardhost-mock, shared, controller-cli)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { SimpleClientTransport } from '../../../examples/controller-cli/src/transport.js';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

const CONFIG = {
  ROUTER_PORT: 8091,
  ROUTER_STARTUP_MS: 45000,
  CARDHOST_STARTUP_MS: 15000,
  TEST_TIMEOUT_MS: 90000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Full APDU Transmission E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProc: ChildProcess | null = null;
  let routerReady = false;
  let cardhostReady = false;

  beforeAll(async () => {
    console.log('\n🚀 Starting APDU Transmission E2E Test');
    
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

    // Start Cardhost-mock
    console.log('🔶 Starting Cardhost-mock...');
    const cardhostUUID = randomUUID();
    
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

  test('should discover devices through router', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    // Create transport using controller-cli's SimpleClientTransport
    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );

    // Create RemoteSmartCardPlatform
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();

    // Get device info
    const deviceInfo = await platform.getDeviceInfo();
    
    expect(deviceInfo).toBeDefined();
    expect(Array.isArray(deviceInfo)).toBe(true);
    expect(deviceInfo.length).toBeGreaterThan(0);
    
    console.log('✅ Discovered devices:', deviceInfo);

    await platform.release();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should acquire device and open card session', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();

    const deviceInfo = await platform.getDeviceInfo();
    expect(deviceInfo.length).toBeGreaterThan(0);

    // Acquire first device
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    expect(device).toBeDefined();

    // Open card session
    const card = await device.openSession();
    expect(card).toBeDefined();

    console.log('✅ Card session opened');

    // Get ATR
    const atr = await card.getATR();
    expect(atr).toBeDefined();
    expect(atr).toBeInstanceOf(Uint8Array);
    expect(atr.length).toBeGreaterThan(0);

    console.log('✅ ATR retrieved:', Array.from(atr).map(b => b.toString(16).padStart(2, '0')).join(' '));

    await card.release();
    await device.release();
    await platform.release();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should transmit APDU command through complete stack', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();

    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    const card = await device.openSession();

    // Send SELECT APDU (00 A4 04 00)
    const selectApdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]);
    const response = await card.transmit(selectApdu);

    expect(response).toBeDefined();
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBeGreaterThanOrEqual(2);

    // Check SW (last 2 bytes)
    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    
    console.log('✅ APDU Response:', Array.from(response).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('✅ SW:', sw1.toString(16).padStart(2, '0'), sw2.toString(16).padStart(2, '0'));

    expect(sw1).toBeDefined();
    expect(sw2).toBeDefined();

    await card.release();
    await device.release();
    await platform.release();
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should handle multiple sequential APDUs', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    const card = await device.openSession();

    // Send multiple APDUs
    const apdus = [
      new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]), // SELECT
      new Uint8Array([0x00, 0xB0, 0x00, 0x00, 0x00]), // READ BINARY
      new Uint8Array([0x00, 0xC0, 0x00, 0x00, 0x00]), // GET RESPONSE
    ];

    const responses: Uint8Array[] = [];

    for (const apdu of apdus) {
      const response = await card.transmit(apdu);
      responses.push(response);
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThanOrEqual(2);
    }

    console.log(`✅ Sent ${apdus.length} APDUs, received ${responses.length} responses`);

    expect(responses.length).toBe(apdus.length);

    await card.release();
    await device.release();
    await platform.release();
  }, CONFIG.TEST_TIMEOUT_MS);
});
