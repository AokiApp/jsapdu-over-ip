# jsapdu-over-ip Examples

This directory contains example implementations demonstrating how to use jsapdu-over-ip for remote smart card access.

## ⚠️ Current Status

**This examples directory is in FOUNDATION STATE ONLY.**

- ✅ Architecture documentation complete
- ✅ Package structure created
- ✅ Utility files preserved (config, crypto, UI)
- ❌ **NO WORKING IMPLEMENTATION YET**
- ❌ Incorrect RPC reimplementation was deleted
- ⏳ Next session will implement using library correctly

## What Exists Now

### Cardhost (`cardhost/`)
**Files present:**
- `src/config.ts` - Configuration utilities
- `src/crypto.ts` - Authentication helpers
- `src/monitor/index.ts` - Monitoring UI (standalone)
- `package.json`, `tsconfig.json` - Build config

**Missing (to be implemented):**
- `src/index.ts` - Main entry point using SmartCardPlatformAdapter
- `src/router-transport.ts` - ServerTransport implementation
- Mock or real SmartCardPlatform implementation

### Controller (`controller/`)
**Files present:**
- `src/crypto.ts` - Authentication helpers
- `src/api-client.ts` - REST API client
- `public/index.html` - UI template
- `public/styles.css` - Styles
- `vite.config.ts` - Build config
- `package.json`, `tsconfig.json` - Build config

**Missing (to be implemented):**
- `src/index.ts` - Main entry point
- `src/app.ts` - Application logic using RemoteSmartCardPlatform
- `src/router-transport.ts` - ClientTransport implementation

### Router (`router/`)
**Not started** - Java/Quarkus message broker

### Shared (`shared/`)
**Minimal package** - Will use RPC types from jsapdu-over-ip library

## Architecture (Planned)

See `docs/examples-architecture.md` for detailed architecture using jsapdu-over-ip library correctly.

**Key principle**: Use `SmartCardPlatformAdapter` and `RemoteSmartCardPlatform` from the library, NOT custom RPC implementation.
1. Cardhost connects to router (outbound), registers with UUID + public key
2. Controller connects to router (outbound), authenticates with public key
3. Controller discovers available cardhosts via REST API
4. Controller sends APDU commands via WebSocket, specifying target cardhost UUID
5. Router routes commands to cardhost based on UUID
6. Cardhost executes on physical card, returns response
7. Router routes response back to controller

**Security**:
- Public-key cryptography for all authentication (ECDSA P-256)
- UUIDs used only for addressing, not authentication
- TLS/WSS recommended for production

## Development

### Prerequisites

- Node.js 20+ (for TypeScript components)
- Java 21+ (for router)
- PostgreSQL 15+ (for router)
- npm or pnpm

### Install Dependencies

From repository root:
```bash
# Main package
npm install

# Examples workspace
cd examples
npm install
```

**Note**: Requires GitHub token for `@aokiapp/jsapdu-interface`:
```bash
export NODE_AUTH_TOKEN="ghp_your_token_here"
npm install
```

### Build All Components

```bash
cd examples
npm run build
```

### Development Mode

Run each component in separate terminals:

**Terminal 1 - Router** (once implemented):
```bash
cd examples/router
./gradlew quarkusDev
```

**Terminal 2 - Cardhost**:
```bash
cd examples/cardhost
npm run dev
```

**Terminal 3 - Controller**:
```bash
cd examples/controller
npm run dev
```

### Testing

#### Without Hardware

The cardhost includes a mock platform that simulates card readers:

```bash
cd examples/cardhost
USE_MOCK=true npm run dev
```

#### With Real Hardware

Replace mock platform with jsapdu-pcsc (when available):

```bash
cd examples/cardhost
USE_MOCK=false npm run dev
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
