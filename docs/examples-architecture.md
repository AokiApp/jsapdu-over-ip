# Examples Architecture

## 🎯 Core Principle

**This examples directory demonstrates the usage of `@aokiapp/jsapdu-over-ip` library, which provides remote access to smart cards over IP networks by implementing the `@aokiapp/jsapdu-interface`.**

**Key Point**: All components MUST use the existing jsapdu-over-ip library (`@aokiapp/jsapdu-over-ip/client` and `@aokiapp/jsapdu-over-ip/server`). This is NOT a reimplementation - it is an EXAMPLE of how to use the library.

## jsapdu-interface Compliance

All implementations strictly follow `@aokiapp/jsapdu-interface`:

```typescript
// From @aokiapp/jsapdu-interface
export abstract class SmartCardPlatform {
  abstract init(): Promise<void>;
  abstract getDeviceInfo(): Promise<SmartCardDeviceInfo[]>;
  abstract getDevice(id: string): Promise<SmartCardDevice | null>;
  abstract cleanup(): Promise<void>;
}

export abstract class SmartCardDevice {
  abstract connect(): Promise<SmartCard>;
  abstract waitForCardPresent(timeoutMs?: number): Promise<void>;
  abstract waitForCardAbsent(timeoutMs?: number): Promise<void>;
  // ... other methods
}

export abstract class SmartCard {
  abstract transmit(command: CommandApdu): Promise<ResponseApdu>;
  abstract disconnect(): Promise<void>;
  abstract getATR(): Uint8Array;
  // ... other methods
}
```

**Controllers and cardhosts interact through these interfaces ONLY.** The jsapdu-over-ip library makes remote implementations indistinguishable from local ones.

## System Components

### 1. Controller (TypeScript - Browser Frontend)

**Purpose**: Frontend that uses `RemoteSmartCardPlatform` from `@aokiapp/jsapdu-over-ip/client` to access remote cards

**CRITICAL - Library Usage**:
```typescript
import { RemoteSmartCardPlatform } from '@aokiapp/jsapdu-over-ip/client';
import { CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';

// Create remote platform with custom transport
const platform = new RemoteSmartCardPlatform(customTransport);

// Use exactly like local platform - transparent!
await platform.init();
const devices = await platform.getDeviceInfo();
const device = await platform.getDevice(devices[0].id);
const card = await device.connect();
const response = await card.transmit(new CommandApdu(...));
```

**Key Features**:
- **Uses `RemoteSmartCardPlatform`** - NOT custom implementation
- **Implements `ClientTransport`** to connect to router
- Transparent access to remote cards via jsapdu-interface
- Browser-based GUI built on top of jsapdu operations
- Authentication handled by custom transport layer

**Technology Stack**:
- `@aokiapp/jsapdu-over-ip/client` - **PRIMARY DEPENDENCY**
- `@aokiapp/jsapdu-interface` - **INTERFACE COMPLIANCE**
- Custom `ClientTransport` implementation for router communication
- TypeScript + Vite for browser app

---

### 2. Cardhost (TypeScript - Node.js Service)

**Purpose**: Service that uses `SmartCardPlatformAdapter` from `@aokiapp/jsapdu-over-ip/server` to expose local cards over network

**CRITICAL - Library Usage**:
```typescript
import { SmartCardPlatformAdapter } from '@aokiapp/jsapdu-over-ip/server';
import { SmartCardPlatform } from '@aokiapp/jsapdu-interface';
// Real implementation (when available)
import { PcscPlatform } from '@aokiapp/jsapdu-pcsc';

// Wrap actual platform with adapter
const actualPlatform: SmartCardPlatform = new PcscPlatform();
const adapter = new SmartCardPlatformAdapter(
  actualPlatform,
  customServerTransport
);

// Adapter handles ALL RPC - you don't implement RPC!
await adapter.start();
```

**Key Features**:
- **Uses `SmartCardPlatformAdapter`** - NOT custom RPC implementation
- **Wraps real `SmartCardPlatform`** (PC/SC or mock)
- **Implements `ServerTransport`** to connect to router
- Adapter automatically handles all jsapdu-interface methods
- No manual RPC coding - library does everything
- Integrated monitor (separate concern from library usage)

**Technology Stack**:
- `@aokiapp/jsapdu-over-ip/server` - **PRIMARY DEPENDENCY**
- `@aokiapp/jsapdu-interface` - **INTERFACE COMPLIANCE**
- `@aokiapp/jsapdu-pcsc` - Real PC/SC implementation (when available)
- Custom `ServerTransport` implementation for router communication
- Node.js + TypeScript

**Monitor Integration**:
- Monitor is SEPARATE from jsapdu-over-ip library usage
- Monitors the adapter and actual platform
- HTTP UI for viewing connection status

---

### 3. Router (Java - Quarkus Server)

**Purpose**: Message broker that routes RPC messages between ClientTransport and ServerTransport

**CRITICAL - Router's Role**:
- Router does NOT understand jsapdu-interface
- Router does NOT process APDU commands
- Router ONLY routes `RpcRequest`/`RpcResponse` messages
- Router handles authentication and addressing

**Message Flow**:
```
Controller                Router                Cardhost
    |                        |                      |
    | RpcRequest (transmit)  |                      |
    |----------------------->|                      |
    |                        | RpcRequest (forward) |
    |                        |--------------------->|
    |                        |                      | [Execute on real card]
    |                        |  RpcResponse (result)|
    |                        |<---------------------|
    | RpcResponse (result)   |                      |
    |<-----------------------|                      |
```

**Key Features**:
- Routes RPC messages between endpoints
- WebSocket for bidirectional communication
- Authentication and authorization
- Cardhost discovery API
- Message broker pattern

**Technology Stack**:
- Quarkus for server framework
- WebSocket support
- PostgreSQL for cardhost registry
- Does NOT depend on jsapdu libraries

---

## Communication Architecture - Using jsapdu-over-ip Library

### Transport Abstraction

jsapdu-over-ip is **transport-agnostic**. The library defines `ClientTransport` and `ServerTransport` interfaces:

```typescript
// From @aokiapp/jsapdu-over-ip
export interface ClientTransport {
  call(request: RpcRequest): Promise<RpcResponse>;
  onEvent?(callback: (event: RpcEvent) => void): () => void;
  close?(): Promise<void>;
}

export interface ServerTransport {
  onRequest(handler: (request: RpcRequest) => Promise<RpcResponse>): void;
  emitEvent(event: RpcEvent): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

**Examples implement custom transports that communicate via router:**
- Controller implements `ClientTransport` using WebSocket to router
- Cardhost implements `ServerTransport` using WebSocket to router
- Library handles all jsapdu-interface RPC automatically

### RPC Message Format (Defined by Library)

```typescript
// From @aokiapp/jsapdu-over-ip/types
export interface RpcRequest {
  id: string;
  method: string;  // e.g., "platform.getDeviceInfo", "card.transmit"
  params: unknown[];
}

export interface RpcResponse {
  id: string;
  result?: unknown;
  error?: RpcError;
}

export interface RpcEvent {
  type: string;  // e.g., "cardInserted", "cardRemoved"
  data: unknown;
}
```

**Library automatically generates these for all jsapdu-interface methods.**

### Connection Flow

1. **Cardhost Setup**:
   ```typescript
   // Cardhost creates adapter with custom transport
   const routerTransport = new RouterServerTransport(routerUrl, uuid, keys);
   const actualPlatform = new PcscPlatform(); // or MockPlatform
   const adapter = new SmartCardPlatformAdapter(actualPlatform, routerTransport);
   
   await adapter.start(); // Adapter handles everything!
   ```

2. **Controller Setup**:
   ```typescript
   // Controller creates remote platform with custom transport
   const routerTransport = new RouterClientTransport(routerUrl, cardhostUuid);
   const platform = new RemoteSmartCardPlatform(routerTransport);
   
   await platform.init(); // Works like local platform!
   ```

3. **Transparent Operation**:
   ```typescript
   // Controller code - looks like local access!
   const devices = await platform.getDeviceInfo();
   const device = await platform.getDevice(devices[0].id);
   const card = await device.connect();
   
   const command = new CommandApdu(0x00, 0xA4, 0x04, 0x00, [/* data */]);
   const response = await card.transmit(command);
   
   console.log(response.sw1, response.sw2, response.data);
   ```

   Behind the scenes:
   - `RemoteSmartCardPlatform` calls `transport.call()`
   - Transport sends RpcRequest to router
   - Router forwards to cardhost
   - Cardhost's ServerTransport receives request
   - `SmartCardPlatformAdapter` dispatches to actual platform
   - Actual platform executes on real card
   - Response flows back through same path
   - Controller receives ResponseApdu - seamless!

### Authentication and Routing (Custom Transport Responsibility)

**jsapdu-over-ip library does NOT handle authentication.** Custom transports must implement:

- Authentication (public-key, JWT, etc.)
- Addressing (routing to correct cardhost by UUID)
- Connection management
- Reconnection logic

**Router's responsibility**:
- Authenticate both endpoints
- Route RpcRequest to correct cardhost by UUID
- Forward RpcResponse back to controller
- Does NOT parse APDU or jsapdu methods

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Application Layer                                           │
│ ┌──────────────┐                        ┌──────────────┐   │
│ │  Controller  │                        │   Cardhost   │   │
│ │   Browser    │                        │   Node.js    │   │
│ └──────────────┘                        └──────────────┘   │
└──────┬──────────────────────────────────────────┬──────────┘
       │                                           │
       │  Uses jsapdu-interface                   │
       │                                           │
┌──────▼───────────────────────────────────────────▼──────────┐
│ jsapdu-over-ip Library Layer                                │
│ ┌──────────────────┐              ┌──────────────────────┐ │
│ │RemoteSmartCard   │              │SmartCardPlatform     │ │
│ │  Platform        │              │   Adapter            │ │
│ │  (client lib)    │              │  (server lib)        │ │
│ └────────┬─────────┘              └─────────┬────────────┘ │
│          │                                   │              │
│          │  ClientTransport                 │ ServerTransport
│          │  (custom)                        │  (custom)    │
└──────────┼───────────────────────────────────┼──────────────┘
           │                                   │
           │            RpcRequest/Response    │
┌──────────▼───────────────────────────────────▼──────────────┐
│ Transport Layer (Custom Implementation)                     │
│ ┌──────────────┐      ┌────────┐      ┌──────────────┐    │
│ │ WebSocket    │◄────►│ Router │◄────►│  WebSocket   │    │
│ │  Client      │      │        │      │   Client     │    │
│ └──────────────┘      └────────┘      └──────────────┘    │
│                       (Routes RPC,                         │
│                        handles auth)                       │
└────────────────────────────────────────────────────────────┘
           │                                   │
           │                                   │
┌──────────▼───────────────────────────────────▼──────────────┐
│ Physical Layer (jsapdu-interface implementations)           │
│                                 ┌────────────────────────┐  │
│                                 │  jsapdu-pcsc           │  │
│                                 │  (actual PC/SC impl)   │  │
│                                 └───────────┬────────────┘  │
│                                             │               │
│                                     ┌───────▼────────┐      │
│                                     │  Card Reader   │      │
│                                     │  (Hardware)    │      │
│                                     └────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Key Points**:
1. **Controller uses library client** (`RemoteSmartCardPlatform`)
2. **Cardhost uses library server** (`SmartCardPlatformAdapter`)
3. **Custom transports** handle router communication
4. **Router** only routes RPC messages
5. **Library handles** all jsapdu-interface method proxying

---

## Security Considerations

### Library vs Custom Implementation

**jsapdu-over-ip library**:
- Handles RPC serialization/deserialization
- Manages object lifecycle (devices, cards)
- Provides transparent proxy pattern
- Does NOT handle authentication

**Custom transport implementation**:
- MUST implement authentication
- MUST implement authorization
- MUST handle connection security (TLS/WSS)
- MUST implement addressing/routing

### Recommended: Public-Key Cryptography

- Cardhosts and controllers use ECDSA P-256 keys
- UUID for addressing only, NOT authentication
- Public keys for identity verification
- Challenge-response for authentication
- TLS/WSS for transport security

---

## What This Examples Directory Demonstrates

### ✅ Correct Usage of jsapdu-over-ip Library

1. **Controller demonstrates**:
   - Creating `RemoteSmartCardPlatform`
   - Implementing `ClientTransport` for custom routing
   - Using jsapdu-interface methods transparently
   - Handling CommandApdu/ResponseApdu properly

2. **Cardhost demonstrates**:
   - Creating `SmartCardPlatformAdapter`
   - Implementing `ServerTransport` for custom routing
   - Wrapping actual SmartCardPlatform (PC/SC or mock)
   - Letting library handle all RPC automatically

3. **Router demonstrates**:
   - Message brokering between transports
   - Authentication layer (separate from library)
   - Addressing and routing logic
   - WebSocket connection management

### ❌ What NOT to Do

1. **DO NOT reimplement RPC** - use library's RpcRequest/RpcResponse
2. **DO NOT manually serialize jsapdu types** - library handles it
3. **DO NOT create custom protocol** - use library's transport interface
4. **DO NOT bypass jsapdu-interface** - always use defined interfaces

---

## Monorepo Structure

```
examples/
├── shared/                      # Shared types for EXAMPLES ONLY
│   ├── src/
│   │   ├── transport-router.ts  # Router-specific transport extensions
│   │   └── types.ts             # Router message types (not RPC!)
│   └── package.json
│
├── cardhost/                    # Cardhost using jsapdu-over-ip/server
│   ├── src/
│   │   ├── index.ts             # Main entry: creates adapter
│   │   ├── config.ts            # UUID, keys configuration
│   │   ├── router-transport.ts  # ServerTransport implementation
│   │   ├── mock-platform.ts     # Mock SmartCardPlatform
│   │   └── monitor/             # HTTP monitoring UI
│   └── package.json
│       dependencies:
│         @aokiapp/jsapdu-over-ip: workspace:*  # ← USES LIBRARY
│         @aokiapp/jsapdu-interface: ^0.0.2     # ← COMPLIANT
│
├── controller/                  # Controller using jsapdu-over-ip/client
│   ├── src/
│   │   ├── index.ts             # Main entry: creates RemoteSmartCardPlatform
│   │   ├── router-transport.ts  # ClientTransport implementation
│   │   ├── ui.ts                # GUI using jsapdu-interface methods
│   │   └── crypto.ts            # Authentication helpers
│   └── package.json
│       dependencies:
│         @aokiapp/jsapdu-over-ip: workspace:*  # ← USES LIBRARY
│         @aokiapp/jsapdu-interface: ^0.0.2     # ← COMPLIANT
│
├── router/                      # Message broker (Java)
│   ├── src/main/
│   │   ├── java/.../
│   │   │   ├── resource/
│   │   │   │   └── RouterResource.java  # REST API
│   │   │   ├── websocket/
│   │   │   │   ├── CardhostWebSocket.java
│   │   │   │   └── ControllerWebSocket.java
│   │   │   └── service/
│   │   │       └── RoutingService.java  # RPC routing
│   │   └── resources/
│   └── build.gradle
│
└── README.md                    # Quick start guide
```

**Critical Dependencies**:
- Cardhost **MUST** depend on `@aokiapp/jsapdu-over-ip` for `SmartCardPlatformAdapter`
- Controller **MUST** depend on `@aokiapp/jsapdu-over-ip` for `RemoteSmartCardPlatform`
- Both **MUST** depend on `@aokiapp/jsapdu-interface` for types
- Router does **NOT** depend on jsapdu libraries (only routes messages)

---

## Development Workflow

### Prerequisites

- Node.js 20+ (for TypeScript components)
- Java 21+ (for router)
- PostgreSQL 15+ (for router)
- Understanding of jsapdu-interface
- Understanding of jsapdu-over-ip library

### Key Documentation to Read First

**Before implementing, READ:**
1. `@aokiapp/jsapdu-interface` README - understand the interface
2. `@aokiapp/jsapdu-over-ip` README - understand library usage
3. Main repository `/src/client/platform-proxy.ts` - see RemoteSmartCardPlatform
4. Main repository `/src/server/platform-adapter.ts` - see SmartCardPlatformAdapter
5. Main repository `/src/transport.ts` - understand transport interface

### Implementation Steps

1. **Implement Custom Transports**:
   - Create `RouterClientTransport implements ClientTransport`
   - Create `RouterServerTransport implements ServerTransport`
   - These handle router communication, NOT RPC

2. **Cardhost**:
   ```typescript
   import { SmartCardPlatformAdapter } from '@aokiapp/jsapdu-over-ip/server';
   
   const platform = new MockPlatform(); // or PcscPlatform
   const transport = new RouterServerTransport(config);
   const adapter = new SmartCardPlatformAdapter(platform, transport);
   await adapter.start();
   ```

3. **Controller**:
   ```typescript
   import { RemoteSmartCardPlatform } from '@aokiapp/jsapdu-over-ip/client';
   
   const transport = new RouterClientTransport(config);
   const platform = new RemoteSmartCardPlatform(transport);
   await platform.init();
   // Use like any SmartCardPlatform!
   ```

4. **Router**:
   - Implement WebSocket handlers
   - Route RpcRequest/RpcResponse between endpoints
   - Add authentication/authorization layer

---

## CI/CD

CI builds and tests using the library properly:

```yaml
- name: Verify library usage
  run: |
    # Check imports
    grep -r "from '@aokiapp/jsapdu-over-ip/client'" examples/controller/src/
    grep -r "from '@aokiapp/jsapdu-over-ip/server'" examples/cardhost/src/
    
    # Build and test
    npm run build
    npm run test
```

---

## Future Enhancements

These enhance the examples while still using the library:

1. **Additional Transport Implementations**:
   - HTTP long-polling transport
   - Server-Sent Events transport
   - gRPC transport

2. **Advanced Router Features**:
   - Load balancing
   - Connection pooling
   - Message queuing

3. **Enhanced Security**:
   - Hardware token support
   - Certificate-based auth
   - Rate limiting

4. **Better UI**:
   - React-based controller
   - Real-time event display
   - Card reader management

**All enhancements maintain library usage - never bypass jsapdu-over-ip!**
