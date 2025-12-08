# E2E Tests with Spy Injection

## Overview

All E2E tests use **REAL cardhost code** with **pure spy injection** - no test modes, no test versions.

## Architecture

```
Controller-CLI (Real)
        ↓ WebSocket
Router (Java/Quarkus:8094+) ← REQUIRED
        ↓ WebSocket
REAL Cardhost Process (spy-injected getPlatform)
        ↓ SmartCardPlatformAdapter (from jsapdu-over-ip library)
MockSmartCardPlatform (spy-wrapped for observation)
```

## Spy Injection Strategy

### What We Do
1. **Temporarily modify** `examples/cardhost/src/platform.ts`
2. **Inject** `MockSmartCardPlatform` import and usage
3. **Rebuild** cardhost with injected code (`npm run build`)
4. **Start** real cardhost process(es)
5. **Test** complete stack with spy observation
6. **Restore** original platform.ts

### What We DON'T Do
- ❌ No `test-entry.ts` or test mode files
- ❌ No `TestCardhost` class
- ❌ No test-specific versions of cardhost
- ❌ No permanent test code in cardhost

### Injected Code Example

```typescript
// Temporary injection into platform.ts during test setup
import type { SmartCardPlatform } from "@aokiapp/jsapdu-interface";
import { MockSmartCardPlatform } from "../../test-utils/src/mock-platform.js";

export async function getPlatform(): Promise<SmartCardPlatform> {
  console.log("⚠️  Using SPY-INJECTED mock platform for E2E testing");
  return new MockSmartCardPlatform();
}
```

## Test Files

### 1. real-cardhost-spy-injection.test.ts (4 tests)

Single REAL cardhost with spy-injected mock platform.

**Tests:**
1. Complete request-response cycle (init, getDeviceInfo, release)
2. Device acquisition through real cardhost
3. APDU transmission through complete stack
4. Multiple sequential APDUs

**Validates:**
- Controller → Router → REAL Cardhost → Mock Platform
- Full RPC flow using library's SmartCardPlatformAdapter
- Binary data preservation (ATR, APDU responses)

### 2. multi-cardhost-spy-injection.test.ts (3 tests)

Multiple REAL cardhost processes (3 instances).

**Tests:**
1. Device discovery across multiple cardhosts
2. Concurrent device acquisitions to different cardhosts
3. APDU transmission to different cardhosts simultaneously

**Validates:**
- Router's multi-client routing
- Concurrent operations across cardhosts
- Proper isolation between cardhost instances

## Running Tests

### Prerequisites

1. **Java 21** installed:
   ```bash
   export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
   # or
   export JAVA_HOME_21=/usr/lib/jvm/temurin-21-jdk-amd64
   ```

2. **Build all examples**:
   ```bash
   cd examples/router && ./gradlew build
   cd examples/cardhost && npm install && npm run build
   cd examples/controller-cli && npm install && npm run build
   cd examples/shared && npm install && npm run build
   cd examples/test-utils && npm install && npm run build
   ```

3. **Build main library**:
   ```bash
   npm install && npm run build
   ```

### Run E2E Tests

```bash
# Run specific E2E test
npm test -- examples/tests/e2e/real-cardhost-spy-injection.test.ts

# Run all E2E tests
npm test -- examples/tests/e2e/
```

### Expected Output

```
🚀 Starting Real Cardhost with Spy Injection E2E Test
   Using REAL cardhost with dynamic spy injection
🔷 Starting Router on port 8094...
✅ Router started
🔶 Injecting spy-wrapped mock platform into REAL cardhost...
✅ Spy injection completed - platform.ts temporarily modified
🔨 Rebuilding cardhost with spy-injected platform...
✅ Cardhost rebuilt with spy injection
🟢 Starting REAL Cardhost process (with spy-injected mock)...
✅ REAL Cardhost started with spy-injected mock platform
✅ Original platform.ts restored

📊 Test: Complete Request-Response Cycle
   Controller → Router → REAL Cardhost (spy-injected) → Mock Platform
📤 Controller: Sending init request through router...
📥 Controller: Received init response from REAL cardhost
📤 Controller: Requesting device info through router...
📥 Controller: Received device info: [...]
✅ COMPLETE REQUEST-RESPONSE CYCLE VALIDATED
```

## Test Organization

- **Max 10 tests per describe block** ✅
- **Max 4 describe blocks per file** ✅
- **Files under 300 lines** ✅
- **No permanent test code in production cardhost** ✅

## Why This Approach?

### Advantages
1. **Tests REAL code**: Uses actual cardhost implementation, not a mock version
2. **No test pollution**: Production cardhost has no test-specific code
3. **Library validation**: Tests the actual SmartCardPlatformAdapter from jsapdu-over-ip
4. **Spy observation**: Can observe internal behavior without modifying prod code
5. **True E2E**: Complete request-response cycle through all layers

### How It's Different from cardhost-mock
- **cardhost-mock**: Separate project with simplified mock implementation
- **This approach**: Injects mock into REAL cardhost, tests real adapter logic

## Cleanup

Tests automatically restore original `platform.ts` in `afterAll()` hook. If tests are interrupted:

```bash
cd examples/cardhost
git checkout src/platform.ts
npm run build
```

## Timeouts

- Router startup: 45 seconds
- Cardhost startup: 10 seconds
- Test timeout: 90 seconds per test

Adjust in CONFIG if needed for slower systems.

## Common Issues

### "Router failed to start"
- Ensure Java 21 is installed and JAVA_HOME is set
- Check port 8094+ is available
- Ensure router was built: `cd examples/router && ./gradlew build`

### "Cardhost build failed"
- Check test-utils is built: `cd examples/test-utils && npm install && npm run build`
- Verify main library is built: `npm run build` in root

### "System not ready"
- Tests will skip if Router or Cardhost don't start
- Check console logs for specific error messages
- Increase timeouts in CONFIG if on slow system

## Future Improvements

Potential enhancements while maintaining spy-injection-only approach:

1. **Runtime spy injection**: Inject mocks at runtime without file modification
2. **Spy observation dashboard**: Real-time spy call visualization
3. **Performance profiling**: Measure request-response times with spies
4. **Error injection**: Test error handling by injecting failures via spies

All while maintaining: **NO test modes, NO test versions - only spy injection!**
