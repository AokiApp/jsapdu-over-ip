/**
 * Real Cardhost E2E Test - In-Process with vi.mock()
 * 
 * Tests complete stack using REAL cardhost in SAME PROCESS:
 * Controller-CLI → Router (Java JAR) → REAL Cardhost (in-process, vi.mock platform) → Mock Platform
 * 
 * Key Improvements:
 * - Cardhost runs in SAME PROCESS as test (no node spawn)
 * - vi.mock() works correctly with in-process cardhost
 * - Faster startup, easier debugging
 * - Real Router JAR still spawned (java -jar)
 * - Complete request-response validation
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
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { randomUUID } from 'crypto';
import path from 'path';
import type { SmartCardPlatform, SmartCardDevice } from '@aokiapp/jsapdu-interface';
import { CommandApdu } from '@aokiapp/jsapdu-interface';

// Mock Platform with spy capabilities
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
    console.log(`[MockPlatform] init() called - count: ${this.initCalls}`);
  }
  
  async release(): Promise<void> {
    this.releaseCalls++;
    console.log(`[MockPlatform] release() called - count: ${this.releaseCalls}`);
  }
  
  async getDeviceInfo(): Promise<any[]> {
    this.getDeviceInfoCalls++;
    console.log(`[MockPlatform] getDeviceInfo() called - count: ${this.getDeviceInfoCalls}`);
    return this.devices;
  }
  
  async acquireDevice(deviceId: string): Promise<SmartCardDevice> {
    this.acquireDeviceCalls++;
    console.log(`[MockPlatform] acquireDevice(${deviceId}) called - count: ${this.acquireDeviceCalls}`);
    return {
      deviceId,
      getCardPresence: async () => ({ present: true }),
      openSession: async () => ({
        getATR: async () => {
          console.log('[MockCard] getATR() called');
          return new Uint8Array([0x3B, 0x00]);
        },
        transmit: async (apdu: any) => {
          console.log('[MockCard] transmit() called with APDU');
          return { data: new Uint8Array([0x90, 0x00]), sw1: 0x90, sw2: 0x00 };
        },
        reset: async () => {
          console.log('[MockCard] reset() called');
          return new Uint8Array([0x3B, 0x00]);
        },
        release: async () => {
          console.log('[MockCard] release() called');
        }
      }),
      release: async () => {
        console.log('[MockDevice] release() called');
      }
    };
  }
}

// Mock the platform module - this will be used by cardhost when imported
const mockPlatformInstance = new SpyWrappedMockPlatform();
vi.mock('../../../examples/cardhost/src/platform.js', () => ({
  getPlatform: vi.fn(async () => {
    console.log('[vi.mock] getPlatform() called - returning SpyWrappedMockPlatform');
    return mockPlatformInstance;
  })
}));

const CONFIG = {
  ROUTER_PORT: 8097,
  ROUTER_STARTUP_MS: 60000,
  CARDHOST_STARTUP_MS: 5000, // Faster - no process spawn
  TEST_TIMEOUT_MS: 120000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Real Cardhost In-Process + Real Router JAR E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostInstance: any = null;
  let routerReady = false;
  let cardhostReady = false;
  const cardhostUUID = randomUUID();

  beforeAll(async () => {
    console.log('\n=== Starting E2E Test Setup ===');
    console.log(`Cardhost UUID: ${cardhostUUID}`);
    console.log(`Router Port: ${CONFIG.ROUTER_PORT}`);

    // Check Java availability
    const javaHome = CONFIG.JAVA_HOME;
    const javaPath = path.join(javaHome, 'bin', 'java');
    console.log(`Using Java: ${javaPath}`);

    // Build Router JAR path
    const routerPath = path.resolve(process.cwd(), 'examples/router');
    const routerJar = path.join(routerPath, 'build/quarkus-app/quarkus-run.jar');
    console.log(`Router JAR: ${routerJar}`);

    // Start Router JAR (separate process - still needed for routing)
    console.log('\n--- Starting Router JAR ---');
    routerProc = spawn(javaPath, ['-jar', routerJar], {
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        QUARKUS_HTTP_PORT: String(CONFIG.ROUTER_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for Router to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Router startup timeout')), CONFIG.ROUTER_STARTUP_MS);
      
      routerProc!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[Router] ${output.trim()}`);
        if (output.includes('Listening on:') || output.includes('started in')) {
          routerReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      routerProc!.stderr?.on('data', (data) => {
        console.error(`[Router Error] ${data.toString().trim()}`);
      });

      routerProc!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log('✅ Router is ready');

    // Start Cardhost IN-PROCESS using new library mode!
    console.log('\n--- Starting Cardhost IN-PROCESS (Library Mode) ---');
    
    // Import startCardhost from cardhost
    const { startCardhost } = await import('../../../examples/cardhost/dist/index.js');
    
    // Get platform using vi.mock'd module
    const { getPlatform } = await import('../../../examples/cardhost/src/platform.js');
    const platform = await getPlatform();
    await platform.init();
    console.log('Platform obtained via vi.mock and initialized');

    // Start cardhost in library mode with mocked platform
    cardhostInstance = await startCardhost({
      routerUrl: `ws://localhost:${CONFIG.ROUTER_PORT}/api`,
      uuid: cardhostUUID,
      platform: platform, // Provide vi.mock'd platform
    });
    
    console.log('✅ Cardhost started in library mode');
    
    // Wait a bit for registration
    await sleep(CONFIG.CARDHOST_STARTUP_MS);
    cardhostReady = true;
    console.log('✅ Cardhost is ready\n');

  }, CONFIG.TEST_TIMEOUT_MS);

  afterAll(async () => {
    console.log('\n=== Cleanup ===');
    
    if (cardhostInstance) {
      try {
        await cardhostInstance.stop();
        console.log('✅ Cardhost stopped');
      } catch (err) {
        console.error('Error stopping cardhost:', err);
      }
    }

    if (routerProc) {
      routerProc.kill('SIGTERM');
      await sleep(2000);
      if (!routerProc.killed) {
        routerProc.kill('SIGKILL');
      }
      console.log('✅ Router stopped');
    }
  });

  test('should complete request-response cycle through Router to in-process Cardhost', async () => {
    expect(routerReady).toBe(true);
    expect(cardhostReady).toBe(true);

    console.log('\n--- Test: Complete Request-Response Cycle ---');

    // Create controller client
    const transport = new SimpleClientTransport(`ws://localhost:${CONFIG.ROUTER_PORT}/api`, cardhostUUID);
    const platform = new RemoteSmartCardPlatform(transport);

    await transport.connect();
    console.log('Controller connected to Router');

    // Initialize platform
    await platform.init();
    console.log('✅ Platform initialized');
    expect(mockPlatformInstance.initCalls).toBeGreaterThan(0);

    // Get device info
    const deviceInfo = await platform.getDeviceInfo();
    console.log('Device info received:', deviceInfo);
    expect(deviceInfo).toBeDefined();
    expect(Array.isArray(deviceInfo)).toBe(true);
    expect(deviceInfo.length).toBeGreaterThan(0);
    expect(mockPlatformInstance.getDeviceInfoCalls).toBeGreaterThan(0);

    await transport.disconnect();
    console.log('✅ Test completed successfully');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should transmit APDU through complete stack', async () => {
    expect(routerReady).toBe(true);
    expect(cardhostReady).toBe(true);

    console.log('\n--- Test: APDU Transmission ---');

    const transport = new SimpleClientTransport(`ws://localhost:${CONFIG.ROUTER_PORT}/api`, cardhostUUID);
    const platform = new RemoteSmartCardPlatform(transport);

    await transport.connect();
    await platform.init();

    // Acquire device
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    console.log('Device acquired');
    expect(mockPlatformInstance.acquireDeviceCalls).toBeGreaterThan(0);

    // Open session
    const session = await device.openSession();
    console.log('Session opened');

    // Get ATR
    const atr = await session.getATR();
    console.log('ATR received:', atr);
    expect(atr instanceof Uint8Array).toBe(true);

    // Transmit APDU
    const apdu = new CommandApdu(0x00, 0xA4, 0x04, 0x00, new Uint8Array([0x01, 0x02]), 256);
    const response = await session.transmit(apdu);
    console.log('APDU response received');
    expect(response).toBeDefined();
    expect(response.sw).toBe(0x9000);

    await session.release();
    await device.release();
    await transport.disconnect();
    console.log('✅ APDU transmission test completed');
  }, CONFIG.TEST_TIMEOUT_MS);
}, CONFIG.TEST_TIMEOUT_MS);
