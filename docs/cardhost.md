# Cardhost

Node.js service that hosts physical smart card readers and executes APDU commands on behalf of remote controllers.

## Overview

The cardhost is a background service that runs on a machine with physical card readers. It connects to the router and allows remote controllers to access the attached card readers as if they were local.

## Features

- **Physical Card Reader Access**: Uses jsapdu-pcsc for PC/SC communication
- **Persistent UUID**: Maintains identity across restarts
- **Automatic Reconnection**: Handles network interruptions gracefully
- **Real-time Events**: Notifies controllers of card insertion/removal
- **NAT-Friendly**: Uses outbound connections only
- **Multiple Reader Support**: Can host multiple card readers simultaneously

## Architecture

```
┌────────────────────┐
│  Cardhost Service  │
├────────────────────┤
│   jsapdu-pcsc      │
│ (Local Platform)   │
├────────────────────┤
│ jsapdu-over-ip     │
│  Server Adapter    │
├────────────────────┤
│  WebSocket Client  │
└──────┬─────────────┘
       │ Outbound
       ▼
    Router
       ▲
       │
┌──────┴─────────────┐
│   PC/SC Daemon     │
│  (Card Readers)    │
└────────────────────┘
```

## Technology Stack

- **Node.js**: Runtime environment
- **TypeScript**: Type-safe development
- **jsapdu-pcsc**: PC/SC card reader access (or mock for testing)
- **jsapdu-over-ip**: Server adapter for remote access
- **WebSocket (ws)**: Communication with router

## Configuration

### Environment Variables

- `ROUTER_URL`: Router WebSocket URL (default: `ws://localhost:8080/ws/cardhost`)
- `CARDHOST_NAME`: Friendly name for this cardhost (optional)
- `CARDHOST_SECRET`: Authentication secret (optional)
- `UUID_FILE`: Path to UUID storage file (default: `./config.json`)
- `HEARTBEAT_INTERVAL`: Heartbeat interval in ms (default: `30000`)
- `USE_MOCK_PLATFORM`: Use mock platform if PC/SC unavailable (default: `false`)

### UUID Persistence

The cardhost generates a UUID on first run and stores it in a configuration file:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-12-07T06:00:00Z"
}
```

This UUID persists across restarts and is used to identify the cardhost to the router.

## Usage

### Starting the Cardhost

```bash
cd examples/cardhost
npm install
npm run build
npm start
```

### Development Mode

```bash
npm run dev
```

### Using Mock Platform (No Hardware)

```bash
USE_MOCK_PLATFORM=true npm start
```

## Operation

### Startup Sequence

1. Load or generate UUID
2. Initialize jsapdu platform (PC/SC or mock)
3. Connect to router via WebSocket
4. Send registration message with UUID and capabilities
5. Begin heartbeat loop
6. Listen for APDU requests

### Request Handling

1. Receive RPC request from router
2. Route to appropriate jsapdu method
3. Execute on local platform
4. Send response back through router
5. Log operation

### Event Reporting

- Card insertion → send event to router → broadcast to controllers
- Card removal → send event to router → broadcast to controllers
- Reader connection/disconnection → update capabilities

## Security Considerations

- Store UUID securely (consider encryption)
- Implement authentication secret
- Validate incoming APDU commands
- Rate limit requests
- Log all operations
- Restrict access to configuration file
- Use WSS in production

## Troubleshooting

### PC/SC Not Available

If PC/SC libraries are not installed, the cardhost will automatically fall back to mock mode if `USE_MOCK_PLATFORM=true`.

### Connection Issues

- Check router URL and network connectivity
- Verify firewall allows outbound WebSocket connections
- Check router logs for connection attempts

### UUID Conflicts

If UUID collision occurs (unlikely with 128-bit UUIDs), delete `config.json` and restart to generate new UUID.

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

### Cleaning

```bash
npm run clean
```

## Future Enhancements

- Support for additional card reader platforms
- Configuration hot-reload
- Metrics export (Prometheus)
- Multiple router support (failover)
- Access control list for controllers
- Command filtering and validation
- Session recording
