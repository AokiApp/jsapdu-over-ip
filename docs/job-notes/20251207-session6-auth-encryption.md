# Session 6 - Authentication and Encryption Implementation

**Date:** December 7, 2025  
**Start Time:** 15:11 UTC  
**Session ID:** session6-auth-encryption

## Objective

Implement authentication and end-to-end encryption system for jsapdu-over-ip router as per issue requirements:
- Public-key cryptography throughout
- Cardhost: Fixed key pair for authentication
- Controller: Bearer-based authentication  
- End-to-end encryption between controller and cardhost
- Router handles party authentication using (EC)DHE
- Session tokens for HTTP → WebSocket upgrade

## Session Progress

### ✅ Completed

#### 1. Repository Setup (15:11-15:15 UTC)
- ✅ Cloned reference repositories to /tmp:
  - /tmp/quarkus-crud - Quarkus template
  - /tmp/jsapdu - jsapdu interface definitions
  - /tmp/jsapdu-over-ip-ref - This repository reference
  - /tmp/readthecard - Usage example
- ✅ Reviewed previous session notes
- ✅ Assessed current implementation status

#### 2. Exception Handling Restoration (15:15-15:20 UTC)
- ✅ Created `support/ErrorResponse.java` - Standard error response format
- ✅ Created `support/ConstraintViolationExceptionMapper.java` - Bean validation error handling
- ✅ Created `support/WebApplicationExceptionMapper.java` - Web exception error handling
- ✅ Verified build succeeds with exception mappers

#### 3. Metrics Integration (15:20-15:25 UTC)
- ✅ Added Micrometer metrics to `RoutingService`:
  - Counter for controller registrations
  - Counter for message routing (tagged by direction)
  - Counter for routing failures (tagged by reason)
  - Timer for routing operation duration
- ✅ Added Micrometer metrics to `CardhostService`:
  - Gauge for connected cardhosts count
  - Gauge for total known cardhosts count
  - Counter for cardhost registrations
  - Counter for cardhost disconnections
- ✅ Verified build succeeds with metrics

#### 4. Security Architecture Design (15:25-15:26 UTC)
- ✅ Created comprehensive security architecture document
- ✅ Documented threat model and cryptographic primitives
- ✅ Designed authentication flows for cardhost and controller
- ✅ Designed end-to-end encryption protocol (ECDHE)
- ✅ Defined implementation phases

#### 5. Session Token Authentication (15:26-15:27 UTC)
- ✅ Implemented `SessionTokenManager` for single-use tokens
- ✅ Implemented `SecurityScheduler` for token cleanup
- ✅ Updated `ControllerResource` to generate tokens
- ✅ Updated `ControllerWebSocket` to validate tokens on upgrade
- ✅ Added Quarkus scheduler dependency

#### 6. Cardhost Challenge-Response Authentication (15:27-15:28 UTC)
- ✅ Implemented `CryptoUtils` for ECDSA operations
- ✅ Updated `CardhostWebSocket` with challenge-response flow:
  - Step 1: Cardhost sends auth-request with UUID + public key
  - Step 2: Router generates and sends auth-challenge with nonce
  - Step 3: Cardhost signs nonce and sends auth-response with signature
  - Step 4: Router verifies signature and registers cardhost
- ✅ Added authentication state tracking per connection
- ✅ Verified build succeeds

### 🔄 In Progress

#### 7. End-to-End Encryption (Not Started)
- [ ] Implement ECDHE key exchange
- [ ] Implement session key derivation (HKDF)
- [ ] Implement message encryption/decryption (AES-GCM)
- [ ] Add message authentication codes (MAC)

### ⏳ Pending

## Technical Decisions

### Exception Handling
- **Decision:** Restore exception mappers from quarkus-crud template
- **Rationale:** Provides consistent error response format across all endpoints
- **Impact:** Better error handling for REST API and validation errors

### Metrics Integration
- **Decision:** Use Micrometer with Counters, Gauges, and Timers
- **Rationale:** Production-ready observability following template patterns
- **Metrics Added:**
  - `router.controllers.registered` - Controller registration count
  - `router.cardhosts.registered` - Cardhost registration count
  - `router.cardhosts.disconnected` - Cardhost disconnection count
  - `router.cardhosts.connected` - Currently connected cardhosts (gauge)
  - `router.cardhosts.total` - Total known cardhosts (gauge)
  - `router.messages.routed` - Message routing count (tagged by direction)
  - `router.messages.failed` - Failed routing count (tagged by reason)
  - `router.messages.route.time` - Message routing duration (timer)

## Files Modified

### Created (6 files)
1. `examples/router/src/main/java/app/aoki/quarkuscrud/support/ErrorResponse.java`
2. `examples/router/src/main/java/app/aoki/quarkuscrud/support/ConstraintViolationExceptionMapper.java`
3. `examples/router/src/main/java/app/aoki/quarkuscrud/support/WebApplicationExceptionMapper.java`
4. `docs/security-architecture.md`
5. `examples/router/src/main/java/app/aoki/quarkuscrud/crypto/CryptoUtils.java`
6. `examples/router/src/main/java/app/aoki/quarkuscrud/crypto/SessionTokenManager.java`
7. `examples/router/src/main/java/app/aoki/quarkuscrud/crypto/SecurityScheduler.java`

### Modified (4 files)
1. `examples/router/src/main/java/app/aoki/quarkuscrud/service/RoutingService.java`
   - Added MeterRegistry injection
   - Added metrics to registerController()
   - Added metrics to routeToCardhost() with timing
   - Added metrics to routeToControllers() with timing
2. `examples/router/src/main/java/app/aoki/quarkuscrud/service/CardhostService.java`
   - Added MeterRegistry injection
   - Added PostConstruct method for gauge initialization
   - Added metrics to registerCardhost()
   - Added metrics to unregisterCardhost()
3. `examples/router/src/main/java/app/aoki/quarkuscrud/resource/ControllerResource.java`
   - Added SessionTokenManager injection
   - Generate session token for WebSocket upgrade
   - Include token in WebSocket URL
4. `examples/router/src/main/java/app/aoki/quarkuscrud/websocket/ControllerWebSocket.java`
   - Validate session token on connection
   - Enforce authentication before message processing
   - Extract query parameters from handshake
5. `examples/router/src/main/java/app/aoki/quarkuscrud/websocket/CardhostWebSocket.java`
   - Implement challenge-response authentication
   - Track authentication state per connection
   - Verify signature before registration
   - Enforce authentication before message routing
6. `examples/router/build.gradle`
   - Added quarkus-scheduler dependency

## Build Verification

```bash
$ cd examples/router
$ export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
$ ./gradlew compileJava

BUILD SUCCESSFUL in 2-5s
```

## Next Steps

1. **Design Authentication Architecture**
   - Research ECDHE implementation in Java
   - Design cardhost key pair management
   - Design controller bearer token format
   - Design session token lifecycle

2. **Implement Cardhost Authentication**
   - Generate ECDSA/EdDSA key pairs
   - Store keys securely in cardhost config
   - Implement challenge-response protocol
   - Add signature verification

3. **Implement Controller Authentication**
   - Bearer token generation
   - Token validation
   - Session token for WebSocket upgrade

4. **Implement E2E Encryption**
   - ECDHE key exchange
   - Session key derivation
   - Message encryption/decryption
   - MAC for message authentication

## Time Tracking

- **Session Start:** 15:11 UTC
- **Repository Setup:** 15:11-15:15 (4 min)
- **Exception Handling:** 15:15-15:20 (5 min)
- **Metrics Integration:** 15:20-15:25 (5 min)
- **Security Design:** 15:25-15:26 (1 min)
- **Session Tokens:** 15:26-15:27 (1 min)
- **Cardhost Auth:** 15:27-15:28 (1 min)
- **Current Time:** 15:28 UTC
- **Elapsed:** 17 minutes

## References

- Issue #2: Authentication and encryption requirements
- Session 5 notes: Previous implementation status
- /tmp/quarkus-crud: Template patterns for exception handling and metrics
- Micrometer documentation: https://micrometer.io/
