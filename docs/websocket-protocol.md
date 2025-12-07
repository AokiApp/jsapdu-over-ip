# WebSocket Protocol Specification (Draft)

## Overview

The router uses WebSocket connections for bidirectional, real-time communication between controllers and cardhosts. This document provides example message formats and protocol flows. **The protocol should remain flexible during implementation to accommodate changing requirements.**

## Connection Endpoints (Example)

### Cardhost Connection
```
ws://router-host:port/ws/cardhost
```

**Authentication**: 
- Public-key cryptography based (Web Crypto API compliant)
- Initial message includes UUID (for addressing) and public key (for authentication)

### Controller Connection
```
ws://router-host:port/ws/controller/{sessionId}
```

**Authentication**:
- Public-key cryptography based (Web Crypto API compliant)
- Session ID obtained from REST API (optional pattern)

---

## Message Format (Example)

Messages are JSON-encoded. Below is one possible approach that can evolve:

### 1. RPC Request Example (Controller → Router → Cardhost)

```json
{
  "type": "request",
  "id": "req-123",
  "method": "platform.getDeviceInfo",
  "params": [],
  "targetCardhost": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Fields** (example):
- `type`: Message type
- `id`: Request identifier for matching responses
- `method`: jsapdu method name
- `params`: Method parameters
- `targetCardhost`: UUID for addressing (not authentication)

### 2. RPC Response Example (Cardhost → Router → Controller)

**Success Response**:
```json
{
  "type": "response",
  "id": "req-123",
  "result": {
    "devices": [
      {"name": "ACS ACR122U", "id": "reader-0"}
    ]
  }
}
```

**Error Response**:
```json
{
  "type": "response",
  "id": "req-123",
  "error": {
    "code": -32000,
    "message": "Card not present"
  }
}
```

### 3. Event Notification Example (Cardhost → Router → Controller)

```json
{
  "type": "event",
  "event": "cardInserted",
  "data": {
    "deviceId": "reader-0",
    "atr": "3B8F8001..."
  },
  "sourceCardhost": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 4. Control Messages (Example)

**Heartbeat**:
```json
{
  "type": "heartbeat",
  "timestamp": "2025-12-07T06:00:00Z"
}
```

**Cardhost Registration** (with public-key authentication):
```json
{
  "type": "register",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "<base64-encoded-public-key>",
  "name": "Office Card Reader",
  "capabilities": {
    "readers": 2,
    "supportedProtocols": ["T=0", "T=1"]
  },
  "signature": "<authentication-signature>"
}
```

**Note**: These are examples. The actual protocol implementation may differ based on requirements.

---

## Protocol Flow (Example)

Below are example flows. Actual implementation may vary.

### Cardhost Registration Flow (Example)

```
Cardhost                Router
   |                       |
   |----CONNECT----------->|
   |                       |
   |----register---------->|
   | (with public key)     |
   |                       | (validate signature + store)
   |<---registered---------|
   |                       |
   |----heartbeat--------->| (every 30s)
   |<---heartbeat----------|
```

### Controller Session Flow

```
Controller             Router
   |                      |
   | GET /api/controller/sessions
   |--------------------->|
   |<--sessionId----------|
   |                      |
   |----CONNECT---------->|
   |  (with sessionId)    |
   |                      |
   |----heartbeat-------->| (every 30s)
   |<---heartbeat---------|
```

### APDU Request Flow

```
Controller          Router            Cardhost
   |                  |                  |
   |--request-------->|                  |
   | (targetCardhost) |                  |
   |                  |----request------>|
   |                  |                  | (execute)
   |                  |<---response------|
   |<--response-------|                  |
```

### Event Flow (Card Insertion)

```
Cardhost            Router          Controller
   |                  |                  |
   | (card inserted)  |                  |
   |--event---------->|                  |
   |                  |----event-------->|
   |                  |                  | (all subscribed)
```

---

## Error Codes (Example)

Following JSON-RPC 2.0 conventions (can be adapted):

| Code   | Message               | Description                          |
|--------|-----------------------|--------------------------------------|
| -32700 | Parse error           | Invalid JSON                         |
| -32600 | Invalid request       | Malformed request object             |
| -32601 | Method not found      | Method does not exist                |
| -32602 | Invalid params        | Invalid method parameters            |
| -32603 | Internal error        | Internal server error                |
| -32000 | Cardhost not found    | Target cardhost not connected        |
| -32001 | Cardhost timeout      | Cardhost did not respond             |
| -32002 | Card not present      | No card in reader                    |
| -32003 | APDU error            | APDU command failed                  |
| -32004 | Authentication failed | Invalid credentials                  |

---

## Connection Management (Suggested)

### Heartbeat (Example)
- Both sides send heartbeat periodically (e.g., every 30 seconds)
- Connection considered dead if no heartbeat for timeout period
- Router closes stale connections

### Reconnection
- Cardhosts should reconnect automatically on disconnect
- Controllers should reconnect and restore session
- UUID (for addressing) persists across reconnections
- Public keys used for re-authentication

### Connection Limits (Example)
- Maximum 1 connection per cardhost UUID
- Multiple controllers can connect simultaneously
- Router may impose rate limits

---

## Security Considerations

### Authentication
- **Public-key cryptography**: All authentication via Web Crypto API
- **UUID for addressing only**: Not used for authentication
- **TLS/WSS**: Required for production

### Authorization
- Public-key based access control
- Router validates controller has permission to access cardhost
- Access control managed via public keys, not UUIDs

### Rate Limiting
- Maximum requests per second per connection
- Maximum concurrent requests
- Maximum message size

### APDU Validation
- Validate APDU format
- Block potentially dangerous commands
- Log all APDU traffic for audit

---

## Implementation Notes

**This protocol specification is intentionally flexible and should be adapted during implementation based on actual requirements. The examples provided are not prescriptive.**

### Message Sequencing
- Request IDs should be unique per connection
- Responses should match request IDs
- Events have no matching request

**Note**: Implementation details for buffering, multiplexing, and error handling should be determined during development based on actual needs.
