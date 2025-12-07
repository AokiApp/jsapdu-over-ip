# jsapdu-over-ip Router

Java-based Quarkus server that routes RPC messages between controllers and cardhosts over WebSocket connections.

## Overview

The router is an internet-facing server that acts as a relay between:
- **Controllers** (browser frontends) - send APDU commands to remote cards
- **Cardhosts** (services with card readers) - execute APDU commands on physical cards

## Technology Stack

- **Quarkus 3.x** - Modern Java framework
- **WebSocket** - Bidirectional real-time communication
- **PostgreSQL** - Cardhost registry and session management
- **Flyway** - Database migrations
- **MyBatis** - SQL mapper
- **SmallRye Health** - Health checks
- **Micrometer Prometheus** - Metrics export

## Project Structure

```
router/
├── build.gradle                  # Gradle build configuration
├── settings.gradle               # Project settings
├── gradlew, gradlew.bat         # Gradle wrapper scripts
├── src/main/
│   ├── java/app/aoki/jsapdurouter/
│   │   ├── websocket/           # WebSocket endpoints
│   │   │   ├── CardhostWebSocket.java
│   │   │   ├── ControllerWebSocket.java
│   │   │   ├── MessageRouter.java
│   │   │   └── RouterMessage.java
│   │   ├── resource/            # REST API resources (from template)
│   │   ├── service/             # Business logic services
│   │   ├── entity/              # Database entities
│   │   ├── mapper/              # MyBatis SQL mappers
│   │   └── support/             # Support utilities
│   └── resources/
│       ├── application.properties
│       └── db/migration/
│           └── V1__Router_initial_schema.sql
└── src/test/                    # Tests
```

## WebSocket Endpoints

### Cardhost Endpoint
- **URL**: `ws://host:port/ws/cardhost`
- **Purpose**: Cardhost connections
- **Auth**: Challenge-response with public key signature

**Message Flow**:
1. Router → Cardhost: `auth-challenge`
2. Cardhost → Router: `auth-success` (with UUID, public key, signature)
3. Router → Cardhost: `auth-success` (confirmation)
4. Bidirectional: `rpc-request`, `rpc-response`, `rpc-event`, `heartbeat`

### Controller Endpoint
- **URL**: `ws://host:port/ws/controller`
- **Purpose**: Controller connections
- **Auth**: Simpler auth with target cardhost UUID

**Message Flow**:
1. Router → Controller: `auth-challenge`
2. Controller → Router: `auth-success` (with target cardhost UUID)
3. Router → Controller: `auth-success` or `error`
4. Bidirectional: `rpc-request`, `rpc-response`, `rpc-event`, `heartbeat`

## Message Format

All WebSocket messages use JSON:

```json
{
  "type": "message-type",
  "data": { /* message-specific data */ }
}
```

### Message Types

- `auth-challenge` - Authentication challenge from router
- `auth-success` - Successful authentication
- `auth-failure` - Failed authentication
- `rpc-request` - RPC method call
- `rpc-response` - RPC method response
- `rpc-event` - Event notification
- `heartbeat` - Connection keepalive
- `error` - Error message

## Database Schema

### cardhosts
Stores registered cardhosts with their connection status.

### controller_sessions
Tracks active controller sessions and their target cardhosts.

### audit_log
Audit trail for security and debugging.

## Configuration

Key configuration properties in `application.properties`:

- `quarkus.http.port` - HTTP server port (default: 8080)
- `quarkus.datasource.*` - Database connection
- `quarkus.flyway.*` - Database migration settings
- `quarkus.websocket.*` - WebSocket configuration

## Running

### Development Mode

```bash
./gradlew quarkusDev
```

This starts Quarkus in dev mode with:
- Hot reload on code changes
- Dev UI at http://localhost:8080/q/dev
- Automatic PostgreSQL container (Dev Services)

### Production Build

```bash
./gradlew build
java -jar build/quarkus-app/quarkus-run.jar
```

### Docker

```bash
./gradlew build
docker build -f src/main/docker/Dockerfile.jvm -t jsapdu-router .
docker run -p 8080:8080 jsapdu-router
```

## Endpoints

- `ws://localhost:8080/ws/cardhost` - Cardhost WebSocket
- `ws://localhost:8080/ws/controller` - Controller WebSocket
- `GET /q/health` - Health check
- `GET /q/metrics` - Prometheus metrics
- `GET /q/swagger-ui` - API documentation
- `GET /q/dev` - Dev UI (dev mode only)

## Current Implementation Status

### ✅ Completed
- [x] Quarkus template deployment
- [x] Project renamed to jsapdu-router
- [x] WebSocket dependencies added
- [x] Database schema (migration V1)
- [x] Core WebSocket classes created:
  - CardhostWebSocket - handles cardhost connections
  - ControllerWebSocket - handles controller connections
  - MessageRouter - routes messages between endpoints
  - RouterMessage - message type definitions

### 🚧 In Progress
- [ ] Complete authentication implementation
  - [ ] Public key signature verification (cardhost)
  - [ ] Session token management (controller)
- [ ] Request/response tracking
  - [ ] Map request IDs to controller sessions
  - [ ] Route responses to correct controller
- [ ] Event broadcasting
  - [ ] Forward cardhost events to relevant controllers
- [ ] Database integration
  - [ ] Persist cardhost registrations
  - [ ] Track active sessions
  - [ ] Audit logging

### 📋 TODO (Next Session)
- [ ] REST API for cardhost discovery
- [ ] Heartbeat and connection monitoring
- [ ] Error handling and recovery
- [ ] Integration tests
- [ ] Performance optimization
- [ ] Documentation completion

## Development Notes

This router is based on the `quarkus-crud` template. Many template features are preserved for:
- Observability (health checks, metrics, logging)
- Security (JWT infrastructure)
- Code quality (Spotless, Checkstyle)
- Testing (JUnit 5, REST Assured)
- Container builds (Jib)

Template files should not be removed unless clearly not applicable, as they provide valuable patterns and infrastructure.

## See Also

- [Router Design Documentation](../../docs/router.md)
- [WebSocket Protocol Specification](../../docs/websocket-protocol.md)
- [Architecture Overview](../../docs/examples-architecture.md)
