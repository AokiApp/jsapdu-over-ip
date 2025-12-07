# Controller

Browser-based frontend application for remotely sending APDU commands to smart cards via the router.

## Overview

The controller is a web application that allows users to interact with remote smart card readers hosted by cardhosts. It provides a GUI for constructing and sending APDU commands and viewing responses.

## Features

- **Remote Card Access**: Connect to cardhosts via router
- **APDU Command Builder**: Interactive UI for constructing APDU commands
- **Real-time Communication**: WebSocket-based bidirectional communication
- **Card Event Monitoring**: Receive notifications for card insertion/removal
- **Low-level Operations**: Full control over APDU commands
- **NAT-Friendly**: Uses outbound connections only

## Architecture

```
┌────────────────────┐
│   Browser UI       │
│  (React/Vanilla)   │
├────────────────────┤
│  jsapdu-over-ip    │
│   Client Proxy     │
├────────────────────┤
│  WebSocket Client  │
└──────┬─────────────┘
       │ Outbound
       ▼
    Router
```

## Technology Stack

- **TypeScript**: Type-safe development
- **jsapdu-over-ip**: Remote platform proxy
- **WebSocket**: Real-time communication
- **HTML/CSS**: User interface (framework TBD)

## Configuration

### Environment Variables

- `ROUTER_URL`: Router WebSocket URL (default: `ws://localhost:8080/ws/controller`)
- `AUTO_RECONNECT`: Enable automatic reconnection (default: `true`)

### Connection Setup

1. Obtain session ID from router REST API
2. Connect to router WebSocket with session ID
3. Select target cardhost by UUID
4. Begin sending APDU commands

## Usage

### Starting the Controller

```bash
cd examples/controller
npm install
npm run dev
```

### Connecting to a Cardhost

1. Enter router URL
2. Click "Connect"
3. Select cardhost from list
4. Start sending commands

### Sending APDU Commands

1. Enter APDU command in hex format (e.g., `00A4040008A0000000030000`)
2. Click "Send"
3. View response in output panel

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

## Security Considerations

- Controller should use WSS (secure WebSocket) in production
- Public-key cryptography for authentication (Web Crypto API compliant)
- Public-key based peer discovery and management
- Validate cardhost access permissions based on public keys
- Rate limit APDU commands
- Log all operations for audit trail

## Future Enhancements

- Command history and replay
- APDU templates for common operations
- Response parsing and formatting
- Card session recording
- Multiple simultaneous cardhost connections
