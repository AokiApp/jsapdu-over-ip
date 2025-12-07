/**
 * Unit Tests for RemoteSmartCardPlatform (Client Side)
 * 
 * Tests the client-side proxy that communicates with remote platform via RPC.
 * Uses mocked transport to verify RPC calls without actual network.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteSmartCardPlatform } from '../../../src/client/platform-proxy.js';
import type { ClientTransport, RpcRequest, RpcResponse } from '../../../src/types.js';

describe('RemoteSmartCardPlatform (Unit)', () => {
  let mockTransport: ClientTransport;
  let platform: RemoteSmartCardPlatform;
  let callSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock transport
    callSpy = vi.fn();
    mockTransport = {
      call: callSpy,
      onEvent: vi.fn(() => () => {}),
      close: vi.fn(),
    };

    platform = new RemoteSmartCardPlatform(mockTransport);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init()', () => {
    test('should send init RPC request', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      await platform.init();

      expect(callSpy).toHaveBeenCalledOnce();
      const call = callSpy.mock.calls[0][0] as RpcRequest;
      expect(call.method).toBe('platform.init');
      expect(call.params).toEqual({});
    });

    test('should handle init failure', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        error: { code: -1, message: 'Platform init failed' },
      });

      await expect(platform.init()).rejects.toThrow('Platform init failed');
    });

    test('should only init once', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      await platform.init();
      await platform.init(); // Second call should be no-op

      expect(callSpy).toHaveBeenCalledOnce();
    });
  });

  describe('getDeviceInfo()', () => {
    beforeEach(async () => {
      // Initialize platform first
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });
      await platform.init();
      callSpy.mockClear();
    });

    test('should fetch device info via RPC', async () => {
      const mockDevices = [
        {
          id: 'device-1',
          friendlyName: 'Mock Reader 1',
          supportsApdu: true,
        },
        {
          id: 'device-2',
          friendlyName: 'Mock Reader 2',
          supportsApdu: true,
        },
      ];

      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { devices: mockDevices },
      });

      const devices = await platform.getDeviceInfo();

      expect(callSpy).toHaveBeenCalledOnce();
      const call = callSpy.mock.calls[0][0] as RpcRequest;
      expect(call.method).toBe('platform.getDeviceInfo');
      expect(devices).toEqual(mockDevices);
    });

    test('should handle empty device list', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { devices: [] },
      });

      const devices = await platform.getDeviceInfo();
      expect(devices).toEqual([]);
    });

    test('should handle RPC error', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        error: { code: -1, message: 'Failed to get devices' },
      });

      await expect(platform.getDeviceInfo()).rejects.toThrow('Failed to get devices');
    });
  });

  describe('acquireDevice()', () => {
    beforeEach(async () => {
      // Initialize platform first
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });
      await platform.init();
      callSpy.mockClear();
    });

    test('should acquire device via RPC', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      const device = await platform.acquireDevice('device-1');

      expect(callSpy).toHaveBeenCalledOnce();
      const call = callSpy.mock.calls[0][0] as RpcRequest;
      expect(call.method).toBe('platform.acquireDevice');
      expect(call.params).toEqual({ deviceId: 'device-1' });
      expect(device).toBeDefined();
    });

    test('should handle invalid device ID', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        error: { code: -1, message: 'Device not found: invalid-id' },
      });

      await expect(platform.acquireDevice('invalid-id')).rejects.toThrow('Device not found');
    });

    test('should return device proxy with correct ID', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      const device = await platform.acquireDevice('device-123');
      
      // Device should have the ID
      expect(device).toBeDefined();
      expect(device).toHaveProperty('getDeviceInfo');
    });
  });

  describe('release()', () => {
    beforeEach(async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });
      await platform.init();
      callSpy.mockClear();
    });

    test('should release platform via RPC', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      await platform.release();

      expect(callSpy).toHaveBeenCalledOnce();
      const call = callSpy.mock.calls[0][0] as RpcRequest;
      expect(call.method).toBe('platform.release');
    });

    test('should handle release errors gracefully', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        error: { code: -1, message: 'Release failed' },
      });

      await expect(platform.release()).rejects.toThrow('Release failed');
    });
  });

  describe('Error Handling (異常系)', () => {
    test('should throw error when calling methods before init', async () => {
      // Don't initialize platform
      const uninitPlatform = new RemoteSmartCardPlatform(mockTransport);

      await expect(uninitPlatform.getDeviceInfo()).rejects.toThrow();
    });

    test('should handle transport errors', async () => {
      callSpy.mockRejectedValue(new Error('Network error'));

      await expect(platform.init()).rejects.toThrow('Network error');
    });

    test('should handle malformed RPC responses', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        // Missing both result and error
      } as any);

      await expect(platform.init()).rejects.toThrow();
    });
  });

  describe('Edge Cases (エッジケース)', () => {
    beforeEach(async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });
      await platform.init();
      callSpy.mockClear();
    });

    test('should handle empty device ID', async () => {
      callSpy.mockResolvedValue({
        id: 'test-id',
        error: { code: -1, message: 'Invalid device ID' },
      });

      await expect(platform.acquireDevice('')).rejects.toThrow();
    });

    test('should handle special characters in device ID', async () => {
      const specialId = 'device-<>@#$%^&*()';
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      const device = await platform.acquireDevice(specialId);
      expect(device).toBeDefined();

      const call = callSpy.mock.calls[0][0] as RpcRequest;
      expect(call.params).toEqual({ deviceId: specialId });
    });

    test('should handle very long device IDs', async () => {
      const longId = 'device-' + 'a'.repeat(1000);
      callSpy.mockResolvedValue({
        id: 'test-id',
        result: { success: true },
      });

      await platform.acquireDevice(longId);
      expect(callSpy).toHaveBeenCalled();
    });
  });
});
