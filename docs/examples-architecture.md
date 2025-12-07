# Examples Architecture

## Overview

The examples directory demonstrates jsapdu-over-ip usage through a complete remote card access system with four main components that can be owned and operated by different parties.

## System Components

### 1. Controller (TypeScript - Browser Frontend)

**Purpose**: Frontend application for remotely sending APDUs to smart cards

**Key Features**:
- Browser-based GUI for low-level APDU operations
- Uses jsapdu-over-ip client interfaces
- Connects to router via outbound connection (NAT-friendly)
- Specifies target cardhost by UUID
- Interactive APDU command builder and response viewer

**Technology Stack**:
- TypeScript
- React or vanilla web technologies
- jsapdu-over-ip client libraries
- WebSocket client for real-time communication

**Deployment**: Static site hosting or local file serving

---

### 2. Cardhost (TypeScript - Node.js Service)

**Purpose**: Service that hosts physical card readers and executes remote APDU commands

**Key Features**:
- Manages physical card readers via jsapdu (PC/SC)
- Persistent UUID for identification
- Connects to router via outbound connection (NAT-friendly)
- Executes APDU commands on behalf of remote controllers
- Reports card insertion/removal events

**Technology Stack**:
- Node.js + TypeScript
- jsapdu-pcsc for card reader access
- jsapdu-over-ip server adapter
- WebSocket client for router connection

**UUID Persistence**:
- Generated on first run and stored locally
- Survives service restarts
- 128-bit UUID (note: consider additional auth for production)

---

### 3. Router (Java - Quarkus Server)

**Purpose**: Internet-facing server that connects controllers with cardhosts

**Key Features**:
- Accepts inbound connections from controllers and cardhosts
- Routes APDU requests/responses between parties
- Maintains WebSocket connections for bidirectional communication
- Cardhost registration and discovery
- Authentication and authorization (JWT)
- Metrics and health monitoring

**Technology Stack**:
- Quarkus 3.x (based on quarkus-crud template)
- PostgreSQL for cardhost registry and state
- Flyway for database migrations
- MyBatis for SQL queries
- SmallRye OpenAPI (OpenAPI-first design)
- SmallRye JWT for authentication
- SmallRye Health and Micrometer Prometheus
- WebSocket support (quarkus-websockets)

**API Design**:
- RESTful HTTP for cardhost registration
- WebSocket for real-time APDU routing
- OpenAPI 3.0 specification-first approach

---

### 4. Cardhost Monitor (TypeScript - Web UI)

**Purpose**: Monitoring dashboard for cardhost owners

**Key Features**:
- Displays cardhost operational status
- Shows connection state to router
- Lists connected card readers
- Presents metrics (uptime, APDU count, latency)
- View logs and events
- Can run in same process as cardhost or standalone

**Technology Stack**:
- TypeScript
- Web framework (React/Vue/Svelte or vanilla)
- Chart library for metrics visualization
- WebSocket or polling for real-time updates

---

## Communication Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ Controller  │         │   Router    │         │  Cardhost   │
│  (Browser)  │         │  (Quarkus)  │         │  (Node.js)  │
│             │         │             │         │             │
│  (behind    │◄───────►│   Public    │◄───────►│  (behind    │
│   NAT)      │         │   Server    │         │   NAT)      │
└─────────────┘         └─────────────┘         └─────────────┘
     │                        │                        │
     │ Outbound WS            │                        │ Outbound WS
     │ Connect                │ Inbound Listener       │ Connect
     │                        │                        │
     └────────────────────────┴────────────────────────┘
              jsapdu-over-ip protocol
```

### Connection Flow

1. **Cardhost Registration**:
   - Cardhost starts and connects to router (WebSocket)
   - Sends registration message with UUID and capabilities
   - Router stores cardhost in database
   - Connection maintained with heartbeat

2. **Controller Connection**:
   - Controller opens browser application
   - Connects to router (WebSocket)
   - Authenticates (optional, depends on security model)
   - Requests list of available cardhosts

3. **APDU Routing**:
   - Controller sends APDU command with target cardhost UUID
   - Router forwards to appropriate cardhost connection
   - Cardhost executes APDU on physical card
   - Response routed back through router to controller

### Message Format

Based on jsapdu-over-ip RPC protocol:

```typescript
// RPC Request
{
  id: string,          // Request ID for matching responses
  method: string,      // Method name (e.g., "platform.getDeviceInfo")
  params: any[],       // Method parameters
  target?: string      // Target cardhost UUID (controller → router)
}

// RPC Response
{
  id: string,          // Matching request ID
  result?: any,        // Success result
  error?: {            // Error details
    code: number,
    message: string
  }
}

// Event Notification
{
  event: string,       // Event type (e.g., "cardInserted")
  data: any            // Event data
}
```

---

## Security Considerations

### Authentication
- JWT tokens for controller authentication (optional in demo)
- Cardhost authentication via UUID + secret key
- TLS/WSS for all connections in production

### Authorization
- Controllers can only access cardhosts they have permission for
- Rate limiting on APDU commands
- APDU command validation and filtering

### UUID Security
- 128-bit UUID is relatively small for permanent tracking
- Production systems should add:
  - Additional authentication factors
  - UUID rotation policies
  - Access control lists

---

## Monorepo Structure

```
examples/
├── controller/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── App.tsx (or vanilla)
│   │   └── websocket-client.ts
│   └── public/
│       └── index.html
│
├── cardhost/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── cardhost-service.ts
│   │   ├── uuid-storage.ts
│   │   └── router-client.ts
│   └── config.json (UUID storage)
│
├── router/
│   ├── build.gradle
│   ├── settings.gradle
│   ├── openapi/
│   │   └── router-api.yaml
│   ├── src/main/
│   │   ├── java/
│   │   │   └── app/aoki/jsapdu/router/
│   │   │       ├── websocket/
│   │   │       ├── resource/
│   │   │       ├── service/
│   │   │       └── entity/
│   │   └── resources/
│   │       ├── application.properties
│   │       └── db/migration/
│   └── src/test/
│
├── cardhost-monitor/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── Monitor.tsx
│   │   └── api-client.ts
│   └── public/
│
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts (shared interfaces)
│       └── protocol.ts (message definitions)
│
├── package.json (workspace root)
└── turbo.json
```

---

## Development Workflow

### Prerequisites
- Node.js 20+ for TypeScript components
- Java 21+ for router
- PostgreSQL 15+ for router database
- Card reader hardware for cardhost (or mock mode)

### Setup
```bash
# Install all dependencies
npm install

# Build all components
npm run build

# Run in development mode
npm run dev
```

### Individual Component Development

```bash
# Controller
cd examples/controller
npm run dev

# Cardhost
cd examples/cardhost
npm run dev

# Router
cd examples/router
./gradlew quarkusDev

# Monitor
cd examples/cardhost-monitor
npm run dev
```

---

## CI/CD

### Build Pipeline
- Lint all TypeScript code
- Build all TypeScript packages
- Build router (Quarkus)
- Run unit tests
- Run integration tests

### Deployment
- Controller: Static site to CDN
- Cardhost: Packaged executable or Docker
- Router: Container image via Jib
- Monitor: Embedded in cardhost or separate deployment

---

## Testing Strategy

### Unit Tests
- Individual component logic
- Protocol message handling
- UUID generation and persistence

### Integration Tests
- Controller ↔ Router communication
- Cardhost ↔ Router communication
- APDU routing end-to-end

### E2E Tests
- Full system with mock cards
- Connection recovery
- Multiple concurrent controllers

---

## Future Enhancements

- Web-based cardhost-monitor with real-time updates
- Multiple router clustering for high availability
- Advanced security (OAuth, mTLS)
- APDU command history and replay
- Card session recording
- Performance monitoring and tracing
