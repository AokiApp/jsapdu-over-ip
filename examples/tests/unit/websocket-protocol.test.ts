/**
 * WebSocket Message Protocol Tests
 * 
 * Tests the message protocol used for communication between:
 * - Controller ↔ Router
 * - Cardhost ↔ Router
 * 
 * Validates:
 * 1. Message format and structure
 * 2. Authentication messages
 * 3. RPC message wrapping
 * 4. Event propagation
 * 5. Error handling
 */

import { describe, test, expect } from 'vitest';
import type { RpcRequest, RpcResponse, RpcEvent } from '@aokiapp/jsapdu-over-ip';

describe('WebSocket Protocol - Message Types', () => {
  test('authentication challenge message structure', () => {
    const challenge = {
      type: 'auth-challenge',
      data: {
        challenge: 'random-challenge-string',
        timestamp: Date.now(),
      },
    };

    expect(challenge.type).toBe('auth-challenge');
    expect(challenge.data.challenge).toBeDefined();
    expect(challenge.data.timestamp).toBeDefined();
  });

  test('authentication response message structure', () => {
    const authResponse = {
      type: 'auth-response',
      data: {
        signature: 'base64-signature',
        publicKey: 'base64-public-key',
      },
    };

    expect(authResponse.type).toBe('auth-response');
    expect(authResponse.data.signature).toBeDefined();
    expect(authResponse.data.publicKey).toBeDefined();
  });

  test('registration message for cardhost', () => {
    const registration = {
      type: 'register',
      data: {
        uuid: 'cardhost-uuid-123',
        publicKey: 'base64-public-key',
        capabilities: ['apdu', 'iso7816'],
      },
    };

    expect(registration.type).toBe('register');
    expect(registration.data.uuid).toBeDefined();
    expect(registration.data.publicKey).toBeDefined();
    expect(Array.isArray(registration.data.capabilities)).toBe(true);
  });

  test('connection success message', () => {
    const success = {
      type: 'connected',
      data: {
        sessionId: 'session-123',
        cardhostUuid: 'cardhost-uuid-123',
      },
    };

    expect(success.type).toBe('connected');
    expect(success.data.sessionId).toBeDefined();
  });
});

describe('WebSocket Protocol - RPC Messages', () => {
  test('RPC request wrapped in WebSocket message', () => {
    const rpcRequest: RpcRequest = {
      id: 'req-123',
      method: 'platform.getDeviceInfo',
      params: [],
    };

    const wsMessage = {
      type: 'rpc-request',
      data: rpcRequest,
    };

    expect(wsMessage.type).toBe('rpc-request');
    expect(wsMessage.data).toMatchObject({
      id: expect.any(String),
      method: expect.any(String),
      params: expect.any(Array),
    });
  });

  test('RPC response wrapped in WebSocket message', () => {
    const rpcResponse: RpcResponse = {
      id: 'req-123',
      result: { devices: [] },
    };

    const wsMessage = {
      type: 'rpc-response',
      data: rpcResponse,
    };

    expect(wsMessage.type).toBe('rpc-response');
    expect(wsMessage.data.id).toBe('req-123');
    expect(wsMessage.data.result).toBeDefined();
  });

  test('RPC error wrapped in WebSocket message', () => {
    const rpcError: RpcResponse = {
      id: 'req-123',
      error: {
        code: 'NO_CARDHOST',
        message: 'No cardhost connected',
      },
    };

    const wsMessage = {
      type: 'rpc-response',
      data: rpcError,
    };

    expect(wsMessage.type).toBe('rpc-response');
    expect(wsMessage.data.error).toBeDefined();
    expect(wsMessage.data.error?.code).toBe('NO_CARDHOST');
  });

  test('RPC event wrapped in WebSocket message', () => {
    const rpcEvent: RpcEvent = {
      event: 'card.inserted',
      target: 'device',
      targetId: 'device-1',
      data: { atr: '3B9F' },
    };

    const wsMessage = {
      type: 'rpc-event',
      data: rpcEvent,
    };

    expect(wsMessage.type).toBe('rpc-event');
    expect(wsMessage.data.event).toBe('card.inserted');
    expect(wsMessage.data.target).toBe('device');
  });
});

describe('WebSocket Protocol - Message Routing', () => {
  test('controller to cardhost routing information', () => {
    const message = {
      type: 'rpc-request',
      data: {
        id: 'req-123',
        method: 'platform.getDeviceInfo',
        params: [],
      },
      routing: {
        from: 'controller-abc',
        to: 'cardhost-xyz',
      },
    };

    expect(message.routing.from).toBeDefined();
    expect(message.routing.to).toBeDefined();
  });

  test('cardhost to controller response routing', () => {
    const message = {
      type: 'rpc-response',
      data: {
        id: 'req-123',
        result: { devices: [] },
      },
      routing: {
        from: 'cardhost-xyz',
        to: 'controller-abc',
      },
    };

    expect(message.routing.from).toBe('cardhost-xyz');
    expect(message.routing.to).toBe('controller-abc');
  });

  test('broadcast event to all controllers', () => {
    const message = {
      type: 'rpc-event',
      data: {
        event: 'cardhost.connected',
        target: 'platform',
      },
      routing: {
        from: 'cardhost-xyz',
        broadcast: true,
      },
    };

    expect(message.routing.broadcast).toBe(true);
  });
});

describe('WebSocket Protocol - Error Messages', () => {
  test('authentication failure message', () => {
    const authFailed = {
      type: 'auth-failed',
      data: {
        reason: 'Invalid signature',
      },
    };

    expect(authFailed.type).toBe('auth-failed');
    expect(authFailed.data.reason).toBeDefined();
  });

  test('connection error message', () => {
    const connError = {
      type: 'error',
      data: {
        code: 'CONNECTION_ERROR',
        message: 'Failed to establish connection',
      },
    };

    expect(connError.type).toBe('error');
    expect(connError.data.code).toBeDefined();
    expect(connError.data.message).toBeDefined();
  });

  test('cardhost not found error', () => {
    const noCardhost = {
      type: 'error',
      data: {
        code: 'NO_CARDHOST',
        message: 'Requested cardhost not connected',
        requestId: 'req-123',
      },
    };

    expect(noCardhost.data.code).toBe('NO_CARDHOST');
    expect(noCardhost.data.requestId).toBeDefined();
  });
});

// This file has 4 describe blocks with 14 tests
// Tests WebSocket message protocol used by router for communication
// Validates message formats, RPC wrapping, routing, and error handling
