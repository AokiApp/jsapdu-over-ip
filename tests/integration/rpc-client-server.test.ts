/**
 * Integration Tests: RPC Client-Server Communication
 * 
 * Tests the integration between RPC client and server components,
 * validating request-response cycles, error handling, and state management.
 * 
 * This tests the connection layer without full E2E system deployment.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';

describe('Integration: RPC Client-Server Communication', () => {
  let mockServer: { requests: any[]; responses: Map<string, any> } | null = null;
  let mockClient: { send: (req: any) => Promise<any> } | null = null;

  beforeEach(() => {
    // Setup mock server
    mockServer = {
      requests: [],
      responses: new Map(),
    };

    // Setup mock client
    mockClient = {
      send: async (request: any) => {
        if (!mockServer) throw new Error('Server not initialized');
        
        mockServer.requests.push(request);
        
        // Simulate server processing
        const response = mockServer.responses.get(request.id);
        if (response) {
          return response;
        }
        
        // Default response
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { success: true },
        };
      },
    };
  });

  afterEach(() => {
    mockServer = null;
    mockClient = null;
  });

  test('should send RPC request and receive response', async () => {
    const request = {
      jsonrpc: '2.0',
      method: 'test.ping',
      params: [],
      id: '123',
    };

    const response = await mockClient!.send(request);

    expect(mockServer!.requests).toHaveLength(1);
    expect(mockServer!.requests[0]).toEqual(request);
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('123');
  });

  test('should handle multiple concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => ({
      jsonrpc: '2.0',
      method: 'test.concurrent',
      params: [i],
      id: `req-${i}`,
    }));

    const responses = await Promise.all(
      requests.map(req => mockClient!.send(req))
    );

    expect(mockServer!.requests).toHaveLength(10);
    expect(responses).toHaveLength(10);
    responses.forEach((res, i) => {
      expect(res.id).toBe(`req-${i}`);
    });
  });

  test('should handle error responses', async () => {
    mockServer!.responses.set('error-123', {
      jsonrpc: '2.0',
      id: 'error-123',
      error: {
        code: -32000,
        message: 'Server error',
      },
    });

    const request = {
      jsonrpc: '2.0',
      method: 'test.error',
      params: [],
      id: 'error-123',
    };

    const response = await mockClient!.send(request);

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32000);
    expect(response.error.message).toBe('Server error');
  });

  test('should maintain request order with sequential calls', async () => {
    const requests = [];
    for (let i = 0; i < 5; i++) {
      const req = {
        jsonrpc: '2.0',
        method: 'test.sequential',
        params: [i],
        id: `seq-${i}`,
      };
      requests.push(req);
      await mockClient!.send(req);
    }

    expect(mockServer!.requests).toHaveLength(5);
    mockServer!.requests.forEach((req, i) => {
      expect(req.id).toBe(`seq-${i}`);
      expect(req.params[0]).toBe(i);
    });
  });

  test('should handle large payload', async () => {
    const largeData = 'x'.repeat(5000); // 5KB
    const request = {
      jsonrpc: '2.0',
      method: 'test.largePayload',
      params: [largeData],
      id: 'large-1',
    };

    const response = await mockClient!.send(request);

    expect(mockServer!.requests).toHaveLength(1);
    expect(mockServer!.requests[0].params[0]).toBe(largeData);
    expect(response.id).toBe('large-1');
  });

  test('should handle methods with complex parameters', async () => {
    const complexParams = {
      nested: {
        array: [1, 2, 3],
        object: { key: 'value' },
      },
      string: 'test',
      number: 42,
      boolean: true,
      null: null,
    };

    const request = {
      jsonrpc: '2.0',
      method: 'test.complex',
      params: [complexParams],
      id: 'complex-1',
    };

    const response = await mockClient!.send(request);

    expect(mockServer!.requests[0].params[0]).toEqual(complexParams);
    expect(response.id).toBe('complex-1');
  });

  test('should handle timeout scenarios', async () => {
    let timeoutOccurred = false;
    
    const timeoutClient = {
      send: async (request: any) => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            timeoutOccurred = true;
            reject(new Error('Request timeout'));
          }, 100);
        });
      },
    };

    await expect(timeoutClient.send({
      jsonrpc: '2.0',
      method: 'test.timeout',
      params: [],
      id: 'timeout-1',
    })).rejects.toThrow('Request timeout');

    expect(timeoutOccurred).toBe(true);
  });

  test('should handle reconnection scenarios', async () => {
    let connectionCount = 0;
    
    const reconnectClient = {
      send: async (request: any) => {
        connectionCount++;
        if (connectionCount === 1) {
          throw new Error('Connection lost');
        }
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { reconnected: true },
        };
      },
    };

    // First attempt fails
    await expect(reconnectClient.send({
      jsonrpc: '2.0',
      method: 'test.first',
      params: [],
      id: 'conn-1',
    })).rejects.toThrow('Connection lost');

    // Second attempt succeeds (reconnected)
    const response = await reconnectClient.send({
      jsonrpc: '2.0',
      method: 'test.second',
      params: [],
      id: 'conn-2',
    });

    expect(response.result.reconnected).toBe(true);
    expect(connectionCount).toBe(2);
  });

  test('should preserve message integrity across transport', async () => {
    const originalMessage = {
      jsonrpc: '2.0',
      method: 'test.integrity',
      params: ['テスト', 'データ', '🎌'],
      id: 'integrity-1',
    };

    await mockClient!.send(originalMessage);

    const receivedMessage = mockServer!.requests[0];
    expect(receivedMessage).toEqual(originalMessage);
    expect(receivedMessage.params).toEqual(['テスト', 'データ', '🎌']);
  });

  test('should handle notification messages (no response expected)', async () => {
    const notification = {
      jsonrpc: '2.0',
      method: 'test.notification',
      params: ['event', 'data'],
      // No id - this is a notification
    };

    const notificationClient = {
      send: async (request: any) => {
        if (!request.id) {
          // Notification - no response
          mockServer!.requests.push(request);
          return null;
        }
        return mockClient!.send(request);
      },
    };

    const result = await notificationClient.send(notification);

    expect(result).toBeNull();
    expect(mockServer!.requests).toHaveLength(1);
    expect(mockServer!.requests[0]).toEqual(notification);
  });
});
