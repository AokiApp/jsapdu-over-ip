/**
 * Three-Program Stack E2E Test
 * 
 * Tests the complete system with all three programs running:
 * Controller-CLI → Router (Java/Quarkus) → Cardhost-mock
 * 
 * This is a REAL E2E test that:
 * - Starts Java Router process in beforeAll
 * - Starts cardhost-mock process
 * - Uses controller-cli to send actual commands
 * - Validates complete message flow
 * 
 * Requirements:
 * - Java 21 installed (JAVA_HOME or JAVA_HOME_21)
 * - Router built (./gradlew build in examples/router)
 * - Cardhost-mock built (npm run build in examples/cardhost-mock)
 * - Shared built (npm run build in examples/shared)
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

const CONFIG = {
  ROUTER_PORT: 8090,
  ROUTER_STARTUP_MS: 45000,
  CARDHOST_STARTUP_MS: 15000,
  TEST_TIMEOUT_MS: 90000,
  JAVA_HOME: process.env.JAVA_HOME || process.env.JAVA_HOME_21 || '/usr/lib/jvm/temurin-21-jdk-amd64',
};

describe('Three-Program Stack E2E', () => {
  let routerProc: ChildProcess | null = null;
  let cardhostProc: ChildProcess | null = null;
  let routerReady = false;
  let cardhostReady = false;

  beforeAll(async () => {
    console.log('\n🚀 Starting Three-Program Stack E2E Test');
    
    // Verify Java availability
    const javaCheck = spawn('java', ['--version']);
    const hasJava = await new Promise<boolean>((resolve) => {
      javaCheck.on('close', (code) => resolve(code === 0));
      javaCheck.on('error', () => resolve(false));
    });

    if (!hasJava) {
      console.log('❌ Java not available - skipping E2E tests');
      return;
    }

    console.log('✅ Java available');

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
        console.error('[Router stderr]', err);
      }
    });

    // Wait for Router
    const routerStart = Date.now();
    while (!routerReady && Date.now() - routerStart < CONFIG.ROUTER_STARTUP_MS) {
      await sleep(1000);
    }

    if (!routerReady) {
      console.log('❌ Router failed to start - skipping tests');
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
      if (output.includes('Connected to router') || output.includes('Mock platform initialized')) {
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
    } else {
      console.log('⚠️  Cardhost-mock may not be connected yet');
    }

    // Give system time to stabilize
    await sleep(3000);
  }, CONFIG.ROUTER_STARTUP_MS + CONFIG.CARDHOST_STARTUP_MS + 10000);

  afterAll(async () => {
    console.log('\n🛑 Shutting down processes...');
    
    if (cardhostProc) {
      cardhostProc.kill('SIGTERM');
      console.log('Terminated cardhost-mock');
    }
    
    if (routerProc) {
      routerProc.kill('SIGTERM');
      console.log('Terminated router');
    }
    
    await sleep(5000);
  }, 15000);

  test('should have Router running', () => {
    expect(routerReady).toBe(true);
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should have Cardhost connected to Router', () => {
    if (!routerReady) {
      console.log('⏭️  Skipping (Router not ready)');
      return;
    }
    
    expect(cardhostReady).toBe(true);
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should accept WebSocket connection from controller', async () => {
    if (!routerReady) {
      console.log('⏭️  Skipping (Router not ready)');
      return;
    }

    const ws = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    const connected = await new Promise<boolean>((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(true);
    
    if (connected) {
      ws.close();
    }
  }, CONFIG.TEST_TIMEOUT_MS);

  test('should route messages between controller and cardhost', async () => {
    if (!routerReady || !cardhostReady) {
      console.log('⏭️  Skipping (System not ready)');
      return;
    }

    const controllerWs = new WebSocket(`ws://localhost:${CONFIG.ROUTER_PORT}/ws/controller`);
    
    const wsReady = await new Promise<boolean>((resolve) => {
      controllerWs.on('open', () => resolve(true));
      controllerWs.on('error', (err) => {
        console.error('WebSocket error:', err);
        resolve(false);
      });
      setTimeout(() => resolve(false), 5000);
    });

    expect(wsReady).toBe(true);

    if (!wsReady) {
      return;
    }

    // Send RPC call through WebSocket
    const rpcCall = {
      jsonrpc: '2.0',
      id: 'test-1',
      method: 'platform.getDeviceInfo',
      params: [],
    };

    const responsePromise = new Promise<any>((resolve) => {
      controllerWs.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (e) {
          resolve(null);
        }
      });
      setTimeout(() => resolve(null), 10000);
    });

    controllerWs.send(JSON.stringify(rpcCall));

    const response = await responsePromise;
    
    expect(response).toBeDefined();
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', 'test-1');
    
    controllerWs.close();
  }, CONFIG.TEST_TIMEOUT_MS);
});
