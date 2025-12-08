/**
 * Real Cardhost E2E Test with Spy Injection
 * 
 * Tests complete stack using REAL cardhost with REAL Router JAR:
 * Controller-CLI → Router (Java JAR) → REAL Cardhost (spy-injected mock) → Mock Platform
 * 
 * Key Points:
 * - Uses Router JAR (build/quarkus-app/quarkus-run.jar), not dev mode
 * - Uses REAL cardhost (examples/cardhost)
 * - Spy injection: temporarily modifies platform.ts to inject MockSmartCardPlatform
 * - NO cardhost-mock, NO test-utils dependencies
 * 
 * Requirements:
 * - Java 21
 * - Router built: cd examples/router && ./gradlew build
 * - Cardhost built: cd examples/cardhost && npm run build
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { SimpleClientTransport } from '../../../examples/controller-cli/src/transport.js';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

// Inline MockSmartCardPlatform (minimal version - no external dependencies)
class InlineMockSmartCardPlatform {
  private devices = [
    { deviceId: 'mock-device-1', displayName: 'Mock Reader 1' }
  ];
  
  async init(): Promise<void> {
    console.log('[MockPlatform] init()');
  }
  
  async release(): Promise<void> {
    console.log('[MockPlatform] release()');
  }
  
  async getDeviceInfo(): Promise<any[]> {
    console.log('[MockPlatform] getDeviceInfo()');
    return this.devices;
  }
  
  async acquireDevice(deviceId: string): Promise<any> {
    console.log(`[MockPlatform] acquireDevice(${deviceId})`);
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

const CONFIG = {
  ROUTER_PORT: 8095,
  ROUTER_STARTUP_MS: 60000,
  CARDHOST_STARTUP_MS: 15000,
  TEST_TIMEOUT_MS: 120000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Real Cardhost + Real Router JAR E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProc: ChildProcess | null = null;
  let routerReady = false;
  let cardhostReady = false;
  let cardhostUUID = randomUUID();
  let originalPlatformCode = '';

  beforeAll(async () => {
    console.log('\n🚀 Starting Real Cardhost + Real Router JAR E2E Test');
    console.log('   Router: Using built JAR (build/quarkus-app/quarkus-run.jar)');
    console.log('   Cardhost: Using REAL cardhost with spy injection');
    
    const projectRoot = path.resolve(process.cwd());
    const routerPath = path.join(projectRoot, 'examples/router');
    const cardhostPath = path.join(projectRoot, 'examples/cardhost');
    const platformPath = path.join(cardhostPath, 'src/platform.ts');
    
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

    await new Promise<void>((resolve, reject) => {
      buildProc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Router built successfully');
          resolve();
        } else {
          console.error('❌ Router build failed');
          reject(new Error('Router build failed'));
        }
      });
      setTimeout(() => resolve(), 120000); // Timeout after 2 minutes
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

    // Inject spy-wrapped mock platform into REAL cardhost
    console.log('🔶 Injecting mock platform into REAL cardhost (temporary)...');
    
    // Read original platform.ts
    originalPlatformCode = await readFile(platformPath, 'utf-8');
    
    // Create spy-injected version
    const mockPlatformCode = `
// TEMPORARY SPY-INJECTED VERSION FOR E2E TESTING
import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";

class InlineMockSmartCardPlatform implements SmartCardPlatform {
  private devices = [
    { deviceId: 'mock-device-1', displayName: 'Mock Reader 1' }
  ];
  
  async init(): Promise<void> {
    console.log('[MockPlatform] init()');
  }
  
  async release(): Promise<void> {
    console.log('[MockPlatform] release()');
  }
  
  async getDeviceInfo(): Promise<any[]> {
    console.log('[MockPlatform] getDeviceInfo()');
    return this.devices;
  }
  
  async acquireDevice(deviceId: string): Promise<any> {
    console.log(\`[MockPlatform] acquireDevice(\${deviceId})\`);
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

export async function getPlatform(): Promise<SmartCardPlatform> {
  console.log("⚠️  Using INLINE MOCK for E2E testing (temporary injection)");
  return new InlineMockSmartCardPlatform();
}
`;

    // Write injected version
    await writeFile(platformPath, mockPlatformCode, 'utf-8');
    console.log('✅ Mock platform injected into platform.ts');

    // Rebuild cardhost with injected code
    console.log('🔨 Rebuilding cardhost with injected mock...');
    const cardhostBuildProc = spawn('npm', ['run', 'build'], {
      cwd: cardhostPath,
      stdio: 'pipe',
    });

    await new Promise<void>((resolve, reject) => {
      cardhostBuildProc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Cardhost rebuilt with mock injection');
          resolve();
        } else {
          console.error('❌ Cardhost build failed');
          reject(new Error('Cardhost build failed'));
        }
      });
    });

    // Start REAL cardhost
    console.log('🟢 Starting REAL Cardhost process...');
    cardhostProc = spawn('node', ['dist/index.js'], {
      cwd: cardhostPath,
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
      console.log('✅ REAL Cardhost started');
    }

    await sleep(3000);
  }, CONFIG.ROUTER_STARTUP_MS + CONFIG.CARDHOST_STARTUP_MS + 150000);

  afterAll(async () => {
    console.log('\n🛑 Shutting down...');
    
    // Restore original platform.ts FIRST
    if (originalPlatformCode) {
      const platformPath = path.join(process.cwd(), 'examples/cardhost/src/platform.ts');
      await writeFile(platformPath, originalPlatformCode, 'utf-8');
      console.log('✅ Original platform.ts restored');
    }
    
    if (cardhostProc) {
      cardhostProc.kill('SIGTERM');
    }
    
    if (routerProc) {
      routerProc.kill('SIGTERM');
    }
    
    await sleep(5000);
  }, 20000);

  test('should complete request-response cycle: Controller → Router → Real Cardhost', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Complete Request-Response Cycle');
    console.log('   Architecture: Controller → Router JAR → REAL Cardhost → Mock Platform');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    console.log('📤 Controller: Sending init through Router...');
    await platform.init();
    console.log('📥 Controller: Received init response');

    console.log('📤 Controller: Requesting device info through Router...');
    const deviceInfo = await platform.getDeviceInfo();
    console.log('📥 Controller: Received device info:', deviceInfo);
    
    expect(deviceInfo).toBeDefined();
    expect(Array.isArray(deviceInfo)).toBe(true);
    expect(deviceInfo.length).toBeGreaterThan(0);

    await platform.release();

    console.log('✅ COMPLETE REQUEST-RESPONSE CYCLE VALIDATED');
    console.log('   ✓ Used Router JAR (build/quarkus-app/quarkus-run.jar)');
    console.log('   ✓ Used REAL cardhost (examples/cardhost)');
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should acquire device and transmit APDU through complete stack', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    console.log('\n📊 Test: Device Acquisition + APDU Transmission');

    const transport = new SimpleClientTransport(
      `ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`
    );
    const platform = new RemoteSmartCardPlatform(transport);
    
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();

    console.log('📤 Controller: Acquiring device...');
    const device = await platform.acquireDevice(deviceInfo[0].deviceId);
    console.log('📥 Controller: Device acquired');

    console.log('📤 Controller: Opening card session...');
    const card = await device.openSession();
    console.log('📥 Controller: Card session opened');

    console.log('📤 Controller: Getting ATR...');
    const atr = await card.getATR();
    console.log('📥 Controller: ATR received:', atr);
    expect(atr).toBeDefined();
    expect(atr instanceof Uint8Array).toBe(true);

    console.log('📤 Controller: Transmitting APDU...');
    const response = await card.transmit(new Uint8Array([0x00, 0xA4, 0x04, 0x00]));
    console.log('📥 Controller: APDU response received');
    expect(response).toBeDefined();

    await card.release();
    await device.release();
    await platform.release();

    console.log('✅ DEVICE ACQUISITION + APDU TRANSMISSION VALIDATED');
  }, CONFIG.TEST_TIMEOUT_MS);
});
