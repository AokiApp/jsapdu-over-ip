# jsapdu-over-ip Examples

This directory contains example implementations demonstrating how to use jsapdu-over-ip for remote smart card access.

## Components

### 1. Cardhost (TypeScript/Node.js)

Service that hosts physical card readers and executes APDU commands on behalf of remote controllers.

**Location**: `cardhost/`

**Features**:
- UUID-based addressing
- Public-key cryptography authentication (ECDSA P-256)
- WebSocket connection to router
- Integrated monitoring web UI
- Mock platform for testing without hardware
- Automatic reconnection

**Quick Start**:
```bash
cd cardhost
npm install
npm run dev

# With custom router URL
ROUTER_URL=ws://router.example.com/ws/cardhost npm run dev

# Disable monitor
MONITOR_ENABLED=false npm run dev
```

**Monitor**: Access at http://localhost:3001 (default)

### 2. Controller (TypeScript/Browser)

Browser-based frontend for sending APDU commands to remote card readers.

**Location**: `controller/`

**Features**:
- Interactive APDU command builder
- Cardhost discovery and selection
- Public-key cryptography (Web Crypto API)
- Real-time communication log
- Quick command buttons
- Dark theme UI

**Quick Start**:
```bash
cd controller
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

### 3. Router (Java/Quarkus)

Server that connects controllers with cardhosts over the internet.

**Location**: `router/`

**Status**: 🚧 To be implemented in next session

**Features** (planned):
- REST API for cardhost discovery
- WebSocket endpoints for real-time communication
- Public-key authentication
- PostgreSQL for state management
- Health checks and metrics

### 4. Shared (TypeScript)

Common types and utilities used by TypeScript components.

**Location**: `shared/`

**Contents**:
- WebSocket protocol message types
- Shared interfaces (CardhostInfo, etc.)
- Type guards and helpers

## Architecture

```
┌─────────────┐                    ┌────────────┐                    ┌──────────────┐
│ Controller  │◄──────────────────►│   Router   │◄──────────────────►│   Cardhost   │
│  (Browser)  │    WebSocket       │  (Server)  │    WebSocket       │   (Node.js)  │
└─────────────┘                    └────────────┘                    └──────────────┘
                                           │                                  │
                                           │                                  │
                                   ┌───────▼────────┐                ┌────────▼─────┐
                                   │   PostgreSQL   │                │  Card Reader │
                                   │   (Registry)   │                │  (PC/SC)     │
                                   └────────────────┘                └──────────────┘
```

**Communication Flow**:
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
