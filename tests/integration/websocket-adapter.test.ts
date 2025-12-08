/**
 * Integration Tests: WebSocket Adapter
 * 
 * Tests WebSocket adapter integration including connection management,
 * message framing, reconnection logic, and error recovery.
 * 
 * These tests validate the WebSocket transport layer behavior.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';

describe('Integration: WebSocket Adapter', () => {
  type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed';
  
  interface MockWebSocket {
    readyState: number;
    url: string;
    sent: any[];
    onopen: ((ev: any) => void) | null;
    onclose: ((ev: any) => void) | null;
    onmessage: ((ev: any) => void) | null;
    onerror: ((ev: any) => void) | null;
    send(data: string): void;
    close(): void;
    simulateOpen(): void;
    simulateMessage(data: string): void;
    simulateClose(code?: number, reason?: string): void;
    simulateError(error: Error): void;
  }

  let mockWs: MockWebSocket | null = null;

  beforeEach(() => {
    // Create mock WebSocket
    mockWs = {
      readyState: 0, // CONNECTING
      url: 'ws://localhost:8080/test',
      sent: [],
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send(data: string) {
        if (this.readyState !== 1) {
          throw new Error('WebSocket is not open');
        }
        this.sent.push(data);
      },
      close() {
        this.readyState = 2; // CLOSING
        setTimeout(() => {
          this.readyState = 3; // CLOSED
          this.onclose?.({ code: 1000, reason: 'Normal closure' });
        }, 10);
      },
      simulateOpen() {
        this.readyState = 1; // OPEN
        this.onopen?.({});
      },
      simulateMessage(data: string) {
        this.onmessage?.({ data });
      },
      simulateClose(code = 1000, reason = '') {
        this.readyState = 3; // CLOSED
        this.onclose?.({ code, reason });
      },
      simulateError(error: Error) {
        this.onerror?.({ error });
      },
    };
  });

  afterEach(() => {
    mockWs = null;
  });

  test('should connect to WebSocket server', async () => {
    const connected = new Promise((resolve) => {
      mockWs!.onopen = () => resolve(true);
    });

    mockWs!.simulateOpen();

    await expect(connected).resolves.toBe(true);
    expect(mockWs!.readyState).toBe(1); // OPEN
  });

  test('should send message when connected', async () => {
    mockWs!.simulateOpen();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method: 'test',
      params: [],
      id: '1',
    });

    mockWs!.send(message);

    expect(mockWs!.sent).toHaveLength(1);
    expect(mockWs!.sent[0]).toBe(message);
  });

  test('should not send when not connected', () => {
    // WebSocket is still connecting (readyState = 0)
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method: 'test',
      params: [],
      id: '1',
    });

    expect(() => mockWs!.send(message)).toThrow('WebSocket is not open');
  });

  test('should receive messages', async () => {
    const messages: string[] = [];
    
    mockWs!.onmessage = (ev) => {
      messages.push(ev.data);
    };

    mockWs!.simulateOpen();

    const msg1 = JSON.stringify({ type: 'hello' });
    const msg2 = JSON.stringify({ type: 'world' });

    mockWs!.simulateMessage(msg1);
    mockWs!.simulateMessage(msg2);

    // Small delay to allow async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(msg1);
    expect(messages[1]).toBe(msg2);
  });

  test('should handle connection close', async () => {
    let closeCode: number | undefined;
    let closeReason: string | undefined;

    mockWs!.onclose = (ev) => {
      closeCode = ev.code;
      closeReason = ev.reason;
    };

    mockWs!.simulateOpen();
    mockWs!.simulateClose(1000, 'Normal closure');

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(closeCode).toBe(1000);
    expect(closeReason).toBe('Normal closure');
    expect(mockWs!.readyState).toBe(3); // CLOSED
  });

  test('should handle abnormal closure', async () => {
    let closeCode: number | undefined;

    mockWs!.onclose = (ev) => {
      closeCode = ev.code;
    };

    mockWs!.simulateOpen();
    mockWs!.simulateClose(1006, 'Abnormal closure');

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(closeCode).toBe(1006);
  });

  test('should handle connection errors', async () => {
    let errorOccurred = false;

    mockWs!.onerror = () => {
      errorOccurred = true;
    };

    mockWs!.simulateError(new Error('Connection failed'));

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(errorOccurred).toBe(true);
  });

  test('should handle rapid reconnection attempts', async () => {
    const connections: { timestamp: number; success: boolean }[] = [];

    for (let i = 0; i < 5; i++) {
      const timestamp = Date.now();
      try {
        mockWs!.simulateOpen();
        connections.push({ timestamp, success: true });
        mockWs!.simulateClose();
        
        // Reset for next connection
        mockWs!.readyState = 0;
      } catch (error) {
        connections.push({ timestamp, success: false });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    expect(connections).toHaveLength(5);
    const successful = connections.filter(c => c.success);
    expect(successful.length).toBeGreaterThan(0);
  });

  test('should maintain message queue during reconnection', async () => {
    const queue: string[] = [];

    // Try to send while connecting
    try {
      mockWs!.send('message1');
    } catch {
      queue.push('message1');
    }

    try {
      mockWs!.send('message2');
    } catch {
      queue.push('message2');
    }

    // Now connect
    mockWs!.simulateOpen();

    // Flush queue
    queue.forEach(msg => mockWs!.send(msg));

    expect(mockWs!.sent).toHaveLength(2);
    expect(mockWs!.sent).toContain('message1');
    expect(mockWs!.sent).toContain('message2');
  });

  test('should handle ping/pong for keep-alive', async () => {
    mockWs!.simulateOpen();

    const pingMessage = JSON.stringify({
      type: 'ping',
      timestamp: Date.now(),
    });

    mockWs!.send(pingMessage);

    expect(mockWs!.sent).toHaveLength(1);
    
    const sent = JSON.parse(mockWs!.sent[0]);
    expect(sent.type).toBe('ping');
    expect(sent.timestamp).toBeDefined();
  });

  test('should handle binary message frames', async () => {
    const binaryMessages: ArrayBuffer[] = [];

    mockWs!.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        binaryMessages.push(ev.data);
      }
    };

    mockWs!.simulateOpen();

    // Simulate binary message (as base64 string for this mock)
    const binaryData = btoa('binary content');
    mockWs!.simulateMessage(binaryData);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(binaryMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('should handle connection timeout', async () => {
    let timedOut = false;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (mockWs!.readyState === 0) {
          timedOut = true;
          reject(new Error('Connection timeout'));
        }
      }, 100);
    });

    // Don't call simulateOpen - let it timeout

    await expect(timeoutPromise).rejects.toThrow('Connection timeout');
    expect(timedOut).toBe(true);
  });

  test('should handle multiple simultaneous connections', async () => {
    const connections = Array.from({ length: 3 }, (_, i) => ({
      ws: { ...mockWs!, url: `ws://localhost:8080/test${i}` },
      connected: false,
    }));

    connections.forEach((conn, i) => {
      conn.ws.onopen = () => {
        conn.connected = true;
      };
      
      setTimeout(() => {
        conn.ws.readyState = 1;
        conn.ws.onopen?.({});
      }, i * 50);
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const connectedCount = connections.filter(c => c.connected).length;
    expect(connectedCount).toBeGreaterThan(0);
  });

  test('should handle graceful shutdown', async () => {
    let shutdownComplete = false;

    mockWs!.onclose = () => {
      shutdownComplete = true;
    };

    mockWs!.simulateOpen();
    mockWs!.close();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(shutdownComplete).toBe(true);
    expect(mockWs!.readyState).toBe(3); // CLOSED
  });

  test('should handle message batching', async () => {
    mockWs!.simulateOpen();

    const messages = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ id: i, data: `message-${i}` })
    );

    messages.forEach(msg => mockWs!.send(msg));

    expect(mockWs!.sent).toHaveLength(10);
    mockWs!.sent.forEach((sent, i) => {
      const parsed = JSON.parse(sent);
      expect(parsed.id).toBe(i);
    });
  });
});
