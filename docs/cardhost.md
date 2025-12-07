# Cardhost Component

## 🎯 Purpose

**Cardhost is an EXAMPLE of using `@aokiapp/jsapdu-over-ip/server` to expose local smart card readers over the network.**

**CRITICAL**: This component uses `SmartCardPlatformAdapter` from the jsapdu-over-ip library. It does NOT reimplement RPC - the library handles everything.

## Library Usage

### Core Implementation

```typescript
import { SmartCardPlatformAdapter } from '@aokiapp/jsapdu-over-ip/server';
import type { ServerTransport } from '@aokiapp/jsapdu-over-ip';
import type { SmartCardPlatform } from '@aokiapp/jsapdu-interface';

// 1. Get actual platform (PC/SC or mock)
const actualPlatform: SmartCardPlatform = createActualPlatform();

// 2. Create custom transport for router communication
const routerTransport: ServerTransport = new RouterServerTransport({
  routerUrl: 'ws://router:8080/ws/cardhost',
  uuid: config.uuid,
  publicKey: config.publicKey,
  privateKey: config.privateKey,
});

// 3. Wrap platform with adapter - LIBRARY DOES THE REST
const adapter = new SmartCardPlatformAdapter(
  actualPlatform,
  routerTransport
);

// 4. Start - adapter handles ALL RPC automatically
await adapter.start();
```

**That's it!** The library's `SmartCardPlatformAdapter` automatically:
- Handles all jsapdu-interface methods
- Serializes/deserializes RPC messages
- Manages device and card lifecycle
- Forwards events to transport
- You don't write RPC code!

## Key Points

### ✅ DO

- Use `SmartCardPlatformAdapter` from library
- Implement `ServerTransport` for router communication
- Use actual `SmartCardPlatform` implementation (PC/SC or mock)
- Let library handle all RPC
- Focus on transport, authentication, configuration

### ❌ DON'T

- Reimplement RPC handling
- Manually serialize jsapdu types
- Parse method names and dispatch manually
- Bypass the library adapter
- Create custom protocol

## Dependencies

```json
{
  "dependencies": {
    "@aokiapp/jsapdu-over-ip": "workspace:*",  // ← PRIMARY LIBRARY
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@aokiapp/jsapdu-interface": "^0.0.2",      // ← INTERFACE
    "typescript": "^5.9.3"
  }
}
```
