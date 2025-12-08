# jsapdu-over-ip Router

![Build](https://img.shields.io/badge/gradle-9.x-02303a?logo=gradle&labelColor=0b1724)
![Quarkus](https://img.shields.io/badge/quarkus-3.x-b326ff?logo=quarkus&labelColor=111)
![Java](https://img.shields.io/badge/java-21-orange?logo=openjdk&labelColor=111)

Router service for jsapdu-over-ip that connects remote controllers with cardhosts over the internet. Built with Quarkus following the quarkus-crud template architecture.

## Features

- **Contracts**
  - Modular OpenAPI sources under `openapi/`
  - Custom compiler (`compileOpenApi`) that bundles the spec
  - OpenAPI Generator producing REST interfaces and DTOs with Bean Validation
  - TypeScript fetch client packaged via npm
- **Persistence**
  - PostgreSQL 15 through Quarkus Dev Services or external DBs
  - Flyway migrations under `src/main/resources/db/migration`
  - MyBatis mappers for explicit SQL control
- **Routing**
  - WebSocket endpoints for controller and cardhost connections
  - Real-time bidirectional APDU routing
  - Public-key authentication for cardhosts
  - Session token management for controllers
- **Operations**
  - SmallRye OpenAPI + Swagger UI
  - SmallRye Health checks
  - Micrometer Prometheus metrics
  - JSON logging and CORS support
- **Delivery**
  - Dev UI with info extension enabled
  - Jib building distroless Java 21 images
  - Compiled `openapi.yaml` in runtime artifacts

## Core stack

- Quarkus 3, RESTEasy Reactive, CDI
- **Java 21 toolchain** (required)
- PostgreSQL 15 (Dev Services and production configs)
- Flyway, MyBatis
- WebSockets Next for real-time communication
- SmallRye OpenAPI / Health
- Micrometer Prometheus registry
- JSON logging via `quarkus-logging-json`
- OpenAPI Generator 7.x
- Jib container builds

## Requirements

- **Java 21** (required for Gradle toolchain)
- Docker (for PostgreSQL Dev Services in development)
- Gradle 9.x (wrapper included)

## Getting started

```bash
./gradlew quarkusDev
```

**Note**: Requires Java 21. Set `JAVA_HOME` to Java 21 installation:
```bash
export JAVA_HOME=/path/to/jdk-21
export PATH=$JAVA_HOME/bin:$PATH
./gradlew quarkusDev
```

Dev Services launches PostgreSQL, Flyway runs migrations, OpenAPI compiler bundles the spec, generated sources are compiled, and the dev server starts:
- Dev UI: `http://localhost:8080/q/dev-ui`
- Swagger UI: `http://localhost:8080/q/swagger-ui`
- Health: `http://localhost:8080/healthz` (custom) or `/q/health` (SmallRye)
- Metrics: `http://localhost:8080/q/metrics`

WebSocket endpoints:
- Cardhost: `ws://localhost:8080/ws/cardhost`
- Controller: `ws://localhost:8080/ws/controller/{sessionId}`

## OpenAPI Generation

The build automatically generates REST API interfaces and models from the OpenAPI spec:

```bash
# Compile modular OpenAPI spec
./gradlew compileOpenApi

# Generate Java interfaces and models
./gradlew generateOpenApiModels
```

Generated files are in `build/generated-src/openapi/`. Resource classes implement these interfaces (e.g., `CardhostApiImpl implements CardhostApi`).

## Building

To build and ship the router:

```bash
./gradlew clean build
```

For container image:

```bash
# Build distroless Java 21 image
./gradlew clean build jib
```

This produces a distroless image (default `ghcr.io/yuki-js/quarkus-crud:${version}`) with the OpenAPI spec and all artifacts.

## API Endpoints

### REST API
- `GET /api/cardhosts` - List available cardhosts
- `GET /api/cardhosts/{uuid}` - Get cardhost details
- `POST /api/controller/sessions` - Create controller session
- `GET /healthz` - Health check

### WebSocket
- `ws://host:port/ws/cardhost` - Cardhost connection (challenge-response auth)
- `ws://host:port/ws/controller/{sessionId}` - Controller connection (token auth)

## Development

### Prerequisites

Ensure Java 21 is installed and set as `JAVA_HOME`.

### Running Tests

```bash
./gradlew test
```

### Code Style

The project uses Spotless for formatting and Checkstyle for linting:

```bash
# Check code style
./gradlew spotlessCheck checkstyleMain

# Apply formatting
./gradlew spotlessApply
```

### Database Migrations

Flyway migrations are in `src/main/resources/db/migration/`:
- `V1__create_cardhosts_table.sql` - Initial schema

## Architecture

Resources implement OpenAPI-generated interfaces:
- `CardhostApiImpl implements CardhostApi`
- `ControllerApiImpl implements ControllerApi`
- `HealthApiImpl implements HealthApi`

Services use MyBatis for database access:
- `CardhostService` - Manages cardhost registry
- `RoutingService` - Routes messages between controllers and cardhosts

Use cases orchestrate domain logic:
- `RegisterCardhostUseCase` - Cardhost registration
- `EstablishConnectionUseCase` - Controller-cardhost pairing
- `RouteRpcMessageUseCase` - Message routing

## Documentation

For detailed information, see:
- `docs/router.md` - Router architecture and design
- `docs/websocket-protocol.md` - WebSocket protocol spec
- `docs/security-architecture.md` - Authentication and encryption
- `openapi/openapi.yaml` - API specification

## License

Apache License 2.0
