# Examples Architecture

## Overview

The examples directory demonstrates jsapdu-over-ip usage through a complete remote card access system with three main components that can be owned and operated by different parties.

## System Components

### 1. Controller (TypeScript - Browser Frontend)

**Purpose**: Frontend application for remotely sending APDUs to smart cards

**Key Features**:
- Browser-based GUI for low-level APDU operations
- Uses jsapdu-over-ip client interfaces
- Connects to router via outbound connection (NAT-friendly)
- Specifies target cardhost by UUID (UUID is for peer addressing, not security)
- Interactive APDU command builder and response viewer
- Public-key cryptography based authentication (Web Crypto API compliant)

**Technology Stack** (suggested, not prescriptive):
- TypeScript
- Web technologies
- jsapdu-over-ip client libraries
- WebSocket client for real-time communication

**Deployment**: Static site hosting or local file serving

---

### 2. Cardhost with Integrated Monitor (TypeScript - Node.js Service)

**Purpose**: Monolithic service that hosts physical card readers, executes remote APDU commands, and provides monitoring UI

**Key Features**:
- Manages physical card readers via jsapdu (PC/SC)
- UUID for peer addressing (persistent across restarts)
- Public-key cryptography for mutual authentication and peer identity
- Connects to router via outbound connection (NAT-friendly)
- Executes APDU commands on behalf of remote controllers
- Reports card insertion/removal events
- Integrated monitoring web UI (same process, optional at compile time)
- Public-key based peer discovery and management

**Technology Stack** (suggested, not prescriptive):
- Node.js + TypeScript
- jsapdu-pcsc for card reader access
- jsapdu-over-ip server adapter
- WebSocket client for router connection
- Web Crypto API for cryptographic operations

**Security Model**:
- UUID used only for peer addressing/routing, not authentication
- Public-key cryptography for all authentication (Web Crypto API compliant)
- Peer identity based on public keys, not UUIDs
- Public-key based discovery and management for distributed system architecture

**Monitor Integration**:
- Runs in same process as cardhost (not standalone)
- No formal API between cardhost and monitor modules
- Efficient monolithic code with optional compile-time exclusion
- Direct access to cardhost state and metrics

---

### 3. Router (Java - Quarkus Server)

**Purpose**: Internet-facing server that connects controllers with cardhosts

**Key Features**:
- Accepts inbound connections from controllers and cardhosts
- Routes APDU requests/responses between parties
- Maintains WebSocket connections for bidirectional communication
- Public-key cryptography based peer authentication
- Cardhost registration and discovery
- Robust authentication and authorization
- Metrics and health monitoring

**Technology Stack** (suggested, not prescriptive):
- Quarkus 3.x (based on quarkus-crud template)
- PostgreSQL for cardhost registry and state
- Flyway for database migrations
- MyBatis for SQL queries
- SmallRye OpenAPI (OpenAPI-first design)
- Public-key cryptography for authentication (not limited to JWT)
- SmallRye Health and Micrometer Prometheus
- WebSocket support (quarkus-websockets)

**API Design**:
- RESTful HTTP for cardhost registration
- WebSocket for real-time APDU routing
- OpenAPI 3.0 specification-first approach

---

---

## Communication Architecture

Controllers and cardhosts connect to the router using outbound WebSocket connections (NAT-friendly). The router acts as a relay, routing APDU commands based on cardhost UUIDs. Public-key cryptography is used for mutual authentication.

### Connection Flow

1. **Cardhost Registration**:
   - Cardhost connects to router via WebSocket (outbound)
   - Authenticates using public-key cryptography
   - Sends registration with UUID (for addressing) and public key (for identity)
   - Router stores cardhost information
   - Connection maintained with heartbeat

2. **Controller Connection**:
   - Controller connects to router via WebSocket (outbound)
   - Authenticates using public-key cryptography (Web Crypto API)
   - Requests available cardhosts
   - Can discover peers based on public keys

3. **APDU Routing**:
   - Controller sends APDU command with target cardhost UUID (addressing)
   - Router verifies authorization based on public keys
   - Routes to cardhost, which executes on physical card
   - Response routed back to controller

### Message Format

The message format is flexible and can evolve. Below is one possible approach:

```typescript
// Example RPC Request
{
  id: string,          // Request ID for matching responses
  method: string,      // Method name (e.g., "platform.getDeviceInfo")
  params: any[],       // Method parameters
  target?: string      // Target cardhost UUID (for addressing only)
}

// Example RPC Response
{
  id: string,          // Matching request ID
  result?: any,        // Success result
  error?: {            // Error details
    code: number,
    message: string
  }
}

// Example Event Notification
{
  event: string,       // Event type (e.g., "cardInserted")
  data: any            // Event data
}
```

**Note**: This is an example format only. The actual protocol should remain fluid during development to accommodate requirements.

---

## Security Considerations

### Robustness and security of Authn and Authz

- **Public-key cryptography**: All authentication based on public-key cryptography (Web Crypto API compliant)
- **Peer identity**: Based on public keys, not UUIDs
- **Mutual authentication**: Both cardhosts and controllers authenticate to router
- **UUID role**: Used only for peer addressing/routing, not for security or authentication
- **Public-key discovery**: Peer discovery and management based on public keys for distributed system architecture
- **No UUID-based security**: Changing a UUID file does not provide authentication or impersonation protection

### Communication Security
- TLS/WSS for all connections in production
- APDU command validation and filtering
- Rate limiting

---

## Monorepo Structure

**Note**: This structure is an example and not prescriptive. Adapt as needed during implementation.

```
examples/
├── controller/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
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
├── cardhost/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts (main cardhost service)
│       ├── cardhost-service.ts
│       ├── monitor/ (integrated monitoring UI, optional at compile time)
│       │   ├── index.ts
│       │   └── ui/
│       └── crypto.ts (Web Crypto API wrappers)
│
├── router/
│   ├── build.gradle
│   ├── openapi/
│   │   └── router-api.yaml
│   └── src/main/
│       ├── java/app/aoki/jsapdu/router/
│       └── resources/
│
├── shared/
│   ├── package.json
│   └── src/
│       ├── types.ts
│       └── protocol.ts
│
├── package.json (workspace root)
└── turbo.json
```

**Note**: Cardhost-monitor is integrated into cardhost as a module, not a separate component. The directory structure should reflect this integration.

---

## Development Workflow

### Prerequisites
- Node.js 23+ for TypeScript components (current stable)
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

---

## CI/CD

CI builds and tests all components. See `.github/workflows/examples-ci.yml` for details.

---

## Future Enhancements

- Robustness and security of Authn and Authz
- Advanced public-key based peer discovery
- Multi-router clustering
- Enhanced monitoring capabilities
