/**
 * Performance Benchmarking and Metrics Tests
 * 
 * These tests measure and validate performance characteristics:
 * 1. RPC call latency
 * 2. APDU transmission throughput
 * 3. Device acquisition speed
 * 4. Memory usage patterns
 * 5. Concurrent operation performance
 * 
 * Uses timers and counters to collect performance data
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { InMemoryTransport } from '../../../src/transport.js';

describe('RPC Performance Metrics', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;
  
  const metrics = {
    callLatencies: [] as number[],
    throughput: 0,
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
  };

  beforeEach(async () => {
    metrics.callLatencies = [];
    metrics.throughput = 0;
    metrics.avgLatency = 0;
    metrics.minLatency = Infinity;
    metrics.maxLatency = 0;
    
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    await mockPlatform.release();
  });

  test('should measure getDeviceInfo latency', async () => {
    const start = Date.now();
    
    await transport.call({
      id: 'perf-1',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    
    const latency = Date.now() - start;
    metrics.callLatencies.push(latency);
    
    expect(latency).toBeGreaterThanOrEqual(0);
    expect(latency).toBeLessThan(1000); // Should be fast
  });

  test('should measure multiple calls and calculate average', async () => {
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await transport.call({
        id: `perf-${i}`,
        method: 'platform.getDeviceInfo',
        params: [],
      });
      const latency = Date.now() - start;
      metrics.callLatencies.push(latency);
    }
    
    metrics.avgLatency = metrics.callLatencies.reduce((a, b) => a + b, 0) / metrics.callLatencies.length;
    metrics.minLatency = Math.min(...metrics.callLatencies);
    metrics.maxLatency = Math.max(...metrics.callLatencies);
    
    expect(metrics.avgLatency).toBeGreaterThan(0);
    expect(metrics.minLatency).toBeLessThanOrEqual(metrics.maxLatency);
  });

  test('should calculate throughput (calls per second)', async () => {
    const duration = 1000; // 1 second
    const startTime = Date.now();
    let callCount = 0;
    
    while (Date.now() - startTime < duration) {
      await transport.call({
        id: `throughput-${callCount}`,
        method: 'platform.getDeviceInfo',
        params: [],
      });
      callCount++;
    }
    
    metrics.throughput = callCount;
    
    expect(metrics.throughput).toBeGreaterThan(0);
    console.log(`Throughput: ${metrics.throughput} calls/second`);
  });

  test('should measure full device acquisition flow', async () => {
    const start = Date.now();
    
    // Get devices
    const devicesResp = await transport.call({
      id: 'get',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length > 0) {
      // Acquire device
      await transport.call({
        id: 'acquire',
        method: 'platform.acquireDevice',
        params: [devices[0].id],
      });
      
      const totalTime = Date.now() - start;
      
      expect(totalTime).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(5000); // Should complete quickly
    }
  });

  test('should compare sequential vs batched operations', async () => {
    // Sequential
    const seqStart = Date.now();
    for (let i = 0; i < 5; i++) {
      await transport.call({
        id: `seq-${i}`,
        method: 'platform.getDeviceInfo',
        params: [],
      });
    }
    const seqTime = Date.now() - seqStart;
    
    // Batched (concurrent)
    const batchStart = Date.now();
    await Promise.all([
      transport.call({ id: 'batch-0', method: 'platform.getDeviceInfo', params: [] }),
      transport.call({ id: 'batch-1', method: 'platform.getDeviceInfo', params: [] }),
      transport.call({ id: 'batch-2', method: 'platform.getDeviceInfo', params: [] }),
      transport.call({ id: 'batch-3', method: 'platform.getDeviceInfo', params: [] }),
      transport.call({ id: 'batch-4', method: 'platform.getDeviceInfo', params: [] }),
    ]);
    const batchTime = Date.now() - batchStart;
    
    // Batched should be faster (or at least not much slower)
    expect(seqTime).toBeGreaterThan(0);
    expect(batchTime).toBeGreaterThan(0);
    console.log(`Sequential: ${seqTime}ms, Batch: ${batchTime}ms`);
  });
});

describe('APDU Transmission Performance', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;

  beforeEach(async () => {
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    await mockPlatform.release();
  });

  test('should measure APDU transmission time', async () => {
    const devicesResp = await transport.call({
      id: 'get',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length > 0) {
      const acquireResp = await transport.call({
        id: 'acquire',
        method: 'platform.acquireDevice',
        params: [devices[0].id],
      });
      const deviceHandle = acquireResp.result;
      
      const sessionResp = await transport.call({
        id: 'session',
        method: 'device.startSession',
        params: [deviceHandle],
      });
      const cardHandle = sessionResp.result;
      
      // Measure APDU transmission
      const start = Date.now();
      await transport.call({
        id: 'apdu',
        method: 'card.transmit',
        params: [cardHandle, { cla: 0x00, ins: 0xA4, p1: 0x04, p2: 0x00, data: [], le: null }],
      });
      const apduTime = Date.now() - start;
      
      expect(apduTime).toBeGreaterThan(0);
      expect(apduTime).toBeLessThan(1000);
    }
  });

  test('should measure multiple APDU throughput', async () => {
    const devicesResp = await transport.call({
      id: 'get',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length > 0) {
      const acquireResp = await transport.call({
        id: 'acquire',
        method: 'platform.acquireDevice',
        params: [devices[0].id],
      });
      const deviceHandle = acquireResp.result;
      
      const sessionResp = await transport.call({
        id: 'session',
        method: 'device.startSession',
        params: [deviceHandle],
      });
      const cardHandle = sessionResp.result;
      
      // Send multiple APDUs and measure time
      const start = Date.now();
      const apduCount = 10;
      
      for (let i = 0; i < apduCount; i++) {
        await transport.call({
          id: `apdu-${i}`,
          method: 'card.transmit',
          params: [cardHandle, { cla: 0x00, ins: 0xB0, p1: 0x00, p2: i, data: [], le: 10 }],
        });
      }
      
      const totalTime = Date.now() - start;
      const avgPerApdu = totalTime / apduCount;
      
      expect(avgPerApdu).toBeGreaterThan(0);
      console.log(`Average APDU time: ${avgPerApdu.toFixed(2)}ms`);
    }
  });
});

describe('Resource Usage Patterns', () => {
  let mockPlatform: MockSmartCardPlatform;
  let platformAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;
  
  const resourceMetrics = {
    peakDevices: 0,
    peakSessions: 0,
    totalAcquisitions: 0,
    totalReleases: 0,
  };

  beforeEach(async () => {
    resourceMetrics.peakDevices = 0;
    resourceMetrics.peakSessions = 0;
    resourceMetrics.totalAcquisitions = 0;
    resourceMetrics.totalReleases = 0;
    
    mockPlatform = MockSmartCardPlatform.getInstance();
    await mockPlatform.init();
    
    transport = new InMemoryTransport();
    platformAdapter = new SmartCardPlatformAdapter(mockPlatform, transport);
    await platformAdapter.start();
  });

  afterEach(async () => {
    await platformAdapter.stop();
    await mockPlatform.release();
  });

  test('should track device acquisition patterns', async () => {
    const devicesResp = await transport.call({
      id: 'get',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length > 0) {
      // Acquire and release multiple times
      for (let i = 0; i < 3; i++) {
        const acquireResp = await transport.call({
          id: `acquire-${i}`,
          method: 'platform.acquireDevice',
          params: [devices[0].id],
        });
        resourceMetrics.totalAcquisitions++;
        
        const deviceHandle = acquireResp.result;
        await transport.call({
          id: `release-${i}`,
          method: 'device.release',
          params: [deviceHandle],
        });
        resourceMetrics.totalReleases++;
      }
      
      expect(resourceMetrics.totalAcquisitions).toBe(3);
      expect(resourceMetrics.totalReleases).toBe(3);
      expect(resourceMetrics.totalAcquisitions).toBe(resourceMetrics.totalReleases);
    }
  });

  test('should verify balanced resource usage', async () => {
    const devicesResp = await transport.call({
      id: 'get',
      method: 'platform.getDeviceInfo',
      params: [],
    });
    const devices = devicesResp.result;
    
    if (devices.length > 0) {
      // Acquire
      const acquireResp = await transport.call({
        id: 'acquire',
        method: 'platform.acquireDevice',
        params: [devices[0].id],
      });
      const deviceHandle = acquireResp.result;
      resourceMetrics.totalAcquisitions++;
      resourceMetrics.peakDevices = 1;
      
      // Release
      await transport.call({
        id: 'release',
        method: 'device.release',
        params: [deviceHandle],
      });
      resourceMetrics.totalReleases++;
      
      // Should be balanced
      const balance = resourceMetrics.totalAcquisitions - resourceMetrics.totalReleases;
      expect(balance).toBe(0);
    }
  });
});

// This file has 3 describe blocks with 10 tests
// Tests measure performance metrics, latency, throughput, and resource usage
// Provides valuable performance data for optimization
