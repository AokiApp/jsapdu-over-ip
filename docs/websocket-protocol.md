# WebSocket Protocol Specification

## Overview

The router uses WebSocket connections for bidirectional, real-time communication between controllers and cardhosts. This document defines the message format and protocol flow.

## Connection Endpoints

### Cardhost Connection
```
ws://router-host:port/ws/cardhost
```

**Authentication**: 
- Initial message must include cardhost UUID and optional secret
- JWT token in query parameter (optional)

### Controller Connection
```
ws://router-host:port/ws/controller/{sessionId}
```

**Authentication**:
- Session ID obtained from REST API
- JWT token in query parameter (optional)

---

## Message Format

All messages are JSON-encoded and follow one of three patterns:

### 1. RPC Request (Controller → Router → Cardhost)

```json
{
  "type": "request",
  "id": "req-123",
  "method": "platform.getDeviceInfo",
  "params": [],
  "targetCardhost": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Fields**:
- `type`: Always "request"
- `id`: Unique request identifier (used to match response)
- `method`: jsapdu method name (e.g., "platform.init", "device.connect")
- `params`: Array of method parameters
- `targetCardhost`: UUID of target cardhost (controller messages only)

### 2. RPC Response (Cardhost → Router → Controller)

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

**Fields**:
- `type`: Always "response"
- `id`: Matching request ID
- `result`: Method result (on success)
- `error`: Error object (on failure)

### 3. Event Notification (Cardhost → Router → Controller)

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

**Fields**:
- `type`: Always "event"
- `event`: Event name
- `data`: Event-specific data
- `sourceCardhost`: UUID of originating cardhost

### 4. Control Messages

**Heartbeat (both directions)**:
```json
{
  "type": "heartbeat",
  "timestamp": "2025-12-07T06:00:00Z"
}
```

**Cardhost Registration**:
```json
{
  "type": "register",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Office Card Reader",
  "secret": "optional-secret-key",
  "capabilities": {
    "readers": 2,
    "supportedProtocols": ["T=0", "T=1"]
  }
}
```

**Registration Acknowledgment**:
```json
{
  "type": "registered",
  "success": true,
  "message": "Cardhost registered successfully"
}
```

---

## Protocol Flow

### Cardhost Registration Flow

```
Cardhost                Router
   |                       |
   |----CONNECT----------->|
   |                       |
   |----register---------->|
   |                       | (validate + store)
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

## Error Codes

Following JSON-RPC 2.0 error code conventions:

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

## Connection Management

### Heartbeat
- Both sides send heartbeat every 30 seconds
- Connection considered dead if no heartbeat for 90 seconds
- Router closes stale connections

### Reconnection
- Cardhosts should reconnect automatically on disconnect
- Controllers should reconnect and restore session
- Cardhost UUID persists across reconnections

### Connection Limits
- Maximum 1 connection per cardhost UUID
- Multiple controllers can connect simultaneously
- Router may impose rate limits

---

## Security Considerations

### Authentication
- Cardhosts: UUID + optional secret key
- Controllers: Session-based or JWT
- Production should use TLS (wss://)

### Authorization
- Controllers specify target cardhost UUID
- Router validates controller has access to cardhost
- Access control list stored in database

### Rate Limiting
- Maximum requests per second per connection
- Maximum concurrent requests
- Maximum message size

### APDU Validation
- Router may validate APDU format
- Block dangerous commands (e.g., card management)
- Log all APDU traffic for audit

---

## Implementation Notes

### Message Sequencing
- Request IDs must be unique per connection
- Responses must match request IDs
- Events have no matching request

### Buffering
- Router should buffer messages if target is temporarily unavailable
- Maximum buffer size to prevent memory issues
- Timeout and return error if buffer full

### Multiplexing
- Single WebSocket connection handles multiple concurrent requests
- Use request IDs to match responses
- Events interleaved with responses

### Error Handling
- Connection errors: reconnect with exponential backoff
- Request timeout: return error after 30 seconds
- Invalid message: log and ignore (don't close connection)
