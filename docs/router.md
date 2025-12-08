# Router

Java-based Quarkus server that connects remote controllers with cardhosts over the internet.

## Overview

The router is an internet-facing server that acts as a relay between controllers (in browsers) and cardhosts (hosting physical card readers). It maintains WebSocket connections with both parties and routes APDU commands and responses between them using public-key cryptography for authentication.

## Features

- **Bidirectional Routing**: Routes APDU commands and responses
- **WebSocket Support**: Real-time bidirectional communication
- **RESTful API**: HTTP endpoints for registration and discovery
- **PostgreSQL Storage**: Persistent cardhost registry
- **Public-key Authentication**: Robust authentication not limited to JWT
- **Public-key Discovery**: Peer discovery and management based on public keys
- **Health Monitoring**: SmallRye Health checks
- **Metrics**: Prometheus-compatible metrics
- **OpenAPI Documentation**: Auto-generated API docs
- **Containerized**: Docker/Kubernetes ready via Jib

## Technology Stack (Suggested)

- **Quarkus 3.x**: Modern Java framework (based on quarkus-crud template)
- **RESTEasy Reactive**: Reactive REST endpoints
- **WebSockets**: Quarkus WebSocket support
- **PostgreSQL 15**: Relational database
- **Flyway**: Database migrations
- **MyBatis**: SQL mapper
- **SmallRye OpenAPI**: API documentation
- **Public-key cryptography**: For authentication (not limited to JWT)
- **SmallRye Health**: Health checks
- **Micrometer Prometheus**: Metrics
- **Jib**: Container image builder

## Project Structure

Based on quarkus-crud template. The exact structure may evolve during implementation:

```
router/
├── build.gradle
├── settings.gradle
├── openapi/
│   └── router-api.yaml
├── src/main/
│   ├── java/app/aoki/jsapdu/router/
│   │   ├── websocket/
│   │   │   ├── ControllerWebSocket.java
│   │   │   ├── CardhostWebSocket.java
│   │   │   └── MessageRouter.java
│   │   ├── resource/
│   │   │   ├── CardhostResource.java
│   │   │   └── ControllerResource.java
│   │   ├── service/
│   │   │   ├── CardhostService.java
│   │   │   ├── SessionService.java
│   │   │   └── RoutingService.java
│   │   ├── entity/
│   │   │   ├── Cardhost.java
│   │   │   └── ControllerSession.java
│   │   └── mapper/
│   │       ├── CardhostMapper.java
│   │       └── SessionMapper.java
│   └── resources/
│       ├── application.properties
│       └── db/migration/
│           ├── V1__init_schema.sql
│           └── V2__add_sessions.sql
└── src/test/
```

**Note**: The detailed structure should remain flexible during development.

## Configuration

Example `application.properties` (adapt as needed):

```properties
# Server
quarkus.http.port=8080
quarkus.http.cors=true

# Database
quarkus.datasource.db-kind=postgresql
quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/jsapdu_router

# Flyway migrations
quarkus.flyway.migrate-at-start=true

# WebSocket
quarkus.websocket.max-frame-size=1048576

# Public-key authentication configuration
# (specific properties depend on implementation)

# Health checks
quarkus.smallrye-health.root-path=/healthz

# Metrics
quarkus.micrometer.enabled=true
quarkus.micrometer.export.prometheus.enabled=true
```

## API Endpoints

The API design may evolve during implementation. Below are suggested endpoints:

### REST API

- `GET /api/cardhosts` - List connected cardhosts
- `GET /api/cardhosts/{uuid}` - Get cardhost details
- `POST /api/controller/sessions` - Create controller session
- `GET /healthz` - Health check
- `GET /q/metrics` - Prometheus metrics
- `GET /q/swagger-ui` - Swagger UI

### WebSocket Endpoints

- `ws://host:port/ws/controller/{sessionId}` - Controller connection
- `ws://host:port/ws/cardhost` - Cardhost connection

## Database Schema

Example schema (may evolve during implementation):

### cardhosts table

```sql
CREATE TABLE cardhosts (
  uuid UUID PRIMARY KEY,
  public_key TEXT NOT NULL,
  name VARCHAR(255),
  status VARCHAR(20) NOT NULL,
  capabilities JSONB,
  connected_at TIMESTAMP,
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### controller_sessions table

```sql
CREATE TABLE controller_sessions (
  session_id UUID PRIMARY KEY,
  public_key TEXT NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

## Development

### Prerequisites

- Java 21+
- Docker (for PostgreSQL via Dev Services)
- Gradle 9.x (wrapper included)

### OpenAPI-First Development

The router follows an OpenAPI-first approach where REST APIs are generated from the OpenAPI specification:

1. **Define API in OpenAPI**: Edit files in `openapi/` directory
   - `openapi/openapi.yaml` - Main spec (references other files)
   - `openapi/paths/*.yaml` - Path definitions
   - `openapi/components/schemas/*.yaml` - Schema definitions

2. **Generate Code**: Run Gradle tasks to compile spec and generate interfaces
   ```bash
   ./gradlew compileOpenApi        # Bundles modular spec
   ./gradlew generateOpenApiModels # Generates Java interfaces and models
   ```
   Generated code is in `build/generated-src/openapi/src/gen/java/`

3. **Implement Interfaces**: Resource classes implement generated interfaces
   - Example: `CardhostApiImpl implements CardhostApi`
   - Type-safe contracts enforced by compiler
   - Generated models used for request/response

4. **Build**: Gradle automatically runs generation before compilation
   ```bash
   ./gradlew compileJava  # Auto-generates OpenAPI code first
   ```

### Running in Dev Mode

```bash
cd examples/router
./gradlew quarkusDev
```

This starts:
- PostgreSQL via Quarkus Dev Services
- Flyway migrations
- Hot reload
- Dev UI at http://localhost:8080/q/dev-ui
- Swagger UI at http://localhost:8080/q/swagger-ui

### Building

```bash
./gradlew clean build
```

### Building Container Image

```bash
./gradlew jib
```

## Deployment

### Docker

```bash
docker run -p 8080:8080 \
  -e QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://db:5432/jsapdu_router \
  -e QUARKUS_DATASOURCE_USERNAME=jsapdu \
  -e QUARKUS_DATASOURCE_PASSWORD=changeme \
  ghcr.io/aokiapp/jsapdu-router:latest
```

### Kubernetes

See `manifests/` directory for Kubernetes deployment files.

## Message Routing

### Controller → Cardhost

1. Controller sends request with `targetCardhost` UUID
2. Router validates UUID and checks if cardhost is connected
3. Router forwards request to cardhost WebSocket
4. Cardhost executes and returns response
5. Router forwards response back to controller

### Cardhost → Controllers (Events)

1. Cardhost sends event (e.g., card inserted)
2. Router receives event
3. Router broadcasts to all connected controllers (or subscribed controllers)

## Security

### Authentication

- Controllers: JWT tokens (optional for demo)
- Cardhosts: UUID + secret key
- All production traffic over TLS

### Authorization

- Access control list (ACL) for controller-cardhost pairs
- Rate limiting per connection
- APDU command filtering

### Logging

- All APDU commands logged
- Connection events logged
- JSON structured logging

## Monitoring

### Health Checks

- Database connectivity
- WebSocket health
- Active connection count

### Metrics

- Request count and latency
- Active connections (controllers/cardhosts)
- Message throughput
- Error rates

## Future Enhancements

- Multi-region routing
- Connection pooling
- Message queuing for offline cardhosts
- Advanced access control (RBAC)
- OAuth 2.0 integration
- Distributed tracing
- WebSocket compression
