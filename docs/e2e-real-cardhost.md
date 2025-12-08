# Real Cardhost E2E Testing

## Overview

E2E tests validate the complete three-program stack using **real Router JAR** and **real cardhost** with temporary spy injection.

## Architecture

```
Controller-CLI (Real)
        ↓ WebSocket
Router (Java JAR: build/quarkus-app/quarkus-run.jar) ← REAL BUILT ARTIFACT
        ↓ WebSocket
Cardhost (Real examples/cardhost with temporary mock injection)
        ↓ SmartCardPlatformAdapter (library)
MockSmartCardPlatform (inline, temporary)
```

## Key Points

### ✅ What We Use
- **Real Router JAR**: `build/quarkus-app/quarkus-run.jar` (built artifact, not dev mode)
- **Real Cardhost**: `examples/cardhost` (production code)
- **Inline Mock**: Self-contained MockSmartCardPlatform (no external dependencies)
- **Temporary Injection**: platform.ts modified only during test, restored in afterAll

### ❌ What We DON'T Use
- ❌ cardhost-mock (deleted)
- ❌ test-utils (deleted)
- ❌ `./gradlew quarkusDev` (uses JAR instead)
- ❌ Test modes or test entry points

## Real Cardhost Verification

`examples/cardhost/src/platform.ts` (production code):
```typescript
export async function getPlatform(): Promise<SmartCardPlatform> {
  try {
    const pcscModule = await import("@aokiapp/jsapdu-pcsc");
    const { PcscPlatformManager } = pcscModule;
    const platformManager = PcscPlatformManager.getInstance();
    const platform = platformManager.getPlatform();
    console.log("✅ Using PC/SC platform (production)");
    return platform;
  } catch (error) {
    console.error("❌ PC/SC platform not available");
    throw new Error("PC/SC platform required for production cardhost");
  }
}
```

**Verification:**
- ✅ Only imports `@aokiapp/jsapdu-pcsc` (real PC/SC)
- ✅ Throws error if PC/SC unavailable
- ✅ Clear warnings against mock in production
- ✅ **NO mock code in implementation**

## Spy Injection Technique

### Process
1. **Save original**: Read `platform.ts` before modification
2. **Inject mock**: Write temporary inline MockSmartCardPlatform to `platform.ts`
3. **Rebuild**: `npm run build` in examples/cardhost
4. **Start**: Launch real cardhost with injected mock
5. **Test**: Run complete request-response cycles
6. **Restore**: Write original `platform.ts` back in afterAll

### Inline Mock (No Dependencies)
```typescript
class InlineMockSmartCardPlatform implements SmartCardPlatform {
  private devices = [
    { deviceId: 'mock-device-1', displayName: 'Mock Reader 1' }
  ];
  
  async init(): Promise<void> {}
  async release(): Promise<void> {}
  async getDeviceInfo(): Promise<any[]> {
    return this.devices;
  }
  async acquireDevice(deviceId: string): Promise<any> {
    return {
      deviceId,
      openSession: async () => ({
        getATR: async () => new Uint8Array([0x3B, 0x00]),
        transmit: async (apdu: any) => ({
          data: new Uint8Array([0x90, 0x00]),
          sw1: 0x90, sw2: 0x00
        }),
        release: async () => {}
      }),
      release: async () => {}
    };
  }
}
```

## E2E Test File

`examples/tests/e2e/real-cardhost-e2e.test.ts`

### Tests
1. **Complete Request-Response Cycle**
   - Controller → Router JAR → Real Cardhost
   - Init, getDeviceInfo, release
   - Validates full message flow

2. **Device Acquisition + APDU Transmission**
   - Complete device lifecycle
   - Card session management
   - ATR retrieval
   - APDU transmission with response

## Running Tests

### Prerequisites
```bash
# Build Router (creates build/quarkus-app/quarkus-run.jar)
cd examples/router
./gradlew build

# Build Cardhost
cd examples/cardhost
npm run build

# Java 21 required
export JAVA_HOME=/path/to/java21
```

### Run E2E Tests
```bash
cd examples
npm test -- e2e
```

## Test Output

Expected console output shows:
- `✅ Router built successfully`
- `[Router] Listening on: http://0.0.0.0:8095`
- `✅ Mock platform injected into platform.ts`
- `✅ Cardhost rebuilt with mock injection`
- `[Cardhost] ⚠️  Using INLINE MOCK for E2E testing`
- `[Cardhost] Cardhost is running - adapter handles all RPC!`
- `📤 Controller: Sending init through Router...`
- `📥 Controller: Received init response`
- `✅ COMPLETE REQUEST-RESPONSE CYCLE VALIDATED`
- `✅ Original platform.ts restored`

## Cleanup

Tests automatically:
1. Restore original `platform.ts` in `afterAll()`
2. Kill cardhost process
3. Kill Router process

**Important:** Original platform.ts is always restored, even if tests fail.

## Proof of Real Components

1. **Router JAR**: `java -jar build/quarkus-app/quarkus-run.jar` (not dev mode)
2. **Real Cardhost**: `examples/cardhost/dist/index.js` (built from production src)
3. **No Mock Directories**: cardhost-mock and test-utils deleted
4. **Production Code**: platform.ts only uses PC/SC in normal operation
