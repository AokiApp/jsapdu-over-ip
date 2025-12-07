# Implementation Checklist for Next Session

This document provides a roadmap for implementing the examples components in the next session.

**Important**: This checklist has been updated to reflect the revised architecture based on review feedback:
- Cardhost-monitor is integrated into cardhost (not standalone)
- Public-key cryptography for all authentication (Web Crypto API)
- UUID used only for addressing, not security
- More flexible, less prescriptive approach

## Session 1 Completed ✅

All design, architecture, and planning work has been completed and revised:
- Directory structure created
- OpenAPI specification for router (draft, flexible)
- WebSocket protocol defined (example, flexible)
- Shared TypeScript types and utilities
- Comprehensive documentation (revised)
- CI/CD workflow skeleton
- Monorepo configuration
- License changed to ANAL-Tight

## Session 2 Goals

Implement the three main components with working code:
1. **Shared** - TypeScript utilities (mostly done)
2. **Router** - Quarkus server with public-key auth
3. **Cardhost** - Node.js service with integrated monitor

---

## 1. Shared Package Implementation (Priority: Highest)

**Status**: Structure complete, implementation ready  
**Estimated Time**: Already done - just needs building

### Tasks
- [ ] Verify TypeScript compilation works
- [ ] Update protocol.ts if needed for public-key auth fields
- [ ] No major changes needed

---

## 2. Router Implementation (Priority: High)

**Status**: OpenAPI spec complete (draft), Java implementation needed  
**Estimated Time**: 90-120 minutes

### Key Changes from Original Plan
- Implement public-key cryptography instead of JWT
- Store public keys in database alongside UUIDs
- UUID for addressing only, public key for authentication
- Follow quarkus-crud template but remain flexible

### Tasks

#### Project Setup
- [ ] Copy quarkus-crud template structure to `examples/router/`
- [ ] Update `build.gradle` with dependencies (including crypto libs)
- [ ] Create `settings.gradle`
- [ ] Setup `gradle.properties`

#### Database Layer
- [ ] Create Flyway migration `V1__init_schema.sql`:
  - `cardhosts` table (with public_key column)
  - `controller_sessions` table (with public_key column)
- [ ] Create MyBatis mappers:
  - `CardhostMapper.java` + `CardhostMapper.xml`
  - `SessionMapper.java` + `SessionMapper.xml`

#### Service Layer  
- [ ] `app.aoki.jsapdu.router.service.CardhostService.java` - CRUD for cardhosts
- [ ] `app.aoki.jsapdu.router.service.AuthService.java` - Public-key authentication
- [ ] `app.aoki.jsapdu.router.service.RoutingService.java` - Message routing logic

#### REST API Layer
- [ ] `app.aoki.jsapdu.router.resource.CardhostResource.java`
  - `GET /api/cardhosts`
  - `GET /api/cardhosts/{uuid}`
- [ ] `app.aoki.jsapdu.router.resource.ControllerResource.java`
  - `POST /api/controller/sessions`

#### WebSocket Layer (Flexible Implementation)
- [ ] WebSocket handler for cardhosts
  - Authenticate using public-key cryptography
  - Process registration with UUID + public key
  - Handle APDU responses
  - Manage heartbeat
- [ ] WebSocket handler for controllers
  - Authenticate using public-key cryptography
  - Route APDU requests to cardhosts (by UUID)
  - Verify authorization based on public keys
  - Manage heartbeat
- [ ] Message routing logic
  - Route messages between controllers and cardhosts
  - Track active connections
  - Handle connection lifecycle

#### Configuration
- [ ] `src/main/resources/application.properties`
  - Database connection
  - WebSocket settings
  - Public-key auth configuration
  - CORS configuration
  - Health checks
  - Metrics

**Note**: Implementation structure should remain flexible based on actual needs.

---

## 3. Cardhost with Integrated Monitor (Priority: High)

**Status**: Package structure complete, code needed  
**Estimated Time**: 90-120 minutes (including monitor integration)

### Key Changes from Original Plan
- Monitor integrated into same process (not standalone)
- No formal API between cardhost and monitor
- Public-key cryptography for authentication
- UUID + key pair storage
- Monitor can be excluded at compile time

### Tasks

#### Core Implementation
- [ ] `src/index.ts` - Main entry point
  - Load configuration (UUID + keys)
  - Initialize platform (PC/SC or mock)
  - Start integrated monitor if enabled
  - Connect to router
  - Authenticate using public-key crypto
  - Start heartbeat loop

- [ ] `src/config.ts` - Configuration management
  - Load UUID from file (or generate)
  - Load key pair (or generate using Web Crypto API)
  - Generate key pair using Web Crypto API
  - Parse environment variables
  - Save UUID and keys on first run

- [ ] `src/crypto.ts` - Web Crypto API wrappers
  - Key pair generation
  - Signing and verification
  - Public key export/import

- [ ] `src/router-client.ts` - WebSocket client
  - Connect to router
  - Authenticate using public-key cryptography
  - Handle reconnection with exponential backoff
  - Send/receive messages
  - Heartbeat management

- [ ] `src/cardhost-service.ts` - Main service logic
  - Wrap jsapdu-pcsc platform
  - Handle RPC requests
  - Send events to router
  - UUID and key persistence

#### Integrated Monitor Module
- [ ] `src/monitor/index.ts` - Monitor module entry point
  - Start HTTP server for UI (e.g., port 3001)
  - Direct access to cardhost state (no API)
  - Optional at compile time

- [ ] `src/monitor/ui/` - Web UI files
  - Simple HTML/CSS/JavaScript for dashboard
  - Real-time updates using event emitters
  - Display status, readers, metrics, events

#### Mock Platform (for testing)
- [ ] `src/mock-platform.ts` - Mock jsapdu platform
  - Simulate card readers
  - Generate fake responses
  - For testing without hardware

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
│   ├── crypto.ts (Web Crypto API)
│   ├── router-client.ts
│   ├── cardhost-service.ts
│   ├── monitor/
│   │   ├── index.ts
│   │   └── ui/
│   └── mock-platform.ts
└── config.json (generated at runtime)
```

---

## 4. Controller Implementation (Priority: Medium)

**Status**: Package structure complete, frontend needed  
**Estimated Time**: 60-90 minutes

### Key Changes from Original Plan
- Public-key cryptography for authentication (Web Crypto API)
- Public-key based peer discovery

### Tasks

#### Decide on Frontend Framework
- [ ] Option A: Vanilla HTML/CSS/TypeScript (simpler, faster)
- [ ] Option B: React (better structure, more complex)
- Recommendation: Start with vanilla for this session

#### Core Implementation
- [ ] `src/index.ts` - Main entry point
- [ ] `src/crypto.ts` - Web Crypto API wrappers
  - Key pair generation
  - Signing and verification
- [ ] `src/websocket-client.ts` - WebSocket client
  - Connect to router
  - Authenticate using public-key cryptography
  - Handle reconnection
  - Send APDU requests
  - Receive responses
- [ ] `src/api-client.ts` - REST API client
  - Create session
  - List cardhosts (with public key info)
  - Get cardhost details
- [ ] `src/app.ts` - Application logic
  - UI state management
  - Command building
  - Response parsing

#### UI Implementation
- [ ] `public/index.html` - Main HTML structure
  - Connection panel
  - Cardhost selection (by UUID for addressing)
  - Public key display/verification
  - APDU command builder
  - Response viewer
- [ ] `public/styles.css` - Styling
- [ ] Build system (Vite recommended)

**Key Files to Create**:
```
examples/controller/
├── src/
│   ├── index.ts
│   ├── crypto.ts (Web Crypto API)
│   ├── websocket-client.ts
│   ├── api-client.ts
│   └── app.ts
├── public/
│   ├── index.html
│   └── styles.css
└── vite.config.ts
```

**Note**: Monitor is now integrated into cardhost, so section 5 is removed.

---

## 5. Integration & Testing
### Integration Testing
- [ ] Start router (with PostgreSQL)
- [ ] Start cardhost with integrated monitor (with mock platform)
- [ ] Start controller
- [ ] Verify end-to-end APDU flow with public-key auth
- [ ] Test connection recovery
- [ ] Test multiple controllers
- [ ] Test card events
- [ ] Verify monitor UI shows correct status

### Documentation Updates
- [ ] Update job notes with implementation progress
- [ ] Document any design changes
- [ ] Add troubleshooting tips for public-key setup
- [ ] Update README with actual usage instructions

---

## 6. CI/CD Updates

### Update GitHub Actions Workflow
- [ ] Enable actual builds (remove echo placeholders)
- [ ] Add proper test commands
- [ ] Setup PostgreSQL service for router tests
- [ ] Cache dependencies properly

---

## Implementation Order Recommendation

1. **Shared** (verify only, mostly done)
2. **Router** (core infrastructure with public-key auth)
3. **Cardhost** (with integrated monitor)
4. **Controller** (with public-key auth)
5. **Integration Testing**
6. **Documentation Updates**

---

## Key Dependencies to Consider

### Router (Quarkus)
- All dependencies defined in quarkus-crud template
- WebSocket support: `quarkus-websockets`
- Database: `quarkus-jdbc-postgresql`, `quarkus-flyway`
- MyBatis: custom integration from template
- **Public-key cryptography libraries** for Java

### Cardhost (Node.js)
- `ws` - WebSocket client
- `@aokiapp/jsapdu-interface` - Interface definitions
- `@aokiapp/jsapdu-pcsc` - PC/SC implementation (if available)
- **Web Crypto API** - Built-in to Node.js (crypto.subtle)
- May need mock implementation if jsapdu-pcsc not accessible

### Controller (Browser)
- Build tool: Vite recommended
- **Web Crypto API** - Native browser support
- Native WebSocket API

---

## Testing Strategy

### Unit Tests
- Router: Service and mapper tests, crypto tests
- Cardhost: Configuration, key management, message handling
- Controller: API client tests, crypto tests
- Shared: Utility function tests

### Integration Tests
- Router: WebSocket handler tests with mock clients
- End-to-end: Full flow with public-key authentication

### Manual Testing
- Physical card reader (if available)
- Mock mode (without hardware)
- Connection recovery scenarios
- Public-key authentication flows
- Multiple concurrent users

---

## Success Criteria

By end of Session 2:
- [ ] Router running with public-key authentication
- [ ] Cardhost connecting to router with public-key auth
- [ ] Cardhost integrated monitor accessible
- [ ] Controller can authenticate and list cardhosts
- [ ] APDU commands routed with proper authorization
- [ ] Public-key based peer identity working
- [ ] UUID used only for addressing, not authentication
- [ ] Documentation updated with implementation notes
- [ ] CI builds successfully

---

## Important Notes

- **Flexibility**: Implementation should adapt based on actual needs
- **Public-key crypto**: Critical security feature, not optional
- **Monitor integration**: Part of cardhost, not separate
- **UUID role**: Addressing only, not authentication
- **Documentation**: Keep updated with actual implementation decisions

## References

All specifications completed in Session 1 (revised):
- `docs/examples-architecture.md` (updated)
- `docs/websocket-protocol.md` (flexible/draft)
- `docs/router.md` (updated)
- `docs/cardhost.md` (updated with monitor integration)
- `docs/controller.md` (updated)
- `docs/cardhost-monitor.md` (updated for integration)
- `examples/router/openapi/router-api.yaml` (draft)
- `examples/shared/src/protocol.ts`
