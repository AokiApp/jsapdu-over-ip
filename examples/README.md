# jsapdu-over-ip Examples

This directory contains example implementations demonstrating how to use jsapdu-over-ip for remote smart card access.

## ✅ Current Status

**Implementation complete - ready for testing!**

- ✅ Architecture documentation complete
- ✅ Package structure created
- ✅ Cardhost implementation using SmartCardPlatformAdapter
- ✅ Controller implementation using RemoteSmartCardPlatform (React)
- ✅ Router WebSocket implementation (Java/Quarkus)
- ✅ Authentication system (challenge-response + session tokens)
- ✅ Exception handling and metrics
- ✅ All components build successfully
- ⏳ End-to-end testing in progress
- ⏳ End-to-end encryption (future enhancement)

## Security Features

The router implements a comprehensive authentication system:

### Cardhost Authentication
- **Challenge-Response Protocol**: ECDSA signature-based authentication
- **Public Key Infrastructure**: Each cardhost has a fixed ECDSA P-256 key pair
- **Flow**:
  1. Cardhost sends auth-request with UUID and public key
  2. Router generates challenge nonce
  3. Cardhost signs nonce with private key
  4. Router verifies signature and registers cardhost

### Controller Authentication
- **Session Tokens**: Single-use tokens for WebSocket upgrade
- **Time-Limited**: Tokens expire after 5 minutes
- **Flow**:
  1. Controller requests session via REST API
  2. Router generates session ID and token
  3. Controller connects to WebSocket with token
  4. Token is consumed and validated

See `docs/security-architecture.md` for complete security design.

## Architecture

See `docs/examples-architecture.md` for detailed architecture using jsapdu-over-ip library correctly.

**Key principle**: Use `SmartCardPlatformAdapter` and `RemoteSmartCardPlatform` from the library, NOT custom RPC implementation.

### Components

1. **Cardhost** (Node.js + TypeScript)
   - Uses `SmartCardPlatformAdapter` from `@aokiapp/jsapdu-over-ip/server`
   - Wraps real PC/SC platform or mock platform
   - Connects to router via WebSocket (outbound)
   - Registers with UUID

2. **Controller** (React + TypeScript)
   - Uses `RemoteSmartCardPlatform` from `@aokiapp/jsapdu-over-ip/client`
   - Browser-based GUI for sending APDU commands
   - Connects to router via WebSocket
   - Specifies target cardhost UUID

3. **Router** (Java + Quarkus)
   - WebSocket message broker
   - Routes RPC messages between controller and cardhost
   - Does NOT parse APDU or jsapdu methods
   - Provides cardhost discovery REST API

### Message Flow

```
Controller                Router                Cardhost
    |                        |                      |
    | connect (uuid)         |                      |
    |----------------------->|                      |
    |                        |  auth-success (uuid) |
    |                        |<---------------------|
    |                        |                      |
    | rpc-request            |                      |
    |----------------------->|  rpc-request         |
    |                        |--------------------->|
    |                        |                      | [Execute on card]
    |                        |  rpc-response        |
    |  rpc-response          |<---------------------|
    |<-----------------------|                      |
```

## Development

### Prerequisites

- Node.js 20+ (for TypeScript components)
- Java 21+ (for router)
- npm or pnpm
- PostgreSQL 15+ (for router - auto-started in dev mode)

### Quick Start

**1. Start Router (Terminal 1)**:
```bash
cd examples/router
export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64  # or your Java 21 path
./gradlew quarkusDev
```
Router will start at http://localhost:8080

**2. Start Cardhost (Terminal 2)**:
```bash
cd examples/cardhost
npm install  # First time only
npm run dev
```
Cardhost will connect to router at ws://localhost:8080/ws/cardhost

**3. Start Controller (Terminal 3)**:
```bash
cd examples/controller
npm install  # First time only
npm run dev
```
Controller UI will open at http://localhost:5173

### Testing the Setup

1. Check router logs - you should see cardhost connection
2. Open controller UI in browser
3. In controller, enter cardhost UUID (check cardhost logs for UUID)
4. Click "Connect"
5. Select a device from the list
6. Send test APDU command (e.g., `00 A4 04 00`)
7. View response in UI

### Building for Production

```bash
# Router
cd examples/router
./gradlew build

# Cardhost
cd examples/cardhost
npm run build

# Controller
cd examples/controller
npm run build
```

## Configuration

### Cardhost

Configuration via environment variables:

- `ROUTER_URL` - WebSocket URL of router (default: `ws://localhost:8080/ws/cardhost`)
- `CONFIG_FILE` - Path to config file (default: `./cardhost-config.json`)
- `MONITOR_ENABLED` - Enable integrated monitor (default: `true`)
- `MONITOR_PORT` - Monitor HTTP port (default: `3001`)
- `USE_MOCK` - Use mock platform (default: `true`)

Config file (`cardhost-config.json`) is auto-generated and contains:
- UUID (persistent identifier)
- Public/private key pair
- Optional name

### Controller

Configuration via Vite environment variables:

- `VITE_ROUTER_URL` - HTTP URL of router (default: `http://localhost:8080`)

Keys are stored in browser localStorage.

### Router

Configuration via `application.properties` (to be implemented):

- Database connection
- WebSocket settings
- CORS origins
- Health check endpoints

## Monitoring

### Cardhost Monitor

Access integrated monitor at http://localhost:3001 (default)

**Features**:
- Real-time status
- Connection state
- Reader list with card presence
- Request metrics
- Auto-refresh every 2 seconds

### Router Metrics

Prometheus metrics available at `/q/metrics` (when implemented)

## Troubleshooting

### Cannot Install Dependencies

**Issue**: `npm error code E401` or `EUNSUPPORTEDPROTOCOL`

**Solution**: Set GitHub token:
```bash
export NODE_AUTH_TOKEN="ghp_..."
npm install
```

### Cardhost Cannot Connect

**Issue**: `WebSocket connection failed`

**Check**:
1. Router is running
2. `ROUTER_URL` is correct
3. Firewall allows WebSocket connections
4. Check cardhost logs for detailed error

### Controller Cannot See Cardhosts

**Issue**: Cardhost list is empty

**Check**:
1. Cardhost is running and connected
2. Router is running
3. Controller connected to same router
4. Check browser console for errors

### APDU Commands Fail

**Issue**: No response or error response

**Check**:
1. Cardhost is selected in controller UI
2. Card is present in reader
3. APDU format is correct (hex with spaces)
4. Check communication log for details

## Known Issues

### Session 2 Status

**Implemented** ✅:
- Cardhost (complete)
- Controller (complete)
- Shared types (complete)

**Not Implemented** ⏸️:
- Router (deferred to next session)
- Integration tests (blocked by router)
- CI/CD (blocked by router)

**Blockers** 🚧:
- GitHub Packages authentication required
- Cannot build TypeScript until auth resolved

## Next Steps

See `docs/job-notes/20251207-session2-implementation.md` for:
- Detailed session notes
- Router implementation plan
- Integration testing plan
- CI/CD updates

## Contributing

This is an example implementation for demonstration purposes. For production use, consider:

- Adding comprehensive unit tests
- Implementing rate limiting
- Adding TLS/WSS support
- Encrypting private keys at rest
- Adding input validation
- Implementing proper logging framework
- Adding connection pooling
- Implementing message queuing for offline cardhosts

## License

ANAL-Tight

## References

- [jsapdu](https://github.com/AokiApp/jsapdu) - Main jsapdu library
- [jsapdu-interface](https://github.com/AokiApp/jsapdu) - Interface definitions
- [readthecard](https://github.com/yuki-js/readthecard) - Another jsapdu-over-ip example
- [quarkus-crud](https://github.com/yuki-js/quarkus-crud) - Quarkus template

For more information, see:
- `docs/examples-architecture.md` - Architecture overview
- `docs/cardhost.md` - Cardhost documentation
- `docs/controller.md` - Controller documentation
- `docs/router.md` - Router documentation
- `docs/websocket-protocol.md` - Protocol specification

## Next Steps

**For next session implementer:**

1. **Read architecture docs first**: `docs/examples-architecture.md`, `docs/cardhost.md`, `docs/controller.md`
2. **Understand library usage**: Study `/src/client/` and `/src/server/` in main repo
3. **Implement RouterServerTransport**: Custom transport for cardhost→router
4. **Implement RouterClientTransport**: Custom transport for controller→router
5. **Create cardhost index.ts**: Use SmartCardPlatformAdapter from library
6. **Create controller app.ts**: Use RemoteSmartCardPlatform from library
7. **Implement router**: Java/Quarkus message broker
8. **Test integration**: End-to-end with mock or real cards

**Estimated time**: 4-5 hours

## Documentation

- **`docs/examples-architecture.md`** - Complete architecture with library usage
- **`docs/CORRECTED-IMPLEMENTATION-CHECKLIST.md`** - Implementation plan
- **`docs/cardhost.md`** - Cardhost component details
- **`docs/controller.md`** - Controller component details
- **`docs/job-notes/20251207-session2-implementation.md`** - Session history (describes WRONG implementation that was deleted)

## Important Notes

1. **DO NOT reimplement RPC** - use library's SmartCardPlatformAdapter and RemoteSmartCardPlatform
2. **Implement transports only** - ServerTransport and ClientTransport for router communication
3. **Use jsapdu-interface types** - CommandApdu, ResponseApdu, SmartCardPlatform
4. **Router is message broker** - does NOT parse jsapdu methods

## References

- Main library: `@aokiapp/jsapdu-over-ip`
- Interface: `@aokiapp/jsapdu-interface`
- Reference repos in `/tmp` (clone if needed): quarkus-crud, jsapdu, readthecard
