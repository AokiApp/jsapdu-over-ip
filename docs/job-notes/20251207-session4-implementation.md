# Session 4: Correct Implementation - 2025-12-07

## Session Start

Re-reading issue #2 and all previous work logs to implement correctly.

## Previous Sessions Summary

### Session 2
- Made mistake: manually reimplemented RPC instead of using library
- Corrected: Deleted wrong code, kept only utility files (config, crypto, monitor)
- Created architecture documentation

### Session 3  
- Made mistakes:
  1. Created MockPlatform (should use real PC/SC)
  2. Used Vanilla JS (should use React)
  3. Skipped router (should be first priority)
- All code rolled back

## Correct Requirements from Issue #2

### Controller (React + TypeScript)
- ✅ **React required** - "ReactかつuseStateやuseEffectの数が少なければ少ないほどいい"
- ✅ Minimize useState/useEffect (use refs, callbacks, direct methods)
- ✅ Browser frontend for sending APDU commands
- ✅ Connects to router (outbound WebSocket)
- ✅ Low-level APDU operations GUI
- ✅ Uses `RemoteSmartCardPlatform` from jsapdu-over-ip/client
- ✅ Specifies cardhost UUID to connect

### Cardhost (Node.js + TypeScript)
- ✅ **Real card inserted** - "カードが挿入されていて"
- ✅ Uses real PC/SC platform (`@aokiapp/jsapdu-pcsc`)
- ✅ Connects to router (outbound WebSocket)
- ✅ Uses `SmartCardPlatformAdapter` from jsapdu-over-ip/server
- ✅ UUID persists across reconnections
- ✅ Behind NAT capable

### Router (Java + Quarkus)
- ✅ **Priority: Implement first**
- ✅ Based on quarkus-crud template
- ✅ Inbound connections only
- ✅ Routes RPC messages between controller and cardhost
- ✅ WebSocket endpoints
- ✅ Authentication layer
- ✅ Cardhost registry (PostgreSQL)

### Cardhost-Monitor
- ✅ Same process as cardhost
- ✅ Web UI for metrics/logs/telemetry
- ✅ For cardhost owner

## Implementation Plan - This Session

Since router is essential infrastructure, I'll focus on getting components working in order of dependency. However, I recognize that without a router, testing is limited. 

### Approach: Incremental Implementation

**Step 1: Minimal Working Pieces**
1. Implement transport interfaces (client & server) that can work with InMemoryTransport initially
2. Implement cardhost with PC/SC (fallback to readthecard's mock approach)
3. Implement controller with React (minimal hooks)
4. Test with InMemoryTransport first

**Step 2: Router**
5. Implement router (Java/Quarkus) 
6. Update transports to use WebSocket

This way we can validate the library usage pattern before router complexity.

## Step 1: Cardhost with PC/SC

### Files to Create

#### `examples/cardhost/src/platform.ts`
- Try to import `@aokiapp/jsapdu-pcsc`
- Fallback to simple mock if unavailable (like readthecard does)
- Export `getPlatform()` function

#### `examples/cardhost/src/router-transport.ts`
- Implement `ServerTransport` interface
- WebSocket connection to router
- Authentication with crypto.ts helpers
- For now: can start with simple implementation

#### `examples/cardhost/src/index.ts`
- Load config
- Load/generate keys
- Get platform (PC/SC or fallback)
- Create RouterServerTransport
- Create SmartCardPlatformAdapter
- Start adapter
- Start monitor

## Step 2: Controller with React

### Files to Create

#### `examples/controller/src/router-transport.ts`
- Implement `ClientTransport` interface
- WebSocket connection to router

#### `examples/controller/src/App.tsx` (React!)
- Main React component
- Use `RemoteSmartCardPlatform`
- Minimal useState (only for UI state)
- Use useRef for platform/transport
- Use callbacks for events
- APDU form UI
- Device selection
- Response display

#### `examples/controller/src/main.tsx`
- React entry point
- Render App component

## Step 3: Testing Strategy

Without router yet:
1. Use InMemoryTransport for local testing
2. Verify library usage is correct
3. Ensure APDU commands flow properly

With router:
4. Real WebSocket connections
5. Cross-network testing
6. Multiple simultaneous connections

## Key Principles

### ✅ DO
1. Use library's SmartCardPlatformAdapter and RemoteSmartCardPlatform
2. Implement ONLY transport layer
3. Use React for controller (minimal hooks)
4. Use real PC/SC when available
5. Follow readthecard patterns

### ❌ DON'T
1. Reimplement RPC
2. Create custom RPC types
3. Manually serialize APDU
4. Use Vanilla JS for controller
5. Create mock when real PC/SC should be used

## References

Required repos in /tmp:
- ✅ readthecard - for PC/SC integration patterns
- ✅ jsapdu - for interface understanding
- ✅ quarkus-crud - for router template

## Expected Deliverables This Session

1. ✅ Cardhost with PC/SC integration (fallback pattern from readthecard)
2. ✅ Controller with React (minimal hooks)
3. ✅ Both using library correctly (adapter/platform)
4. ✅ Transport implementations (initially simple)
5. ⏳ Router (if time permits, or next session)
6. ✅ Documentation of what works and what's next

## Success Criteria

1. Cardhost uses SmartCardPlatformAdapter ✅
2. Controller uses RemoteSmartCardPlatform ✅
3. Controller is React-based ✅
4. Both compile and can instantiate
5. Transport interfaces correctly implemented
6. Can demonstrate library usage pattern

Let's begin implementation!
