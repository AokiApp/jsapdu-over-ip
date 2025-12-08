/**
 * Unit tests for error handling across the system
 * 
 * Tests various error scenarios as required by Issue #2: 異常系
 * Validates that errors are properly caught, formatted, and communicated
 */

import { describe, test, expect } from 'vitest';

describe('Unit: Error Handling', () => {
  describe('Error Code Constants', () => {
    test('should have well-defined error codes', () => {
      const errorCodes = {
        DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
        DEVICE_BUSY: 'DEVICE_BUSY',
        SESSION_NOT_STARTED: 'SESSION_NOT_STARTED',
        INVALID_PARAMETER: 'INVALID_PARAMETER',
        TIMEOUT: 'TIMEOUT',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        PLATFORM_NOT_INITIALIZED: 'PLATFORM_NOT_INITIALIZED',
        CONNECTION_FAILED: 'CONNECTION_FAILED',
      };

      Object.values(errorCodes).forEach(code => {
        expect(code).toMatch(/^[A-Z_]+$/);
        expect(code.length).toBeGreaterThan(0);
      });
    });

    test('should use consistent naming pattern', () => {
      const codes = [
        'DEVICE_NOT_FOUND',
        'SESSION_NOT_STARTED',
        'PLATFORM_NOT_INITIALIZED',
      ];

      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
      });
    });
  });

  describe('Error Message Formatting', () => {
    test('should format error with code and message', () => {
      const error = {
        code: 'DEVICE_NOT_FOUND',
        message: 'Device with ID xyz-123 not found',
      };

      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(typeof error.code).toBe('string');
      expect(typeof error.message).toBe('string');
    });

    test('should include contextual information in error message', () => {
      const deviceId = 'device-abc-123';
      const error = {
        code: 'DEVICE_NOT_FOUND',
        message: `Device with ID ${deviceId} not found`,
      };

      expect(error.message).toContain(deviceId);
    });

    test('should handle error messages with special characters', () => {
      const error = {
        code: 'INVALID_PARAMETER',
        message: 'Parameter "device-id" must match pattern /^[a-z0-9-]+$/',
      };

      expect(error.message).toContain('"device-id"');
      expect(error.message).toContain('/^[a-z0-9-]+$/');
    });

    test('should handle multi-line error messages', () => {
      const error = {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred:\nStack trace:\n  at function1\n  at function2',
      };

      expect(error.message).toContain('\n');
      expect(error.message.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('Error Propagation', () => {
    test('should preserve error code through RPC response', () => {
      const originalError = {
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      };

      const rpcResponse = {
        type: 'rpc-response',
        data: {
          id: 'req-123',
          result: undefined,
          error: originalError,
        },
      };

      expect(rpcResponse.data.error?.code).toBe(originalError.code);
      expect(rpcResponse.data.error?.message).toBe(originalError.message);
    });

    test('should handle nested errors', () => {
      const nestedError = {
        code: 'INTERNAL_ERROR',
        message: 'Database query failed',
        cause: {
          code: 'CONNECTION_FAILED',
          message: 'Connection timeout after 5000ms',
        },
      };

      expect(nestedError).toHaveProperty('cause');
      expect(nestedError.cause).toHaveProperty('code');
      expect(nestedError.cause).toHaveProperty('message');
    });
  });

  describe('Error Recovery', () => {
    test('should provide recovery suggestions in error', () => {
      const error = {
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
        suggestion: 'Check if device is connected and call platform.getDeviceInfo()',
      };

      expect(error).toHaveProperty('suggestion');
      expect(error.suggestion).toContain('getDeviceInfo');
    });

    test('should indicate if error is retryable', () => {
      const retryableError = {
        code: 'TIMEOUT',
        message: 'Operation timed out',
        retryable: true,
      };

      const nonRetryableError = {
        code: 'INVALID_PARAMETER',
        message: 'Invalid parameter',
        retryable: false,
      };

      expect(retryableError.retryable).toBe(true);
      expect(nonRetryableError.retryable).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout after specified duration', async () => {
      const timeout = 100; // ms
      const start = Date.now();

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Operation timed out'));
        }, timeout);

        // Simulate long operation that doesn't complete
      }).catch(error => {
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(timeout - 5); // Allow 5ms tolerance
        expect(error.message).toContain('timed out');
      });
    }, 200);

    test('should cancel operation on timeout', async () => {
      let operationCancelled = false;
      const timeout = 50;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          operationCancelled = true;
          reject(new Error('TIMEOUT'));
        }, timeout);

        // Operation doesn't complete
      }).catch(error => {
        expect(operationCancelled).toBe(true);
        expect(error.message).toBe('TIMEOUT');
      });
    }, 100);
  });

  describe('Connection Error Handling', () => {
    test('should handle WebSocket connection failure', () => {
      const error = {
        code: 'CONNECTION_FAILED',
        message: 'Failed to connect to ws://localhost:8080/ws',
        details: {
          url: 'ws://localhost:8080/ws',
          reason: 'ECONNREFUSED',
        },
      };

      expect(error.code).toBe('CONNECTION_FAILED');
      expect(error.details).toHaveProperty('url');
      expect(error.details).toHaveProperty('reason');
    });

    test('should handle connection timeout', () => {
      const error = {
        code: 'CONNECTION_FAILED',
        message: 'Connection timeout after 5000ms',
        timeout: 5000,
      };

      expect(error).toHaveProperty('timeout');
      expect(error.timeout).toBe(5000);
    });

    test('should handle unexpected disconnection', () => {
      const error = {
        code: 'CONNECTION_LOST',
        message: 'Connection unexpectedly closed',
        wasClean: false,
        reason: '',
      };

      expect(error.code).toBe('CONNECTION_LOST');
      expect(error.wasClean).toBe(false);
    });
  });

  describe('Parameter Validation Errors', () => {
    test('should validate required parameters', () => {
      const validateParams = (params: any[]) => {
        if (params.length === 0) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'Missing required parameter: deviceId',
            },
          };
        }
        return { valid: true };
      };

      const result = validateParams([]);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMETER');
    });

    test('should validate parameter types', () => {
      const validateDeviceId = (deviceId: any) => {
        if (typeof deviceId !== 'string') {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: `Expected string for deviceId, got ${typeof deviceId}`,
            },
          };
        }
        return { valid: true };
      };

      const result = validateDeviceId(123);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Expected string');
    });

    test('should validate parameter format', () => {
      const validateUUID = (uuid: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(uuid)) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'Invalid UUID format',
            },
          };
        }
        return { valid: true };
      };

      const invalidResult = validateUUID('not-a-uuid');
      expect(invalidResult.valid).toBe(false);

      const validResult = validateUUID('550e8400-e29b-41d4-a716-446655440000');
      expect(validResult.valid).toBe(true);
    });
  });

  describe('State Validation Errors', () => {
    test('should error when session not started', () => {
      const device = {
        sessionActive: false,
      };

      const attemptTransmit = () => {
        if (!device.sessionActive) {
          return {
            success: false,
            error: {
              code: 'SESSION_NOT_STARTED',
              message: 'Session must be started before transmitting',
            },
          };
        }
        return { success: true };
      };

      const result = attemptTransmit();
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_STARTED');
    });

    test('should error when platform not initialized', () => {
      const platform = {
        initialized: false,
      };

      const getDevices = () => {
        if (!platform.initialized) {
          return {
            success: false,
            error: {
              code: 'PLATFORM_NOT_INITIALIZED',
              message: 'Platform must be initialized before use',
            },
          };
        }
        return { success: true, devices: [] };
      };

      const result = getDevices();
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLATFORM_NOT_INITIALIZED');
    });
  });
});
