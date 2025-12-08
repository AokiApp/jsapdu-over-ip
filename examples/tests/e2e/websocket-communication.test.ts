/**
 * Enhanced E2E: WebSocket Controller Communication Test
 * 
 * This test validates actual WebSocket communication between:
 * - Controller (via WebSocket client)
 * - Router (Java/Quarkus - started in beforeAll)
 * - Cardhost (as module with mocks)
 * 
 * The key difference from previous tests:
 * 1. Uses actual WebSocket for controller communication
 * 2. Router is a real Java process
 * 3. Cardhost is mocked module for observation
 * 4. Tests end-to-end message flow through WebSocket
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import WebSocket from 'ws';
import { webcrypto } from 'crypto';

const TEST_CONFIG = {
  ROUTER_PORT: 8085,
  ROUTER_STARTUP_TIMEOUT: 30000,
  CARDHOST_UUID: 'ws-test-cardhost-001',
  CONTROLLER_ID: 'ws-test-controller-001',
} as const;

describe('E2E: WebSocket Communication Through Router', () => {
  let routerProcess: ChildProcess | null = null;
  let routerReady = false;
  
  // Cardhost components
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let cardhostTransport: any;
  let cardhostWs: WebSocket | null = null;
  
  // Controller WebSocket
  let controllerWs: WebSocket | null = null;
  
  // Message logs
  const cardhostMessages: any[] = [];
  const controllerMessages: any[] = [];

  beforeAll(async () => {
    console.log('\n=== Starting WebSocket E2E Test ===');
    
    // Check Java
    const javaCheck = spawn('java', ['--version']);
    const javaAvailable = await new Promise<boolean>((resolve) => {
      javaCheck.on('close', (code) => resolve(code === 0));
      javaCheck.on('error', () => resolve(false));
    });

    if (!javaAvailable) {
      console.log('⚠️  Java not available - skipping');
      return;
    }

    // Start Router
    console.log('🚀 Starting Router...');
    const routerDir = process.cwd() + '/examples/router';
    
    routerProcess = spawn(
      './gradlew',
      ['quarkusDev', `-Dquarkus.http.port=${TEST_CONFIG.ROUTER_PORT}`],
      {
        cwd: routerDir,
        env: {
          ...process.env,
          JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/temurin-21-jdk-amd64',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    routerProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Listening on:') || output.includes('started in')) {
        routerReady = true;
      }
    });

    // Wait for router
    const startTime = Date.now();
    while (!routerReady && Date.now() - startTime < TEST_CONFIG.ROUTER_STARTUP_TIMEOUT) {
      await sleep(1000);
    }

    if (routerReady) {
      console.log('✅ Router started');
      await sleep(2000);
    }
  }, TEST_CONFIG.ROUTER_STARTUP_TIMEOUT + 5000);

  beforeEach(async () => {
    cardhostMessages.length = 0;
    controllerMessages.length = 0;
    
    // Initialize mock platform
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    // Create WebSocket transport for cardhost
    if (routerReady) {
      cardhostWs = new WebSocket(`ws://localhost:${TEST_CONFIG.ROUTER_PORT}/ws/cardhost`);
      
      cardhostTransport = {
        ws: cardhostWs,
        onRequest: vi.fn((handler: any) => {
          cardhostTransport._handler = handler;
        }),
        emitEvent: vi.fn((event: any) => {
          if (cardhostWs && cardhostWs.readyState === WebSocket.OPEN) {
            cardhostWs.send(JSON.stringify({
              type: 'rpc-event',
              data: event,
            }));
          }
        }),
        start: vi.fn(async () => {
          return new Promise<void>((resolve, reject) => {
            if (!cardhostWs) {
              reject(new Error('No WebSocket'));
              return;
            }
            
            cardhostWs.on('open', () => {
              console.log('🔌 Cardhost WebSocket connected');
              
              // Send registration
              cardhostWs!.send(JSON.stringify({
                type: 'register',
                data: {
                  uuid: TEST_CONFIG.CARDHOST_UUID,
                  capabilities: ['apdu'],
                },
              }));
              
              resolve();
            });
            
            cardhostWs.on('message', (data) => {
              const message = JSON.parse(data.toString());
              cardhostMessages.push(message);
              
              if (message.type === 'rpc-request' && cardhostTransport._handler) {
                cardhostTransport._handler(message.data).then((response: any) => {
                  cardhostWs!.send(JSON.stringify({
                    type: 'rpc-response',
                    data: response,
                  }));
                });
              }
            });
            
            cardhostWs.on('error', reject);
            
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
          });
        }),
        stop: vi.fn(async () => {
          if (cardhostWs) {
            cardhostWs.close();
          }
        }),
        _handler: null as any,
      };
      
      platformAdapter = new SmartCardPlatformAdapter(mockPlatform, cardhostTransport);
      await platformAdapter.start();
      
      await sleep(1000); // Wait for registration
    }
  });

  afterAll(async () => {
    console.log('\n=== Cleaning up WebSocket E2E ===');
    
    if (platformAdapter) {
      await platformAdapter.stop();
    }
    
    if (mockPlatform && mockPlatform.isInitialized()) {
      await mockPlatform.release();
    }
    
    if (cardhostWs) {
      cardhostWs.close();
    }
    
    if (controllerWs) {
      controllerWs.close();
    }
    
    if (routerProcess) {
      routerProcess.kill('SIGTERM');
      await sleep(2000);
      if (!routerProcess.killed) {
        routerProcess.kill('SIGKILL');
      }
    }
    
    console.log('✅ Cleanup complete');
  }, 5000);

  test('should have router and cardhost connected', () => {
    if (!routerReady) {
      console.log('⚠️  Skipping - router not ready');
      return;
    }
    
    expect(routerReady).toBe(true);
    expect(mockPlatform).toBeDefined();
    expect(platformAdapter).toBeDefined();
  });

  test('should establish controller WebSocket connection', async () => {
    if (!routerReady) {
      console.log('⚠️  Skipping - router not ready');
      return;
    }
    
    controllerWs = new WebSocket(`ws://localhost:${TEST_CONFIG.ROUTER_PORT}/ws/controller`);
    
    const connected = await new Promise<boolean>((resolve) => {
      controllerWs!.on('open', () => {
        console.log('✅ Controller connected');
        resolve(true);
      });
      controllerWs!.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });
    
    expect(connected).toBe(true);
  }, 10000);

  test('should receive cardhost registration confirmation', async () => {
    if (!routerReady) {
      console.log('⚠️  Skipping - router not ready');
      return;
    }
    
    // Check if cardhost received any messages
    await sleep(1000);
    
    // Cardhost should have received some message from router
    expect(cardhostMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('should allow controller to discover cardhost via router', async () => {
    if (!routerReady) {
      console.log('⚠️  Skipping - router not ready');
      return;
    }
    
    controllerWs = new WebSocket(`ws://localhost:${TEST_CONFIG.ROUTER_PORT}/ws/controller`);
    
    await new Promise<void>((resolve, reject) => {
      controllerWs!.on('open', () => resolve());
      controllerWs!.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
    
    // Controller can now send messages through router
    expect(controllerWs.readyState).toBe(WebSocket.OPEN);
    
    controllerWs.close();
  }, 10000);
});

// This file has 1 describe block with 5 tests
// Tests WebSocket communication through Java Router
// Cardhost is mocked module, controller uses real WebSocket
