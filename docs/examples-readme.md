# Examples Directory

## Overview

The `examples/` directory contains a complete demonstration of jsapdu-over-ip usage through four interconnected components that enable remote smart card access over the internet.

## Components

### 1. [Controller](controller.md)
Browser-based frontend for remotely sending APDU commands to smart cards.

**Technology**: TypeScript, Browser WebSocket  
**Role**: Initiates APDU commands  
**Connection**: Outbound to router (NAT-friendly)

### 2. [Cardhost](cardhost.md)
Node.js service that hosts physical card readers and executes remote APDU commands.

**Technology**: TypeScript, Node.js, jsapdu-pcsc  
**Role**: Executes APDU commands on physical cards  
**Connection**: Outbound to router (NAT-friendly)

### 3. [Router](router.md)
Java/Quarkus server that connects controllers with cardhosts over the internet.

**Technology**: Java, Quarkus, PostgreSQL, WebSocket  
**Role**: Routes APDU commands between controller and cardhost  
**Connection**: Accepts inbound connections

### 4. [Cardhost Monitor](cardhost-monitor.md)
Web UI for monitoring cardhost operational status.

**Technology**: TypeScript, Web UI  
**Role**: Displays metrics, logs, and telemetry  
**Connection**: HTTP/WebSocket to cardhost

### 5. Shared
Common TypeScript types and utilities used across components.

**Technology**: TypeScript  
**Role**: Protocol definitions, type safety, utilities

## Architecture

```
┌──────────────┐                     ┌──────────────┐
│  Controller  │                     │  Cardhost    │
│  (Browser)   │                     │  (Node.js)   │
│              │                     │              │
│  [Behind     │◄───────────────────►│  [Behind     │
│   NAT]       │      Outbound       │   NAT]       │
└──────┬───────┘      Connections    └──────┬───────┘
       │                                     │
       │ WebSocket                           │ WebSocket
       │                                     │
       └─────────┐       ┌─────────────────┘
                 │       │
                 ▼       ▼
          ┌─────────────────────┐
          │      Router         │
          │    (Quarkus)        │
          │  [Public Server]    │
          │                     │
          │  ┌───────────────┐  │
          │  │  PostgreSQL   │  │
          │  └───────────────┘  │
          └─────────────────────┘
                    ▲
                    │ HTTP/WS
                    │
          ┌─────────┴─────────┐
          │  Cardhost Monitor │
          │     (Web UI)      │
          └───────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+ for TypeScript components
- Java 21+ for router
- PostgreSQL 15+ for router database
- Smart card reader (optional, mock mode available)

### Setup All Components

```bash
# From repository root
cd examples

# Install all dependencies
npm install

# Build all TypeScript components
npm run build
```

### Start Individual Components

**Terminal 1 - Router**:
```bash
cd examples/router
./gradlew quarkusDev
# Available at http://localhost:8080
```

**Terminal 2 - Cardhost**:
```bash
cd examples/cardhost
npm run build
npm start
# Or with mock: USE_MOCK_PLATFORM=true npm start
```

**Terminal 3 - Controller**:
```bash
cd examples/controller
npm run dev
# Open browser to http://localhost:3000
```

**Terminal 4 - Monitor** (Optional):
```bash
cd examples/cardhost-monitor
npm run dev
# Open browser to http://localhost:3002
```

## Development Workflow

### Monorepo Structure

The examples directory is a monorepo using:
- **npm workspaces** for dependency management
- **Turborepo** for build orchestration
- **TypeScript** for type safety
- **Gradle** for router build

### Common Commands

```bash
# Build all components
npm run build

# Type check all TypeScript
npm run typecheck

# Run linter
npm run lint

# Format code
npm run format

# Clean build artifacts
npm run clean

# Development mode (hot reload)
npm run dev
```

### Working on Individual Components

Each component can be developed independently:

```bash
cd examples/controller  # or cardhost, cardhost-monitor, shared
npm run dev
```

For the router:
```bash
cd examples/router
./gradlew quarkusDev
```

## Testing

### Unit Tests

```bash
# TypeScript components
npm run test

# Router
cd examples/router
./gradlew test
```

### Integration Tests

```bash
# TODO: E2E tests to be implemented
npm run test:e2e
```

## Documentation

Detailed documentation for each component:

- [Architecture Overview](examples-architecture.md)
- [WebSocket Protocol](websocket-protocol.md)
- [Controller Documentation](controller.md)
- [Cardhost Documentation](cardhost.md)
- [Router Documentation](router.md)
- [Monitor Documentation](cardhost-monitor.md)

## API Specifications

- [Router OpenAPI Spec](../examples/router/openapi/router-api.yaml)

## Security

### Development

In development mode, security is relaxed for ease of testing:
- No authentication required
- HTTP instead of HTTPS
- CORS enabled for all origins

### Production

For production deployment:
- Enable JWT authentication
- Use TLS/WSS for all connections
- Restrict CORS origins
- Implement rate limiting
- Enable audit logging
- Use secrets management for credentials

See individual component docs for security recommendations.

## Deployment

### Docker

Each component can be containerized:

```bash
# Router (via Jib)
cd examples/router
./gradlew jib

# TypeScript components
cd examples/controller  # or cardhost, cardhost-monitor
docker build -t controller .
```

### Kubernetes

See `manifests/` directory for Kubernetes deployment examples (TODO).

## Troubleshooting

### Common Issues

**"PC/SC not available"**
- Install PC/SC libraries or use `USE_MOCK_PLATFORM=true`

**"Cannot connect to router"**
- Verify router is running
- Check firewall settings
- Confirm WebSocket URL is correct

**"Cardhost not found"**
- Ensure cardhost is connected to router
- Check cardhost UUID matches

**"Database connection failed"**
- Verify PostgreSQL is running
- Check connection string in router config

### Logs

Each component logs to console. Set log level via environment:

```bash
LOG_LEVEL=debug npm start
```

## Contributing

See main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.

## Related Projects

- [jsapdu](https://github.com/AokiApp/jsapdu) - Parent project
- [jsapdu-interface](https://github.com/AokiApp/jsapdu) - Interface definitions
- [readthecard](https://github.com/yuki-js/readthecard) - Real-world usage example
