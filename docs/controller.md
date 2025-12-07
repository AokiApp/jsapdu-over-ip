# Controller Component

## 🎯 Purpose

**Controller is an EXAMPLE of using `@aokiapp/jsapdu-over-ip/client` to access remote smart card readers through a browser interface.**

**CRITICAL**: This component uses `RemoteSmartCardPlatform` from the jsapdu-over-ip library. All card operations use jsapdu-interface methods - this makes remote cards indistinguishable from local ones!

## Library Usage

### Core Implementation

```typescript
import { RemoteSmartCardPlatform } from '@aokiapp/jsapdu-over-ip/client';
import type { ClientTransport } from '@aokiapp/jsapdu-over-ip';
import { CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';

// 1. Create custom transport for router communication
const routerTransport: ClientTransport = new RouterClientTransport({
  routerUrl: 'ws://router:8080/ws/controller',
  targetCardhostUuid: selectedCardhostUuid,
  publicKey: myPublicKey,
  privateKey: myPrivateKey,
});

// 2. Create remote platform - LIBRARY DOES THE REST
const platform = new RemoteSmartCardPlatform(routerTransport);

// 3. Use exactly like local platform - TRANSPARENT!
await platform.init();
const devices = await platform.getDeviceInfo();
const device = await platform.getDevice(devices[0].id);
const card = await device.connect();

// 4. Send APDU - looks like local card access!
const command = new CommandApdu(0x00, 0xA4, 0x04, 0x00, data);
const response = await card.transmit(command);

console.log(`SW: ${response.sw1.toString(16)} ${response.sw2.toString(16)}`);
console.log(`Data: ${Array.from(response.data).map(b => b.toString(16)).join(' ')}`);
```

**That's it!** The library's `RemoteSmartCardPlatform` automatically:
- Implements complete `SmartCardPlatform` interface
- Serializes CommandApdu, deserializes ResponseApdu
- Manages remote device and card proxies
- Handles RPC calls transparently
- You just use jsapdu-interface methods!

## Application Structure

```
┌─────────────────────────────────────────────────────────┐
│ Browser UI (HTML/CSS/JS)                                │
│ - Cardhost selection                                    │
│ - APDU command builder                                  │
│ - Response viewer                                       │
│ - Communication log                                     │
└───────────────┬─────────────────────────────────────────┘
                │ Uses
                ▼
┌─────────────────────────────────────────────────────────┐
│ Application Logic (app.ts)                              │
│ - Manages UI state                                      │
│ - Calls jsapdu-interface methods                        │
│ - Handles user interactions                             │
└───────────────┬─────────────────────────────────────────┘
                │ Uses jsapdu-interface
                ▼
┌─────────────────────────────────────────────────────────┐
│ @aokiapp/jsapdu-over-ip/client Library                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │   RemoteSmartCardPlatform                           │ │
│ │   - Implements SmartCardPlatform                    │ │
│ │   - Creates RemoteSmartCardDevice proxies           │ │
│ │   - Creates RemoteSmartCard proxies                 │ │
│ │   - Handles ALL RPC automatically                   │ │
│ └──────────────┬──────────────────────────────────────┘ │
└────────────────┼────────────────────────────────────────┘
                 │ Uses
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Custom ClientTransport Implementation                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │   RouterClientTransport                             │ │
│ │   - Connects to router via WebSocket                │ │
│ │   - Handles authentication                          │ │
│ │   - Sends RpcRequest to router                      │ │
│ │   - Receives RpcResponse from router                │ │
│ │   - Specifies target cardhost UUID                  │ │
│ └──────────────┬──────────────────────────────────────┘ │
└────────────────┼────────────────────────────────────────┘
                 │ WebSocket
                 ▼
           ┌──────────┐
           │  Router  │
           └──────────┘
```

## Example Usage

### Typical Flow

```typescript
// 1. Discover cardhosts via REST API
const cardhosts = await apiClient.listCardhosts();

// 2. User selects cardhost
const selected = cardhosts[0];

// 3. Create transport targeting that cardhost
const transport = new RouterClientTransport({
  routerUrl: 'ws://router:8080/ws/controller',
  targetCardhostUuid: selected.uuid,
  // ... auth config
});

// 4. Create remote platform
const platform = new RemoteSmartCardPlatform(transport);

// 5. Use jsapdu-interface - looks like local!
await platform.init();
const devices = await platform.getDeviceInfo();

// Display available readers
devices.forEach(device => {
  console.log(`Reader: ${device.friendlyName}`);
  console.log(`Supports APDU: ${device.supportsApdu}`);
});

// 6. Get device and connect to card
const device = await platform.getDevice(devices[0].id);
const card = await device.connect();

// 7. Get ATR
const atr = card.getATR();
console.log(`ATR: ${Array.from(atr).map(b => b.toString(16)).join(' ')}`);

// 8. Send SELECT command
const selectAid = [0xA0, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03];
const selectCmd = new CommandApdu(0x00, 0xA4, 0x04, 0x00, new Uint8Array(selectAid));
const selectResp = await card.transmit(selectCmd);

if (selectResp.sw1 === 0x90 && selectResp.sw2 === 0x00) {
  console.log('SELECT successful');
} else {
  console.error(`SELECT failed: ${selectResp.sw1} ${selectResp.sw2}`);
}

// 9. Clean up
await card.disconnect();
await platform.cleanup();
```

## Key Points

### ✅ DO

- Use `RemoteSmartCardPlatform` from library
- Use `CommandApdu` and `ResponseApdu` from jsapdu-interface
- Implement `ClientTransport` for router communication
- Let library handle all RPC
- Focus on UI, transport, and authentication

### ❌ DON'T

- Create custom APDU types - use jsapdu-interface
- Manually serialize/deserialize RPC
- Bypass RemoteSmartCardPlatform
- Reimplement card/device proxies
- Parse hex strings manually - use CommandApdu

## Dependencies

```json
{
  "dependencies": {
    "@aokiapp/jsapdu-over-ip": "workspace:*",  // ← PRIMARY LIBRARY
  },
  "devDependencies": {
    "@aokiapp/jsapdu-interface": "^0.0.2",      // ← INTERFACE
    "vite": "^5.4.11",
    "typescript": "^5.9.3"
  }
}
```

## UI Implementation

UI should work with jsapdu-interface types:

```typescript
// APDU input handling
async function sendApdu(hexString: string) {
  // Parse hex to bytes
  const bytes = parseHexString(hexString);
  
  // Create CommandApdu (jsapdu-interface type)
  const command = new CommandApdu(
    bytes[0], // CLA
    bytes[1], // INS
    bytes[2], // P1
    bytes[3], // P2
    bytes.slice(5) // Data (if Lc > 0)
  );
  
  // Transmit using jsapdu-interface method
  const response = await card.transmit(command);
  
  // Display using jsapdu-interface properties
  displayResponse(response.sw1, response.sw2, response.data);
}
```

## References

- Main library: `/src/client/platform-proxy.ts`
- Transport interface: `/src/transport.ts`
- jsapdu-interface: `@aokiapp/jsapdu-interface`
