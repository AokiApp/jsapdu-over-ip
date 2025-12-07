# Router

Java-based Quarkus server that connects remote controllers with cardhosts over the internet.

## Overview

The router is an internet-facing server that acts as a relay between controllers (in browsers) and cardhosts (hosting physical card readers). It maintains WebSocket connections with both parties and routes APDU commands and responses between them.

## Features

- **Bidirectional Routing**: Routes APDU commands and responses
- **WebSocket Support**: Real-time bidirectional communication
- **RESTful API**: HTTP endpoints for registration and discovery
- **PostgreSQL Storage**: Persistent cardhost registry
- **JWT Authentication**: Secure controller sessions
- **Health Monitoring**: SmallRye Health checks
- **Metrics**: Prometheus-compatible metrics
- **OpenAPI Documentation**: Auto-generated API docs
- **Containerized**: Docker/Kubernetes ready via Jib

## Architecture

```
┌──────────────┐         ┌──────────────┐
│ Controller   │         │  Cardhost    │
│ (WebSocket)  │         │ (WebSocket)  │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │ Outbound               │ Outbound
       ▼                        ▼
┌─────────────────────────────────────┐
│            Router Server             │
├─────────────────────────────────────┤
│  WebSocket Handler                  │
│  - /ws/controller/{sessionId}       │
│  - /ws/cardhost                     │
├─────────────────────────────────────┤
│  REST API                           │
│  - /api/cardhosts (GET)             │
│  - /api/cardhosts/{uuid} (GET)      │
│  - /api/controller/sessions (POST)  │
├─────────────────────────────────────┤
│  Business Logic                     │
│  - Message routing                  │
│  - Connection management            │
│  - Authentication                   │
├─────────────────────────────────────┤
│  PostgreSQL Database                │
│  - Cardhost registry                │
│  - Controller sessions              │
│  - Audit logs                       │
└─────────────────────────────────────┘
```

## Technology Stack

- **Quarkus 3.x**: Modern Java framework
- **RESTEasy Reactive**: Reactive REST endpoints
- **WebSockets**: Quarkus WebSocket support
- **PostgreSQL 15**: Relational database
- **Flyway**: Database migrations
- **MyBatis**: SQL mapper
- **SmallRye OpenAPI**: API documentation
- **SmallRye JWT**: Authentication
- **SmallRye Health**: Health checks
- **Micrometer Prometheus**: Metrics
- **Jib**: Container image builder

## Project Structure

Based on quarkus-crud template:

```
router/
├── build.gradle
├── settings.gradle
├── gradle.properties
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

## Configuration

### application.properties

Key configuration properties:

```properties
# Server
quarkus.http.port=8080
quarkus.http.cors=true

# Database
quarkus.datasource.db-kind=postgresql
quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/jsapdu_router
quarkus.datasource.username=jsapdu
quarkus.datasource.password=changeme

# Flyway migrations
quarkus.flyway.migrate-at-start=true

# WebSocket
quarkus.websocket.max-frame-size=1048576

# JWT
mp.jwt.verify.publickey.location=META-INF/public-key.pem
mp.jwt.verify.issuer=https://router.example.com

# Health checks
quarkus.smallrye-health.root-path=/healthz

# Metrics
quarkus.micrometer.enabled=true
quarkus.micrometer.export.prometheus.enabled=true
```

## API Endpoints

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

### cardhosts table

```sql
CREATE TABLE cardhosts (
  uuid UUID PRIMARY KEY,
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
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

## Development

### Prerequisites

- Java 21+
- Docker (for PostgreSQL via Dev Services)
- Gradle 8.x

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
