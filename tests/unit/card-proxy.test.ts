/**
 * Card Proxy Unit Tests
 * 
 * Tests the client-side SmartCard proxy to ensure:
 * 1. APDU commands are correctly serialized to RPC
 * 2. APDU responses are correctly deserialized from RPC
 * 3. Both CommandApdu and raw Uint8Array transmit work
 * 4. ATR, reset, and release operations work correctly
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { RemoteSmartCard } from '../../src/client/card-proxy.js';
import { InMemoryTransport } from '../../src/transport.js';
import { SmartCardDevice, CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';
import type { RpcRequest, RpcResponse, SerializedCommandApdu, SerializedResponseApdu } from '../../src/types.js';

describe('RemoteSmartCard - APDU Transmission (CommandApdu)', () => {
  let transport: InMemoryTransport;
  let card: RemoteSmartCard;
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockDevice: SmartCardDevice;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    // Create a minimal mock device
    mockDevice = {} as SmartCardDevice;
    card = new RemoteSmartCard(transport, 'card-handle-1', mockDevice);
  });

  test('transmit(CommandApdu) serializes to RPC correctly', async () => {
    const apdu = new CommandApdu(0x00, 0xA4, 0x04, 0x00, new Uint8Array([0x01, 0x02, 0x03]), 256);
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: {
        data: [0x90, 0x00],
        sw1: 0x90,
        sw2: 0x00,
      } as SerializedResponseApdu,
    });

    const response = await card.transmit(apdu);

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('card.transmit');
    expect(call.params).toHaveLength(2);
    expect(call.params?.[0]).toBe('card-handle-1');
    
    const serializedApdu = call.params?.[1] as SerializedCommandApdu;
    expect(serializedApdu.cla).toBe(0x00);
    expect(serializedApdu.ins).toBe(0xA4);
    expect(serializedApdu.p1).toBe(0x04);
    expect(serializedApdu.p2).toBe(0x00);
    expect(serializedApdu.data).toEqual([0x01, 0x02, 0x03]);
    expect(serializedApdu.le).toBe(256);
    
    expect(response).toBeInstanceOf(ResponseApdu);
    expect(response.sw1).toBe(0x90);
    expect(response.sw2).toBe(0x00);
  });

  test('transmit(CommandApdu) with null data works', async () => {
    const apdu = new CommandApdu(0x00, 0xA4, 0x04, 0x00, null, null);
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: {
        data: [],
        sw1: 0x6A,
        sw2: 0x82,
      } as SerializedResponseApdu,
    });

    await card.transmit(apdu);

    const call = mockHandler.mock.calls[0][0];
    const serializedApdu = call.params?.[1] as SerializedCommandApdu;
    expect(serializedApdu.data).toBeNull();
    expect(serializedApdu.le).toBeNull();
  });

  test('transmit response converts data array to Uint8Array', async () => {
    const apdu = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 256);
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: {
        data: [0x48, 0x65, 0x6C, 0x6C, 0x6F], // "Hello"
        sw1: 0x90,
        sw2: 0x00,
      } as SerializedResponseApdu,
    });

    const response = await card.transmit(apdu);

    expect(response.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(response.data)).toEqual([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
  });
});

describe('RemoteSmartCard - APDU Transmission (Raw Uint8Array)', () => {
  let transport: InMemoryTransport;
  let card: RemoteSmartCard;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    card = new RemoteSmartCard(transport, 'card-handle-1', {} as SmartCardDevice);
  });

  test('transmit(Uint8Array) converts to card.transmitRaw RPC', async () => {
    const rawApdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x03, 0x01, 0x02, 0x03]);
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: [0x90, 0x00],
    });

    const response = await card.transmit(rawApdu);

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('card.transmitRaw');
    expect(call.params).toEqual(['card-handle-1', Array.from(rawApdu)]);
    
    expect(response).toBeInstanceOf(Uint8Array);
    expect(Array.from(response)).toEqual([0x90, 0x00]);
  });
});

describe('RemoteSmartCard - ATR Operations', () => {
  let transport: InMemoryTransport;
  let card: RemoteSmartCard;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    card = new RemoteSmartCard(transport, 'card-handle-1', {} as SmartCardDevice);
  });

  test('getAtr() converts to card.getAtr RPC', async () => {
    const mockAtr = [0x3B, 0x9F, 0x95, 0x81, 0x31, 0xFE, 0x5D, 0x00, 0x64];
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: mockAtr,
    });

    const atr = await card.getAtr();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('card.getAtr');
    expect(call.params).toEqual(['card-handle-1']);
    
    expect(atr).toBeInstanceOf(Uint8Array);
    expect(Array.from(atr)).toEqual(mockAtr);
  });
});

describe('RemoteSmartCard - Card Lifecycle', () => {
  let transport: InMemoryTransport;
  let card: RemoteSmartCard;
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockDevice: any;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    mockDevice = {
      untrackCard: vi.fn(),
    };
    card = new RemoteSmartCard(transport, 'card-handle-1', mockDevice);
  });

  test('reset() converts to card.reset RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await card.reset();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('card.reset');
    expect(call.params).toEqual(['card-handle-1']);
  });

  test('release() converts to card.release RPC', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await card.release();

    expect(mockHandler).toHaveBeenCalledOnce();
    const call = mockHandler.mock.calls[0][0];
    expect(call.method).toBe('card.release');
    expect(call.params).toEqual(['card-handle-1']);
  });

  test('release() notifies parent device to untrack', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: null,
    });

    await card.release();

    expect(mockDevice.untrackCard).toHaveBeenCalledWith('card-handle-1');
  });
});

describe('RemoteSmartCard - Error Handling', () => {
  let transport: InMemoryTransport;
  let card: RemoteSmartCard;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    card = new RemoteSmartCard(transport, 'card-handle-1', {} as SmartCardDevice);
  });

  test('transmit error propagates correctly', async () => {
    const apdu = new CommandApdu(0x00, 0xA4, 0x04, 0x00, null, null);
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      error: {
        code: 'CARD_REMOVED',
        message: 'Card was removed during transmission',
      },
    });

    await expect(card.transmit(apdu)).rejects.toThrow('Card was removed during transmission');
  });

  test('getAtr error propagates correctly', async () => {
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      error: {
        code: 'NO_ATR',
        message: 'Card did not provide ATR',
      },
    });

    await expect(card.getAtr()).rejects.toThrow('Card did not provide ATR');
  });
});

// Additional describe block for complex APDU scenarios
describe('RemoteSmartCard - Complex APDU Scenarios', () => {
  let transport: InMemoryTransport;
  let card: RemoteSmartCard;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new InMemoryTransport();
    mockHandler = vi.fn<[RpcRequest], Promise<RpcResponse>>();
    transport.onRequest(mockHandler);
    
    card = new RemoteSmartCard(transport, 'card-handle-1', {} as SmartCardDevice);
  });

  test('handles large APDU data correctly', async () => {
    const largeData = new Uint8Array(255);
    for (let i = 0; i < 255; i++) {
      largeData[i] = i;
    }
    const apdu = new CommandApdu(0x00, 0xD6, 0x00, 0x00, largeData, null);
    
    mockHandler.mockResolvedValueOnce({
      id: 'test-id',
      result: {
        data: [],
        sw1: 0x90,
        sw2: 0x00,
      } as SerializedResponseApdu,
    });

    await card.transmit(apdu);

    const call = mockHandler.mock.calls[0][0];
    const serializedApdu = call.params?.[1] as SerializedCommandApdu;
    expect(serializedApdu.data).toHaveLength(255);
    expect(serializedApdu.data?.[0]).toBe(0);
    expect(serializedApdu.data?.[254]).toBe(254);
  });

  test('handles multiple sequential transmit calls', async () => {
    const apdu1 = new CommandApdu(0x00, 0xA4, 0x04, 0x00, new Uint8Array([0x01]), null);
    const apdu2 = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 256);
    
    mockHandler.mockResolvedValueOnce({
      id: 'id1',
      result: { data: [], sw1: 0x90, sw2: 0x00 } as SerializedResponseApdu,
    });
    mockHandler.mockResolvedValueOnce({
      id: 'id2',
      result: { data: [0xAA, 0xBB], sw1: 0x90, sw2: 0x00 } as SerializedResponseApdu,
    });

    const resp1 = await card.transmit(apdu1);
    const resp2 = await card.transmit(apdu2);

    expect(resp1.sw).toBe(0x9000);
    expect(resp2.sw).toBe(0x9000);
    expect(Array.from(resp2.data)).toEqual([0xAA, 0xBB]);
  });
});
