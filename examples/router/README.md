# jsapdu-router

Java/Quarkus-based router service for connecting remote controllers with cardhosts over the internet.

## Overview

The router acts as a message broker between controllers (browser frontend) and cardhosts (hosting physical card readers). It maintains WebSocket connections with both parties and routes RPC messages between them.

## Features

- **WebSocket Support**: Real-time bidirectional communication
- **Message Routing**: Routes RPC messages between controllers and cardhosts
- **Health Checks**: SmallRye Health endpoints at `/healthz`
- **Metrics**: Prometheus-compatible metrics at `/q/metrics`
- **Swagger UI**: API documentation at `/swagger-ui`
- **Dev Services**: Automatic PostgreSQL container in development mode

## Prerequisites

- Java 21+
- Gradle 8.x (wrapper included)
- Docker (for Dev Services PostgreSQL in dev mode)

## Development

### Running in Dev Mode

```bash
./gradlew quarkusDev
```

This starts:
- The router on `http://localhost:8080`
- PostgreSQL via Quarkus Dev Services (automatic Docker container)
- Flyway migrations
- Hot reload
- Dev UI at `http://localhost:8080/q/dev-ui`
- Swagger UI at `http://localhost:8080/swagger-ui`

### WebSocket Endpoints

- `ws://localhost:8080/ws/cardhost/{uuid}` - Cardhost connection
- `ws://localhost:8080/ws/controller/{sessionId}/{cardhostUuid}` - Controller connection

### REST API Endpoints

- `GET /api/status` - Router status with connection counts
- `GET /api/ping` - Simple connectivity test
- `GET /healthz` - Health check endpoint
- `GET /q/metrics` - Prometheus metrics

### Building

```bash
./gradlew build
```

### Running Tests

```bash
./gradlew test
```

## Deployment

### Production Configuration

Set environment variables:

```bash
QUARKUS_DATASOURCE_USERNAME=jsapdu_router
QUARKUS_DATASOURCE_PASSWORD=<secure-password>
QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://db-host:5432/jsapdu_router
```

### Running

```bash
java -jar build/quarkus-app/quarkus-run.jar
```

## Architecture

The router uses:
- **Quarkus 3.x**: Modern Java framework
- **WebSockets**: For bidirectional controller/cardhost communication
- **PostgreSQL**: For cardhost registry (future enhancement)
- **Flyway**: Database migrations
- **SmallRye Health**: Health checks
- **Micrometer + Prometheus**: Metrics

## Message Flow

```
Controller                Router                Cardhost
    |                        |                      |
    | RpcRequest (transmit)  |                      |
    |----------------------->|                      |
    |                        | RpcRequest (forward) |
    |                        |--------------------->|
    |                        |                      | [Execute on card]
    |                        |  RpcResponse (result)|
    |                        |<---------------------|
    | RpcResponse (result)   |                      |
    |<-----------------------|                      |
```

## Implementation Notes

This is a **minimal implementation** focused on message routing. Future enhancements may include:

- Authentication layer (public-key based)
- Database persistence for cardhost registry
- Session management
- Rate limiting
- Message queuing for offline cardhosts
- Multi-region routing

## License

MIT
