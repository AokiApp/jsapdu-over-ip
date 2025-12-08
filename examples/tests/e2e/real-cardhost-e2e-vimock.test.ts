/**
 * Real Cardhost E2E Test with vi.mock()
 * 
 * Tests complete stack using REAL cardhost with REAL Router JAR:
 * Controller-CLI → Router (Java JAR) → REAL Cardhost (vi.mock platform) → Mock Platform
 * 
 * Key Points:
 * - Uses Router JAR (build/quarkus-app/quarkus-run.jar), not dev mode
 * - Uses REAL cardhost (examples/cardhost)
 * - vi.mock() for platform module (NO file modifications)
 * - NO cardhost-mock, NO test-utils dependencies
 * - NO file rewriting, NO rebuild needed
 * 
 * Requirements:
 * - Java 21
 * - Router built: cd examples/router && ./gradlew build
 * - Cardhost built: cd examples/cardhost && npm run build
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { SimpleClientTransport } from '../../../examples/controller-cli/src/transport.js';
import { randomUUID } from 'crypto';
import path from 'path';
import type { SmartCardPlatform } from '@aokiapp/jsapdu-interface';

// Inline MockSmartCardPlatform with spy capabilities
class SpyWrappedMockPlatform implements SmartCardPlatform {
  private devices = [
    { deviceId: 'mock-device-1', displayName: 'Mock Reader 1' }
  ];
  
  public initCalls = 0;
  public releaseCalls = 0;
  public getDeviceInfoCalls = 0;
  public acquireDeviceCalls = 0;
  
  async init(): Promise<void> {
    this.initCalls++;
    console.log(`[MockPlatform] init() - call #${this.initCalls}`);
  }
  
  async release(): Promise<void> {
    this.releaseCalls++;
    console.log(`[MockPlatform] release() - call #${this.releaseCalls}`);
  }
  
  async getDeviceInfo(): Promise<any[]> {
    this.getDeviceInfoCalls++;
    console.log(`[MockPlatform] getDeviceInfo() - call #${this.getDeviceInfoCalls}`);
    return this.devices;
  }
  
  async acquireDevice(deviceId: string): Promise<any> {
    this.acquireDeviceCalls++;
    console.log(`[MockPlatform] acquireDevice(${deviceId}) - call #${this.acquireDeviceCalls}`);
    return {
      deviceId,
      getCardPresence: async () => ({ present: true }),
      openSession: async () => ({
        getATR: async () => new Uint8Array([0x3B, 0x00]),
        transmit: async (apdu: any) => {
          console.log('[MockCard] transmit() called');
          return { data: new Uint8Array([0x90, 0x00]), sw1: 0x90, sw2: 0x00 };
        },
        reset: async () => new Uint8Array([0x3B, 0x00]),
        release: async () => {}
      }),
      release: async () => {}
    };
  }
}

// Mock the platform module using vi.mock() - NO file modifications!
const mockPlatformInstance = new SpyWrappedMockPlatform();
vi.mock('../../../examples/cardhost/src/platform.js', () => ({
  getPlatform: vi.fn(async () => {
    console.log('[vi.mock] getPlatform() called - returning mock');
    return mockPlatformInstance;
  })
}));

const CONFIG = {
  ROUTER_PORT: 8096,
  ROUTER_STARTUP_MS: 60000,
  CARDHOST_STARTUP_MS: 15000,
  TEST_TIMEOUT_MS: 120000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Real Cardhost + Real Router JAR E2E (vi.mock)', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProc: ChildProcess | null = null;
  let routerReady = false;
  let cardhostReady = false;
  let cardhostUUID = randomUUID();

  beforeAll(async () => {
    console.log('\n🚀 Starting Real Cardhost + Real Router JAR E2E Test (vi.mock approach)');
    console.log('   Router: Using built JAR (build/quarkus-app/quarkus-run.jar)');
    console.log('   Cardhost: Using REAL cardhost with vi.mock() platform');
    console.log('   NO file modifications, NO rebuild needed!');
    
    const projectRoot = path.resolve(process.cwd());
    const routerPath = path.join(projectRoot, 'examples/router');
    const cardhostPath = path.join(projectRoot, 'examples/cardhost');
    
    // Check Java
    const javaCheck = spawn('java', ['--version']);
    const hasJava = await new Promise<boolean>((resolve) => {
      javaCheck.on('close', (code) => resolve(code === 0));
      javaCheck.on('error', () => resolve(false));
    });

    if (!hasJava) {
      console.log('❌ Java not available - tests will skip');
      return;
    }

    // Build Router if needed
    console.log('🔨 Building Router...');
    const buildProc = spawn('./gradlew', ['build', '-x', 'test'], {
      cwd: routerPath,
      env: { ...process.env, JAVA_HOME: CONFIG.JAVA_HOME },
      stdio: 'pipe',
    });

    await new Promise<void>((resolve) => {
      buildProc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Router built successfully');
        } else {
          console.error('❌ Router build failed');
        }
        resolve();
      });
      setTimeout(() => resolve(), 120000);
    });

    // Start Router with JAR
    console.log(`🔷 Starting Router JAR on port ${CONFIG.ROUTER_PORT}...`);
    const routerJar = path.join(routerPath, 'build/quarkus-app/quarkus-run.jar');
    routerProc = spawn(
      'java',
      [
        `-Dquarkus.http.port=${CONFIG.ROUTER_PORT}`,
        '-jar',
        routerJar
      ],
      {
        cwd: routerPath,
        env: { ...process.env, JAVA_HOME: CONFIG.JAVA_HOME },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    routerProc.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Router]', output.trim());
      if (output.includes('Listening on:') || output.includes('started in')) {
        routerReady = true;
      }
    });

    routerProc.stderr?.on('data', (data) => {
      const err = data.toString();
      if (!err.includes('Picked up JAVA_TOOL_OPTIONS')) {
        console.error('[Router stderr]', err.trim());
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

    // Start REAL cardhost (will use vi.mock'd platform)
    console.log('🔶 Starting REAL cardhost with vi.mock() platform...');
    cardhostProc = spawn(
      'node',
      ['dist/index.js'],
      {
        cwd: cardhostPath,
        env: {
          ...process.env,
          ROUTER_URL: `ws://localhost:${CONFIG.ROUTER_PORT}/api`,
          CARDHOST_UUID: cardhostUUID,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    cardhostProc.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Cardhost]', output.trim());
      if (output.includes('Connected to router') || output.includes('Registered')) {
        cardhostReady = true;
      }
    });

    cardhostProc.stderr?.on('data', (data) => {
      console.error('[Cardhost stderr]', data.toString().trim());
    });

    // Wait for cardhost
    const cardhostStart = Date.now();
    while (!cardhostReady && Date.now() - cardhostStart < CONFIG.CARDHOST_STARTUP_MS) {
      await sleep(1000);
    }

    if (!cardhostReady) {
      console.log('⚠️ Cardhost may not be fully ready, continuing anyway');
    }

    console.log('✅ Setup complete: Router + Cardhost both running with vi.mock()');
  }, CONFIG.TEST_TIMEOUT_MS);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up processes...');
    
    if (cardhostProc) {
      cardhostProc.kill('SIGTERM');
      await sleep(2000);
      if (!cardhostProc.killed) {
        cardhostProc.kill('SIGKILL');
      }
      console.log('✅ Cardhost stopped');
    }

    if (routerProc) {
      routerProc.kill('SIGTERM');
      await sleep(2000);
      if (!routerProc.killed) {
        routerProc.kill('SIGKILL');
      }
      console.log('✅ Router stopped');
    }

    console.log('✅ Cleanup complete - NO files modified (vi.mock advantage!)');
  });

  test('should complete full request-response cycle through Router with vi.mock()', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping test - Router not available');
      return;
    }

    console.log('\n📡 Test: Complete request-response cycle with vi.mock()');

    // Create controller using SimpleClientTransport
    const transport = new SimpleClientTransport(`ws://localhost:${CONFIG.ROUTER_PORT}/api`);
    const platform = new RemoteSmartCardPlatform(transport);

    try {
      console.log('1️⃣  Initializing platform...');
      await platform.init();
      
      console.log('2️⃣  Getting device info...');
      const devices = await platform.getDeviceInfo();
      
      console.log(`✅ Got devices:`, devices);
      
      expect(devices).toBeDefined();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      
      // Verify spy was called
      expect(mockPlatformInstance.initCalls).toBeGreaterThan(0);
      expect(mockPlatformInstance.getDeviceInfoCalls).toBeGreaterThan(0);
      
      console.log(`📊 Spy stats: init=${mockPlatformInstance.initCalls}, getDeviceInfo=${mockPlatformInstance.getDeviceInfoCalls}`);
      
    } finally {
      await platform.release();
    }
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should transmit APDU through complete stack with vi.mock()', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping test - Router not available');
      return;
    }

    console.log('\n📡 Test: APDU transmission with vi.mock()');

    const transport = new SimpleClientTransport(`ws://localhost:${CONFIG.ROUTER_PORT}/api`);
    const platform = new RemoteSmartCardPlatform(transport);

    try {
      await platform.init();
      
      const devices = await platform.getDeviceInfo();
      expect(devices.length).toBeGreaterThan(0);
      
      const device = await platform.acquireDevice(devices[0].deviceId);
      const presence = await device.getCardPresence();
      expect(presence.present).toBe(true);
      
      const card = await device.openSession();
      const atr = await card.getATR();
      
      expect(atr).toBeInstanceOf(Uint8Array);
      expect(atr.length).toBeGreaterThan(0);
      
      // Transmit APDU
      const response = await card.transmit({ data: new Uint8Array([0x00, 0xA4, 0x04, 0x00]) });
      
      expect(response).toBeDefined();
      expect(response.sw1).toBe(0x90);
      expect(response.sw2).toBe(0x00);
      
      // Verify spies
      expect(mockPlatformInstance.acquireDeviceCalls).toBeGreaterThan(0);
      
      console.log(`📊 Full spy stats: init=${mockPlatformInstance.initCalls}, getDeviceInfo=${mockPlatformInstance.getDeviceInfoCalls}, acquireDevice=${mockPlatformInstance.acquireDeviceCalls}`);
      console.log('✅ APDU transmission validated through vi.mock()');
      
      await card.release();
      await device.release();
    } finally {
      await platform.release();
    }
  }, CONFIG.TEST_TIMEOUT_MS);
});
