# E2E Test Suite Documentation

## Overview

This document describes the comprehensive E2E test suite for jsapdu-over-ip. All E2E tests validate the complete three-program system:

```
Controller/Controller-CLI
        ↓ WebSocket
Router (Java/Quarkus)
        ↓ WebSocket
Cardhost-mock
        ↓ RPC
jsapdu-over-ip library → Mock SmartCard Platform
```

## Critical Requirements

**ALL E2E tests MUST:**
- Start Java Router process in `beforeAll`
- Use real WebSocket communication
- Test actual three-program integration
- **NO InMemoryTransport** (that's for unit tests)
- **NO fake "hello world" tests**

## E2E Test Files

### 1. three-program-stack.test.ts (4 tests)

Tests basic three-program system integration:

- ✅ Router starts successfully
- ✅ Cardhost connects to Router
- ✅ Controller can connect via WebSocket
- ✅ Messages route between controller and cardhost

**Purpose**: Validates fundamental system connectivity

**Key Features**:
- Starts Router on port 8090
- Single cardhost-mock instance
- Basic WebSocket communication
- RPC call routing verification

### 2. full-apdu-transmission.test.ts (4 tests)

Tests complete APDU transmission flow:

- ✅ Device discovery through router
- ✅ Device acquisition and card session
- ✅ APDU transmission through complete stack
- ✅ Multiple sequential APDUs

**Purpose**: Validates end-to-end APDU flow

**Key Features**:
- Uses RemoteSmartCardPlatform (client library)
- Uses SimpleClientTransport (controller-cli)
- Tests binary data preservation (ATR, APDU)
- Validates SW (status word) in responses

### 3. router-message-routing.test.ts (5 tests)

Tests Router's message routing with cardhost behavior observation:

- ✅ Router and cardhost connectivity
- ✅ Spy on platform.init call
- ✅ Observe platform.getDeviceInfo through controller
- ✅ Track RPC call sequence
- ✅ Measure RPC call performance

**Purpose**: Deep inspection of cardhost behavior through Router

**Key Features**:
- Cardhost imported as MODULE (not process)
- Extensive use of vi.spyOn() for observation
- Real MockSmartCardPlatform with spies
- Performance measurement (round-trip time)
- Uses real RouterServerTransport from cardhost-mock

### 4. multi-cardhost-routing.test.ts (4 tests)

Tests Router handling multiple simultaneous cardhosts:

- ✅ Router running
- ✅ Multiple cardhosts connected
- ✅ Device discovery from all cardhosts
- ✅ Concurrent APDU operations across cardhosts

**Purpose**: Validates Router's multi-client capabilities

**Key Features**:
- Spawns 2 cardhost-mock instances
- Tests device discovery aggregation
- Concurrent operations to different cardhosts
- Validates correct message routing

### 5. connection-stability.test.ts (4 tests)

Tests system behavior under connection stress:

- ✅ Router running check
- ✅ Cardhost reconnection after termination
- ✅ Controller WebSocket reconnection
- ✅ Resource cleanup after abrupt disconnect

**Purpose**: Validates error handling and reconnection logic

**Key Features**:
- Cardhost SIGTERM and restart
- Controller disconnect/reconnect
- SIGKILL (abrupt) cardhost termination
- Resource cleanup verification

## Test Configuration

Each test suite uses a unique Router port to avoid conflicts:

| Test File | Router Port |
|-----------|-------------|
| three-program-stack | 8090 |
| full-apdu-transmission | 8091 |
| router-message-routing | 8092 |
| multi-cardhost-routing | 8093 |
| connection-stability | 8094 |

## Running E2E Tests

### Prerequisites

1. **Java 21 installed**:
   ```bash
   export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
   # OR
   export JAVA_HOME_21=/path/to/java21
   ```

2. **Router built**:
   ```bash
   cd examples/router
   ./gradlew build -x test
   ```

3. **Cardhost-mock built**:
   ```bash
   cd examples/cardhost-mock
   npm install
   npm run build
   ```

4. **Shared built**:
   ```bash
   cd examples/shared
   npm install
   npm run build
   ```

5. **Main library built**:
   ```bash
   npm install
   npm run build
   ```

### Run All E2E Tests

```bash
npm test examples/tests/e2e/
```

### Run Individual Test Suite

```bash
npm test examples/tests/e2e/three-program-stack.test.ts
npm test examples/tests/e2e/full-apdu-transmission.test.ts
npm test examples/tests/e2e/router-message-routing.test.ts
npm test examples/tests/e2e/multi-cardhost-routing.test.ts
npm test examples/tests/e2e/connection-stability.test.ts
```

## Test Execution Flow

### 1. beforeAll Phase

```typescript
beforeAll(async () => {
  // 1. Check Java availability
  // 2. Start Router (./gradlew quarkusDev)
  // 3. Wait for Router startup (watch for "Listening on:" or "started in")
  // 4. Start cardhost-mock process(es)
  // 5. Wait for cardhost connection
  // 6. System stabilization delay (2-3 seconds)
}, TIMEOUT);
```

### 2. Test Execution

- Each test validates specific functionality
- Tests skip gracefully if Router/Cardhost not ready
- WebSocket connections created per-test basis
- Proper cleanup after each test

### 3. afterAll Phase

```typescript
afterAll(async () => {
  // 1. Terminate cardhost process(es)
  // 2. Terminate Router process
  // 3. Cleanup delay (5 seconds)
}, 15000);
```

## Typical Test Timeouts

- Router startup: 45 seconds
- Cardhost startup: 15 seconds per instance
- Test timeout: 90 seconds
- Cleanup timeout: 15 seconds

## Spy-Based Testing (router-message-routing.test.ts)

This test demonstrates a hybrid approach:

**Cardhost as Module**:
```typescript
// Import real components
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { RouterServerTransport } from '../../../examples/cardhost-mock/src/router-transport.js';

// Create spies BEFORE initialization
const platformInitSpy = vi.spyOn(mockPlatform, 'init');
const platformGetDeviceInfoSpy = vi.spyOn(mockPlatform, 'getDeviceInfo');

// Cardhost connects to Router via RouterServerTransport
const cardhostTransport = new RouterServerTransport(routerUrl, uuid, keyPair);
const platformAdapter = new SmartCardPlatformAdapter(mockPlatform, cardhostTransport);
await platformAdapter.start();
```

**Benefits**:
- Deep inspection of cardhost internals
- RPC call tracking
- Performance measurement
- State transition observation

## Common Issues

### Router fails to start

**Symptom**: Tests skip with "Router not available"

**Solutions**:
- Verify Java 21 is installed
- Set JAVA_HOME or JAVA_HOME_21 environment variable
- Check Router builds: `cd examples/router && ./gradlew build -x test`

### Cardhost fails to connect

**Symptom**: Tests skip with "Cardhost not ready"

**Solutions**:
- Verify cardhost-mock is built: `cd examples/cardhost-mock && npm run build`
- Check Router is actually listening
- Verify WebSocket URL is correct
- Check for port conflicts

### Tests timeout

**Symptom**: Tests exceed 90-second timeout

**Solutions**:
- Increase Router startup timeout
- Verify system has sufficient resources
- Check for network issues
- Review Router/Cardhost logs

## Test Organization Compliance

All tests adhere to project guidelines:

- ✅ Max 10 tests per describe block
- ✅ Max 4 describe blocks per file
- ✅ Files ≤ 300 lines (with justified exceptions)
- ✅ Meaningful tests over passing tests
- ✅ Focus on actual system behavior

## Test Coverage

### Functional Coverage

- ✅ Basic connectivity (Router ↔ Cardhost ↔ Controller)
- ✅ Device discovery
- ✅ Device acquisition
- ✅ Card session management
- ✅ APDU transmission (single and multiple)
- ✅ Binary data preservation
- ✅ Multi-cardhost scenarios
- ✅ Concurrent operations
- ✅ Reconnection handling
- ✅ Resource cleanup
- ✅ Error handling

### Non-Functional Coverage

- ✅ Performance measurement
- ✅ Connection stability
- ✅ Resource lifecycle
- ✅ Graceful degradation
- ✅ WebSocket protocol compliance

## Future Enhancements

Potential additional E2E tests:

1. **Performance benchmarks**: Throughput, latency measurements
2. **Load testing**: Many concurrent controllers
3. **Error injection**: Network failures, malformed messages
4. **Security testing**: Authentication, authorization
5. **Database integration**: If Router uses database
6. **Browser controller**: React controller E2E tests

## Summary

The E2E test suite provides comprehensive validation of the jsapdu-over-ip three-program system. All tests use real processes, real network communication, and validate actual system behavior. No fake "hello world" tests.

**Total**: 5 test files, 21 tests, 100% require Router to be running.
