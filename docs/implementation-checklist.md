# Implementation Checklist for Next Session

This document provides a clear roadmap for implementing the examples components in the next session.

## Session 1 Completed ✅

All design, architecture, and planning work has been completed:
- Directory structure created
- OpenAPI specification for router
- WebSocket protocol defined
- Shared TypeScript types and utilities
- Comprehensive documentation
- CI/CD workflow skeleton
- Monorepo configuration

## Session 2 Goals

Implement the four main components with working code.

---

## 1. Shared Package Implementation (Priority: Highest)

**Status**: Structure complete, implementation ready  
**Estimated Time**: Already done - just needs building

### Tasks
- [ ] Verify TypeScript compilation works
- [ ] No additional implementation needed - types and utils are complete

**Files**:
- ✅ `examples/shared/src/protocol.ts`
- ✅ `examples/shared/src/types.ts`
- ✅ `examples/shared/src/utils.ts`
- ✅ `examples/shared/src/index.ts`

---

## 2. Router Implementation (Priority: High)

**Status**: OpenAPI spec complete, Java implementation needed  
**Estimated Time**: 90-120 minutes

### Tasks

#### Project Setup
- [ ] Copy quarkus-crud template structure to `examples/router/`
- [ ] Update `build.gradle` with dependencies
- [ ] Create `settings.gradle`
- [ ] Setup `gradle.properties`

#### Database Layer
- [ ] Create Flyway migration `V1__init_schema.sql`:
  - `cardhosts` table
  - `controller_sessions` table
- [ ] Create MyBatis mappers:
  - `CardhostMapper.java` + `CardhostMapper.xml`
  - `SessionMapper.java` + `SessionMapper.xml`

#### Entity Layer
- [ ] `app.aoki.jsapdu.router.entity.Cardhost.java`
- [ ] `app.aoki.jsapdu.router.entity.ControllerSession.java`

#### Service Layer
- [ ] `app.aoki.jsapdu.router.service.CardhostService.java` - CRUD for cardhosts
- [ ] `app.aoki.jsapdu.router.service.SessionService.java` - Session management
- [ ] `app.aoki.jsapdu.router.service.RoutingService.java` - Message routing logic

#### REST API Layer
- [ ] `app.aoki.jsapdu.router.resource.CardhostResource.java`
  - `GET /api/cardhosts`
  - `GET /api/cardhosts/{uuid}`
- [ ] `app.aoki.jsapdu.router.resource.ControllerResource.java`
  - `POST /api/controller/sessions`

#### WebSocket Layer
- [ ] `app.aoki.jsapdu.router.websocket.CardhostWebSocket.java`
  - Handle cardhost connections at `/ws/cardhost`
  - Process registration messages
  - Handle APDU responses
  - Manage heartbeat
- [ ] `app.aoki.jsapdu.router.websocket.ControllerWebSocket.java`
  - Handle controller connections at `/ws/controller/{sessionId}`
  - Route APDU requests to cardhosts
  - Manage heartbeat
- [ ] `app.aoki.jsapdu.router.websocket.MessageRouter.java`
  - Route messages between controllers and cardhosts
  - Track active connections
  - Handle connection lifecycle

#### Configuration
- [ ] `src/main/resources/application.properties`
  - Database connection
  - WebSocket settings
  - CORS configuration
  - Health checks
  - Metrics

#### Testing
- [ ] Unit tests for services
- [ ] Integration tests for WebSocket handlers
- [ ] REST API tests

**Key Files to Create**:
```
examples/router/
├── build.gradle
├── settings.gradle
├── src/main/
│   ├── java/app/aoki/jsapdu/router/
│   │   ├── websocket/
│   │   ├── resource/
│   │   ├── service/
│   │   ├── entity/
│   │   └── mapper/
│   └── resources/
│       ├── application.properties
│       └── db/migration/
└── src/test/
```

---

## 3. Cardhost Implementation (Priority: High)

**Status**: Package structure complete, code needed  
**Estimated Time**: 60-90 minutes

### Tasks

#### Core Implementation
- [ ] `src/index.ts` - Main entry point
  - Load configuration
  - Initialize platform (PC/SC or mock)
  - Connect to router
  - Start heartbeat loop

- [ ] `src/config.ts` - Configuration management
  - Load UUID from file (or generate)
  - Parse environment variables
  - Save UUID on first run

- [ ] `src/router-client.ts` - WebSocket client
  - Connect to router
  - Handle reconnection with exponential backoff
  - Send/receive messages
  - Heartbeat management

- [ ] `src/cardhost-service.ts` - Main service logic
  - Wrap jsapdu-pcsc platform
  - Handle RPC requests
  - Send events to router
  - UUID persistence

#### Mock Platform (for testing)
- [ ] `src/mock-platform.ts` - Mock jsapdu platform
  - Simulate card readers
  - Generate fake responses
  - For testing without hardware

#### Testing
- [ ] Unit tests for configuration
- [ ] Unit tests for message handling
- [ ] Integration tests with mock platform

**Dependencies to Add**:
- `ws` - WebSocket client
- `@types/ws` - TypeScript types
- Consider jsapdu-pcsc (may not be in npm registry, might need local package)

**Key Files to Create**:
```
examples/cardhost/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── router-client.ts
│   ├── cardhost-service.ts
│   └── mock-platform.ts
└── config.json (generated at runtime)
```

---

## 4. Controller Implementation (Priority: Medium)

**Status**: Package structure complete, frontend needed  
**Estimated Time**: 60-90 minutes

### Tasks

#### Decide on Frontend Framework
- [ ] Option A: Vanilla HTML/CSS/TypeScript (simpler, faster)
- [ ] Option B: React (better structure, more complex)
- Recommendation: Start with vanilla for this session

#### Core Implementation
- [ ] `src/index.ts` - Main entry point
- [ ] `src/websocket-client.ts` - WebSocket client
  - Connect to router
  - Handle reconnection
  - Send APDU requests
  - Receive responses
- [ ] `src/api-client.ts` - REST API client
  - Create session
  - List cardhosts
  - Get cardhost details
- [ ] `src/app.ts` - Application logic
  - UI state management
  - Command building
  - Response parsing

#### UI Implementation
- [ ] `public/index.html` - Main HTML structure
  - Connection panel
  - Cardhost selection
  - APDU command builder
  - Response viewer
- [ ] `public/styles.css` - Styling
- [ ] Build system (Vite or webpack)

#### Testing
- [ ] Manual testing with router and cardhost
- [ ] E2E test scenarios

**Key Files to Create**:
```
examples/controller/
├── src/
│   ├── index.ts
│   ├── websocket-client.ts
│   ├── api-client.ts
│   └── app.ts
├── public/
│   ├── index.html
│   └── styles.css
└── vite.config.ts (or similar)
```

---

## 5. Cardhost Monitor Implementation (Priority: Low)

**Status**: Package structure complete, UI needed  
**Estimated Time**: 45-60 minutes

### Tasks

#### Core Implementation
- [ ] `src/index.ts` - Main entry point
- [ ] `src/api-client.ts` - API client for cardhost
- [ ] `src/monitor.ts` - Dashboard logic
  - Fetch metrics
  - Display status
  - Show events

#### UI Implementation
- [ ] `public/index.html` - Dashboard HTML
  - Status panel
  - Readers panel
  - Metrics charts
  - Events log
- [ ] `public/styles.css` - Styling
- [ ] Consider using Chart.js for metrics visualization

#### Integration
- [ ] Cardhost needs to expose monitoring API
  - `GET /api/status`
  - `GET /api/readers`
  - `GET /api/metrics`
  - `GET /api/events`

**Key Files to Create**:
```
examples/cardhost-monitor/
├── src/
│   ├── index.ts
│   ├── api-client.ts
│   └── monitor.ts
└── public/
    ├── index.html
    └── styles.css
```

---

## 6. Integration & Testing

### Integration Testing
- [ ] Start router (with PostgreSQL)
- [ ] Start cardhost (with mock platform)
- [ ] Start controller
- [ ] Verify end-to-end APDU flow
- [ ] Test connection recovery
- [ ] Test multiple controllers
- [ ] Test card events

### Documentation Updates
- [ ] Update job notes with implementation progress
- [ ] Document any design changes
- [ ] Add troubleshooting tips
- [ ] Update README with actual usage instructions

---

## 7. CI/CD Updates

### Update GitHub Actions Workflow
- [ ] Enable actual builds (remove echo placeholders)
- [ ] Add proper test commands
- [ ] Setup PostgreSQL service for router tests
- [ ] Cache dependencies properly

---

## Implementation Order Recommendation

1. **Shared** (verify only, already done)
2. **Router** (core infrastructure)
3. **Cardhost** (connects to router)
4. **Controller** (uses router to access cardhost)
5. **Monitor** (optional enhancement)
6. **Integration Testing**
7. **Documentation Updates**

---

## Key Dependencies to Consider

### Router (Quarkus)
- All dependencies defined in quarkus-crud template
- WebSocket support: `quarkus-websockets`
- Database: `quarkus-jdbc-postgresql`, `quarkus-flyway`
- MyBatis: custom integration from template
- JWT: `quarkus-smallrye-jwt`

### Cardhost (Node.js)
- `ws` - WebSocket client
- `@aokiapp/jsapdu-interface` - Interface definitions
- `@aokiapp/jsapdu-pcsc` - PC/SC implementation (if available)
- May need mock implementation if jsapdu-pcsc not accessible

### Controller (Browser)
- Build tool: Vite recommended
- No heavy framework needed for initial implementation
- Native WebSocket API

### Monitor (Browser)
- Same as controller
- Optional: Chart.js for visualizations

---

## Testing Strategy

### Unit Tests
- Router: Service and mapper tests
- Cardhost: Configuration and message handling
- Controller: API client tests
- Shared: Utility function tests

### Integration Tests
- Router: WebSocket handler tests with mock clients
- End-to-end: Full flow with all components

### Manual Testing
- Physical card reader (if available)
- Mock mode (without hardware)
- Connection recovery scenarios
- Multiple concurrent users

---

## Success Criteria

By end of Session 2:
- [ ] Router running and accepting WebSocket connections
- [ ] Cardhost connecting to router and registering
- [ ] Controller can list cardhosts and send APDU commands
- [ ] APDU commands routed from controller → router → cardhost → card
- [ ] Responses routed back: card → cardhost → router → controller
- [ ] Basic error handling in place
- [ ] Documentation updated with implementation notes
- [ ] CI builds successfully (may not have full tests yet)

---

## Notes

- Focus on getting a working end-to-end flow first
- Add robustness and error handling incrementally
- Monitor can be minimal or skipped if time is short
- Testing is important but can be minimal for demo purposes
- Documentation updates are crucial for next session

## References

All specifications completed in Session 1:
- `docs/examples-architecture.md`
- `docs/websocket-protocol.md`
- `docs/router.md`
- `docs/cardhost.md`
- `docs/controller.md`
- `examples/router/openapi/router-api.yaml`
- `examples/shared/src/protocol.ts`
