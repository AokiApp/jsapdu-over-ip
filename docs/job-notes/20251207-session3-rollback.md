# Session 3 Rollback - 2025-12-07

## What Happened

This session attempted to implement the examples but made critical errors in understanding the requirements. All code has been rolled back.

## Critical Mistakes Made

### 1. MockPlatform (WRONG!)
**What I did**: Created `examples/cardhost/src/mock-platform.ts` with a mock smart card implementation.

**Why it was wrong**: 
- Issue #2 states: "カードが挿入されていて" (a card is inserted)
- cardhost is meant to work with **REAL physical cards**
- The whole point is to demonstrate **actual remote card access**
- MockPlatform defeats the purpose of the example

**What should be done instead**:
- Use `@aokiapp/jsapdu-pcsc` for real PC/SC card readers
- Or clearly document that PC/SC is required
- readthecard uses mock for fallback, but primarily targets real cards

### 2. Controller UI (WRONG!)
**What I did**: Created Vanilla JavaScript/TypeScript browser UI.

**Why it was wrong**:
- Issue #2 explicitly states: "ReactかつuseStateやuseEffectの数が少なければ少ないほどいい"
- **React is REQUIRED**, not optional
- Should minimize useState/useEffect, but React is mandatory

**What should be done instead**:
- Use React with minimal state management
- Consider using refs and direct DOM manipulation where appropriate
- Use React but keep it simple and procedural where possible

### 3. No Router Implementation
**What I did**: Skipped router entirely.

**Why it was wrong**:
- Router is essential - without it, controller and cardhost cannot communicate
- Should be prioritized early
- Based on quarkus-crud template (Java/Quarkus)

## Correct Understanding of Architecture

### The Real Purpose
These examples demonstrate **jsapdu-over-ip** enabling **real remote card access**:
- Controller (browser) → Router → Cardhost → **Real physical card reader**
- Not mocks, not simulations, but actual cards
- Think: remote access to someone's physical card reader over the internet

### Component Roles

**Controller (React + TypeScript)**:
- Browser-based React app
- Uses `RemoteSmartCardPlatform` from jsapdu-over-ip/client
- Connects via WebSocket to router
- Sends APDU commands that execute on **real cards**
- Minimal React hooks (prefer refs/callbacks over useState/useEffect)

**Cardhost (Node.js + TypeScript)**:
- Uses `SmartCardPlatformAdapter` from jsapdu-over-ip/server
- Wraps **real PC/SC platform** (`@aokiapp/jsapdu-pcsc`)
- Exposes physical card readers over network
- No mocks - this is for **actual card reader hardware**

**Router (Java/Quarkus)**:
- Message broker
- Routes RPC between controller and cardhost
- WebSocket endpoints
- Authentication layer
- Based on quarkus-crud template

## Files Rolled Back

All changes from commit f5be5f5 have been reverted:

**Deleted (newly created files)**:
- `examples/cardhost/src/index.ts`
- `examples/cardhost/src/mock-platform.ts` ❌ (wrong concept)
- `examples/cardhost/src/router-transport.ts`
- `examples/controller/src/app.ts`
- `examples/controller/src/index.ts` ❌ (vanilla JS, not React)
- `examples/controller/src/router-transport.ts`
- `docs/job-notes/20251207-session3-implementation.md`

**Reverted (modified files)**:
- `examples/controller/public/index.html`
- `examples/controller/public/styles.css`

## Correct Implementation Plan

### Phase 1: Router (PRIORITY)
Without router, nothing else can work.

1. Create Java/Quarkus project based on quarkus-crud template
2. WebSocket endpoints:
   - `/ws/cardhost` - for cardhost connections
   - `/ws/controller` - for controller connections
3. Message routing service
4. Authentication layer
5. Cardhost registry (PostgreSQL)

### Phase 2: Cardhost
1. `RouterServerTransport` - WebSocket to router
2. Main entry point using `SmartCardPlatformAdapter`
3. **Use real PC/SC**: Import `@aokiapp/jsapdu-pcsc`
4. Configuration for UUID, keys, router URL
5. Integration with cardhost-monitor

### Phase 3: Controller
1. **React application** (not Vanilla JS!)
2. `RouterClientTransport` - WebSocket to router
3. Use `RemoteSmartCardPlatform` from jsapdu-over-ip/client
4. Minimal useState/useEffect - prefer:
   - useRef for DOM refs
   - Callbacks for events
   - Direct method calls
5. APDU command UI (CLA, INS, P1, P2, Data)
6. Device/card selection
7. Response display

### Phase 4: Testing
1. Run router
2. Connect cardhost with **real card reader**
3. Open controller in browser
4. Send APDUs to **real card**
5. Verify responses

## Key Learnings

1. **Read requirements carefully**: "React" means React, not "any UI framework"
2. **Understand the purpose**: This is for **real card access**, not mock testing
3. **Prioritize dependencies**: Router must come first, not last
4. **Mock is not always appropriate**: When demonstrating hardware access, use real hardware

## References for Correct Implementation

1. **readthecard**: Study how it handles real PC/SC
   - Falls back to mock only when PC/SC unavailable
   - Primary target is real cards
   
2. **jsapdu-pcsc**: Check how to integrate real card readers
   - Import and platform instantiation
   - Error handling when no readers present
   
3. **React best practices**: For minimal hooks
   - Use refs for values that don't trigger renders
   - Use callbacks instead of state for simple updates
   - Keep components functional but not over-reactive

## Next Steps

1. Implement router first (Java/Quarkus)
2. Implement cardhost with real PC/SC
3. Implement controller with React
4. Test end-to-end with real hardware
5. Document requirements (PC/SC drivers, card readers, etc.)

## Apology

I completely misunderstood the requirements:
- Created mock when real hardware was expected
- Used Vanilla JS when React was required
- Deprioritized router when it should be first

This session's work has been completely rolled back. Next session should start fresh with correct understanding.
