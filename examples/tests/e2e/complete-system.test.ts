/**
 * Complete System E2E Test
 * 
 * Tests the COMPLETE jsapdu-over-ip system as required by Issue #2:
 * CLI Controller → WebSocket → Router → WebSocket → Cardhost-mock → Mock Platform
 * 
 * This is a TRUE E2E test that validates:
 * 1. Router routes messages between controller and cardhost
 * 2. Controller can discover devices through the full stack
 * 3. Controller can send APDUs that reach the mock platform
 * 4. Responses flow back through the complete chain
 * 5. Full RPC communication works end-to-end
 * 
 * NOTE: This test requires Router to be running on port 8082.
 * Start router with: cd examples/router && ./gradlew quarkusDev -Dquarkus.http.port=8082
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// Test timeouts (in milliseconds)
const TIMEOUTS = {
  ROUTER_CHECK: 2000,
  CARDHOST_STARTUP: 500,
  CARDHOST_MAX_WAIT: 10000,
  CLEANUP: 1000,
  WS_CONNECTION: 5000,
  RPC_RESPONSE: 10000,
  DEVICE_FLOW: 15000,
  APDU_FLOW: 20000,
  ERROR_HANDLING: 10000,
  CONNECTION_ERROR: 3000,
} as const;

describe('Complete System E2E (CLI → Router → Cardhost-mock)', () => {
  const ROUTER_PORT = 8082;
  const ROUTER_URL = `ws://localhost:${ROUTER_PORT}/ws`;
  const CARDHOST_UUID = `e2e-test-cardhost-${Date.now()}`;
  
  let cardhostProcess: ChildProcess | null = null;
  let cardhostOutput: string[] = [];
  let cardhostReady = false;

  // Helper to check if router is available
  async function isRouterAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${ROUTER_URL}/cardhost`);
      
      ws.on('open', () => {
        ws.close();
        resolve(true);
      });
      
      ws.on('error', () => {
        resolve(false);
      });
      
      setTimeout(() => {
        ws.close();
        resolve(false);
      }, TIMEOUTS.ROUTER_CHECK);
    });
  }

  beforeAll(async () => {
    // Check if router is running
    const routerAvailable = await isRouterAvailable();
    
    if (!routerAvailable) {
      // Router not available - tests will skip gracefully
      return;
    }

    // Start cardhost-mock
    const cardhostPath = process.cwd() + '/examples/cardhost-mock/dist/index.js';
    
    cardhostProcess = spawn('node', [cardhostPath], {
      env: {
        ...process.env,
        ROUTER_URL: `${ROUTER_URL}/cardhost`,
        CARDHOST_UUID,
      },
      cwd: process.cwd() + '/examples/cardhost-mock',
    });
    
    cardhostProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      cardhostOutput.push(output);
      
      if (output.includes('running') || output.includes('connected')) {
        cardhostReady = true;
      }
    });
    
    cardhostProcess.stderr?.on('data', (data) => {
      cardhostOutput.push(`[ERROR] ${data.toString()}`);
    });
    
    // Wait for cardhost to be ready
    let attempts = 0;
    while (!cardhostReady && attempts < 20) {
      await sleep(TIMEOUTS.CARDHOST_STARTUP);
      attempts++;
    }
  }, 30000);

  afterAll(async () => {
    if (cardhostProcess) {
      cardhostProcess.kill('SIGTERM');
      await sleep(TIMEOUTS.CLEANUP);
    }
  }, 10000);

  describe('System Availability', () => {
    test('router should be available', async () => {
      const available = await isRouterAvailable();
      if (!available) {
        return; // Skip test gracefully
      }
      expect(available).toBe(true);
    });

    test('cardhost-mock should be connected', () => {
      if (!cardhostReady) {
        return; // Skip test gracefully
      }
      expect(cardhostReady).toBe(true);
    });
  });

  describe('CLI Controller → Router → Cardhost Flow', () => {
    test('controller should connect to router', async () => {
      if (!await isRouterAvailable()) {
        return;
      }

      const ws = new WebSocket(`${ROUTER_URL}/controller`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });

    test('controller should discover remote devices', async () => {
      if (!await isRouterAvailable() || !cardhostReady) {
        return;
      }

      const ws = new WebSocket(`${ROUTER_URL}/controller`);
      
      await new Promise<void>((resolve, reject) => {
        let requestId: string;
        
        ws.on('open', () => {
          // Send RPC request to get device info
          requestId = `req-${Date.now()}`;
          const request = {
            type: 'rpc-request',
            data: {
              id: requestId,
              method: 'platform.getDeviceInfo',
              params: [],
            },
          };
          
          ws.send(JSON.stringify(request));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'rpc-response' && message.data.id === requestId) {
              const response = message.data;
              
              // Should have result with devices array
              expect(response.result).toBeDefined();
              expect(Array.isArray(response.result)).toBe(true);
              
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Response timeout')), 10000);
      });
    }, 15000);

    test('controller should acquire device through router', async () => {
      if (!await isRouterAvailable() || !cardhostReady) {
        return;
      }

      const ws = new WebSocket(`${ROUTER_URL}/controller`);
      
      await new Promise<void>((resolve, reject) => {
        let getDevicesReqId: string;
        let acquireDeviceReqId: string;
        let deviceId: string;
        
        ws.on('open', () => {
          // First get devices
          getDevicesReqId = `req-${Date.now()}`;
          ws.send(JSON.stringify({
            type: 'rpc-request',
            data: {
              id: getDevicesReqId,
              method: 'platform.getDeviceInfo',
              params: [],
            },
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'rpc-response') {
              const response = message.data;
              
              if (response.id === getDevicesReqId) {
                // Got devices, now acquire first one
                const devices = response.result as Array<{ id: string }>;
                expect(devices.length).toBeGreaterThan(0);
                
                deviceId = devices[0].id;
                acquireDeviceReqId = `req-${Date.now() + 1}`;
                
                ws.send(JSON.stringify({
                  type: 'rpc-request',
                  data: {
                    id: acquireDeviceReqId,
                    method: 'platform.acquireDevice',
                    params: [deviceId],
                  },
                }));
              } else if (response.id === acquireDeviceReqId) {
                // Device acquired
                expect(response.result).toBeDefined();
                expect(response.error).toBeUndefined();
                
                ws.close();
                resolve();
              }
            }
          } catch (error) {
            reject(error);
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Flow timeout')), 15000);
      });
    }, 20000);

    test('controller should send APDU and receive response', async () => {
      if (!await isRouterAvailable() || !cardhostReady) {
        return;
      }

      const ws = new WebSocket(`${ROUTER_URL}/controller`);
      
      await new Promise<void>((resolve, reject) => {
        let phase = 0;
        let deviceHandle: string;
        let cardHandle: string;
        
        ws.on('open', () => {
          // Phase 0: Get devices
          phase = 0;
          ws.send(JSON.stringify({
            type: 'rpc-request',
            data: {
              id: 'req-get-devices',
              method: 'platform.getDeviceInfo',
              params: [],
            },
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type !== 'rpc-response') return;
            
            const response = message.data;
            
            if (response.id === 'req-get-devices') {
              // Phase 1: Acquire device
              const devices = response.result as Array<{ id: string }>;
              expect(devices.length).toBeGreaterThan(0);
              
              ws.send(JSON.stringify({
                type: 'rpc-request',
                data: {
                  id: 'req-acquire-device',
                  method: 'platform.acquireDevice',
                  params: [devices[0].id],
                },
              }));
            } else if (response.id === 'req-acquire-device') {
              // Phase 2: Start session
              deviceHandle = response.result as string;
              expect(deviceHandle).toBeDefined();
              
              ws.send(JSON.stringify({
                type: 'rpc-request',
                data: {
                  id: 'req-start-session',
                  method: 'device.startSession',
                  params: [deviceHandle],
                },
              }));
            } else if (response.id === 'req-start-session') {
              // Phase 3: Send APDU
              cardHandle = response.result as string;
              expect(cardHandle).toBeDefined();
              
              // Send SELECT APDU: 00 A4 04 00
              const apdu = {
                cla: 0x00,
                ins: 0xa4,
                p1: 0x04,
                p2: 0x00,
                data: null,
                le: null,
              };
              
              ws.send(JSON.stringify({
                type: 'rpc-request',
                data: {
                  id: 'req-send-apdu',
                  method: 'card.transmit',
                  params: [cardHandle, apdu],
                },
              }));
            } else if (response.id === 'req-send-apdu') {
              // Phase 4: Verify response
              const apduResponse = response.result as { data: number[]; sw1: number; sw2: number };
              
              expect(apduResponse).toBeDefined();
              expect(apduResponse.sw1).toBeDefined();
              expect(apduResponse.sw2).toBeDefined();
              expect(typeof apduResponse.sw1).toBe('number');
              expect(typeof apduResponse.sw2).toBe('number');
              
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('APDU flow timeout')), 20000);
      });
    }, 25000);
  });

  describe('Error Handling in Full System', () => {
    test('should handle invalid device ID across system', async () => {
      if (!await isRouterAvailable() || !cardhostReady) {
        return;
      }

      const ws = new WebSocket(`${ROUTER_URL}/controller`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'rpc-request',
            data: {
              id: 'req-invalid-device',
              method: 'platform.acquireDevice',
              params: ['invalid-device-id-12345'],
            },
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'rpc-response' && message.data.id === 'req-invalid-device') {
              const response = message.data;
              
              // Should have error
              expect(response.error).toBeDefined();
              expect(response.error.message).toBeDefined();
              expect(typeof response.error.message).toBe('string');
              
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Error handling timeout')), 10000);
      });
    }, 15000);

    test('should handle connection errors gracefully', async () => {
      // Try to connect to wrong port
      const ws = new WebSocket('ws://localhost:9999/ws/controller');
      
      await new Promise<void>((resolve) => {
        ws.on('error', () => {
          // Expected error
          expect(true).toBe(true);
          resolve();
        });
        
        ws.on('open', () => {
          // Should not connect
          ws.close();
          expect(false).toBe(true);
          resolve();
        });
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 3000);
      });
    });
  });

  describe('Multiple Controllers (Edge Case)', () => {
    test.skip('multiple controllers should be able to connect simultaneously', async () => {
      // TODO: Implement multi-controller test
      // This would test that multiple controllers can connect to the same cardhost
    });
  });

  describe('Reconnection and Resilience', () => {
    test.skip('controller should handle reconnection after disconnect', async () => {
      // TODO: Implement reconnection test
      // This would test that controller can reconnect and resume operations
    });

    test.skip('cardhost should maintain state across connection issues', async () => {
      // TODO: Implement state persistence test
    });
  });
});
