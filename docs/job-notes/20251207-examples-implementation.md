# Job Notes: Examples Implementation - 2025-12-07

## Session Overview

This is the first session for implementing the examples directory for jsapdu-over-ip demonstration components.

## Task Summary

Implement an examples directory containing four main components that demonstrate jsapdu-over-ip usage:
- **controller**: Browser-based frontend for sending APDUs to cards (TypeScript)
- **cardhost**: Service that hosts physical card readers and responds to controller requests (TypeScript)
- **router**: Server that connects controllers and cardhosts over the internet (Java/Quarkus)
- **cardhost-monitor**: Monitoring UI for cardhost owners (TypeScript)

## Session Goals

As per the issue requirements, this session focuses on:
1. ✅ Research and investigation (cloning reference repos)
2. ✅ Design and architecture (OpenAPI, interfaces, IaC)
3. ✅ Initial structure creation
4. ❌ Full TypeScript/Java implementation (deferred to next session)
5. ❌ Testing implementation (deferred to next session)

## Completed Work

### Investigation Phase
- ✅ Cloned reference repositories to /tmp:
  - `quarkus-crud`: Full-fledged Quarkus template for router implementation
  - `jsapdu`: Main jsapdu library with interface definitions
  - `readthecard`: Example usage of jsapdu-over-ip
- ✅ Analyzed existing jsapdu-over-ip architecture
- ✅ Reviewed readthecard monorepo structure (frontend/backend pattern)
- ✅ Reviewed quarkus-crud OpenAPI-first approach

### Directory Structure Created
```
examples/
├── controller/          # Browser frontend for APDU operations
│   ├── package.json
│   └── tsconfig.json
├── cardhost/           # Card host service
│   ├── package.json
│   └── tsconfig.json
├── router/             # Connection server (Quarkus)
│   └── openapi/
│       └── router-api.yaml
├── cardhost-monitor/   # Monitoring UI
│   ├── package.json
│   └── tsconfig.json
├── shared/             # Common code
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── protocol.ts
│       ├── types.ts
│       ├── utils.ts
│       └── index.ts
├── package.json        # Monorepo root
├── turbo.json          # Turborepo configuration
└── .gitignore

docs/
├── job-notes/
│   └── 20251207-examples-implementation.md
├── examples-architecture.md
├── examples-readme.md
├── websocket-protocol.md
├── controller.md
├── cardhost.md
├── router.md
└── cardhost-monitor.md

.github/workflows/
└── examples-ci.yml
```

## Architecture Decisions

### Communication Pattern
Based on the issue requirements:
- Controller → Router (outbound connection, can be behind NAT)
- Cardhost → Router (outbound connection, can be behind NAT)
- Router accepts inbound connections, minimal outbound
- Cardhost identified by UUID (128-bit, persistent across reconnections)

### Technology Stack

#### Controller (TypeScript)
- Browser-based frontend
- Uses jsapdu-over-ip client interfaces
- Low-level APDU operation GUI
- Connects to router with cardhost UUID

#### Cardhost (TypeScript)
- Node.js service
- Uses jsapdu local implementation (PC/SC)
- Connects to router (outbound)
- Persistent UUID for identification

#### Router (Java/Quarkus)
- Based on quarkus-crud template structure
- OpenAPI-first design
- WebSocket or SSE for bidirectional communication
- PostgreSQL for cardhost registration/state
- JWT authentication for security
- Health checks, metrics (Prometheus)

#### Cardhost-Monitor (TypeScript)
- Web UI (can run in same process as cardhost)
- Displays metrics, logs, telemetry
- For cardhost owner visibility

### Monorepo Structure
Following readthecard pattern:
- Root package.json with workspaces
- Turborepo for build orchestration
- Shared TypeScript configuration
- Individual package.json per component

## Next Steps for This Session

✅ All session goals completed!

### Completed in This Session

1. ✅ Created OpenAPI specification for router (router-api.yaml)
2. ✅ Designed TypeScript interfaces for WebSocket protocol
3. ✅ Created shared types and utilities package
4. ✅ Created package.json files for all components
5. ✅ Setup monorepo configuration (turbo.json, root package.json)
6. ✅ Documented architecture in docs/examples-architecture.md
7. ✅ Created comprehensive README and component docs
8. ✅ Setup CI workflow skeleton (.github/workflows/examples-ci.yml)
9. ✅ Created .gitignore for examples directory
10. ✅ Documented WebSocket protocol specification

## Files Created

### Configuration Files
- `examples/package.json` - Monorepo root configuration
- `examples/turbo.json` - Turborepo pipeline configuration
- `examples/.gitignore` - Ignore patterns for examples
- `examples/controller/package.json` - Controller package
- `examples/cardhost/package.json` - Cardhost package
- `examples/cardhost-monitor/package.json` - Monitor package
- `examples/shared/package.json` - Shared utilities package
- `examples/controller/tsconfig.json` - Controller TypeScript config
- `examples/cardhost/tsconfig.json` - Cardhost TypeScript config
- `examples/cardhost-monitor/tsconfig.json` - Monitor TypeScript config
- `examples/shared/tsconfig.json` - Shared TypeScript config

### API & Protocol Specifications
- `examples/router/openapi/router-api.yaml` - OpenAPI 3.0 specification for router REST API
- `examples/shared/src/protocol.ts` - WebSocket message type definitions
- `examples/shared/src/types.ts` - Shared TypeScript types
- `examples/shared/src/utils.ts` - Common utilities
- `examples/shared/src/index.ts` - Shared package exports

### Documentation
- `docs/job-notes/20251207-examples-implementation.md` - Session notes
- `docs/examples-architecture.md` - Overall architecture documentation
- `docs/examples-readme.md` - Examples directory overview
- `docs/websocket-protocol.md` - WebSocket protocol specification
- `docs/controller.md` - Controller component documentation
- `docs/cardhost.md` - Cardhost component documentation
- `docs/router.md` - Router component documentation
- `docs/cardhost-monitor.md` - Monitor component documentation

### CI/CD
- `.github/workflows/examples-ci.yml` - GitHub Actions workflow for building and testing examples

## Next Session Tasks

1. Implement router in Java/Quarkus
2. Implement controller frontend
3. Implement cardhost service
4. Implement cardhost-monitor UI
5. Write tests for all components
6. End-to-end integration testing

## Key Considerations

### UUID Persistence
- 128-bit UUID is small for permanent tracking
- Consider additional authentication/authorization
- Document UUID collision risks

### NAT Traversal
- Both controller and cardhost initiate outbound connections
- Router must maintain bidirectional channels (WebSocket recommended)
- Connection recovery and reconnection logic needed

### Security
- JWT for authentication
- Secure WebSocket (WSS)
- Consider rate limiting
- APDU command validation

## Reference Repository Insights

### quarkus-crud Template
- Excellent OpenAPI-first approach with modular specs
- Custom Gradle task for OpenAPI compilation
- OpenAPI Generator for REST interfaces and DTOs
- PostgreSQL + Flyway migrations
- MyBatis for SQL
- Comprehensive observability (Health, Metrics, Logging)
- Jib for containerization

### readthecard Example
- Simple monorepo: packages/frontend + packages/backend
- Backend hosts frontend assets
- Uses jsapdu-over-ip for remote card access
- Mock mode for testing without hardware

### jsapdu Repository
- Clear package structure
- Examples directory with multiple implementations
- Strong TypeScript typing throughout

## Notes
- Documentation should only go in docs/ directory
- No README.md or other .md files in root
- Use Turborepo for task orchestration
- CI must build and test examples
