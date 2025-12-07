# Cardhost with Integrated Monitor

Node.js service that hosts physical smart card readers, executes APDU commands on behalf of remote controllers, and provides an integrated monitoring UI for the cardhost owner.

## Overview

The cardhost is a monolithic background service that runs on a machine with physical card readers. It connects to the router and allows remote controllers to access the attached card readers. The monitoring UI runs in the same process (optional at compile time) to provide operational visibility to the cardhost owner.

## Features

- **Physical Card Reader Access**: Uses jsapdu-pcsc for PC/SC communication
- **UUID for Addressing**: Persistent UUID for peer addressing (not authentication)
- **Mutual Security**: Public-key cryptography for authentication (Web Crypto API compliant)
- **Automatic Reconnection**: Handles network interruptions gracefully
- **Real-time Events**: Notifies controllers of card insertion/removal
- **NAT-Friendly**: Uses outbound connections only
- **Multiple Reader Support**: Can host multiple card readers simultaneously
- **Integrated Monitoring**: Optional web UI in same process for cardhost owner
- **Public-key Identity**: Peer identity and discovery based on public keys

## Technology Stack (Suggested)

- **Node.js**: Runtime environment (version 23+ recommended)
- **TypeScript**: Type-safe development
- **jsapdu-pcsc**: PC/SC card reader access (or mock for testing)
- **jsapdu-over-ip**: Server adapter for remote access
- **WebSocket (ws)**: Communication with router
- **Web Crypto API**: Cryptographic operations for authentication

## Configuration

### Environment Variables

- `ROUTER_URL`: Router WebSocket URL (default: `ws://localhost:8080/ws/cardhost`)
- `CARDHOST_NAME`: Friendly name for this cardhost (optional)
- `UUID_FILE`: Path to UUID storage file (default: `./config.json`)
- `HEARTBEAT_INTERVAL`: Heartbeat interval in ms (default: `30000`)
- `USE_MOCK_PLATFORM`: Use mock platform if PC/SC unavailable (default: `false`)
- `ENABLE_MONITOR`: Enable integrated monitoring UI (default: `true`, can be excluded at compile time)

### UUID and Identity

The cardhost uses two identity mechanisms:

**UUID (for addressing only)**:
- Generated on first run and stored locally
- Used for routing/addressing in the router
- Survives restarts
- **Not used for authentication or security**
- Changing the UUID file does not provide authentication or prevent impersonation

**Public Key (for identity and authentication)**:
- Public-key pair generated using Web Crypto API
- Public key used for peer identity and discovery
- Private key used for authentication
- Mutual authentication with router and controllers
- Stored securely (consider encryption)

Configuration file example:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "<base64-encoded-public-key>",
  "privateKey": "<encrypted-private-key>",
  "createdAt": "2025-12-07T06:00:00Z"
}
```

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

1. Load or generate UUID (addressing) and key pair (identity/authentication)
2. Initialize jsapdu platform (PC/SC or mock)
3. Start integrated monitoring UI if enabled
4. Connect to router via WebSocket
5. Authenticate using public-key cryptography
6. Send registration with UUID, public key, and capabilities
7. Begin heartbeat loop
8. Listen for APDU requests

### Request Handling

1. Receive RPC request from router (authenticated)
2. Verify request authorization
3. Route to appropriate jsapdu method
4. Execute on local platform
5. Send response back through router
6. Log operation

### Event Reporting

- Card insertion → send event to router → broadcast to authorized controllers
- Card removal → send event to router → broadcast to authorized controllers
- Reader connection/disconnection → update capabilities

### Integrated Monitoring

The monitoring UI runs in the same process:
- No separate API or microservice architecture
- Direct access to cardhost internal state
- Efficient monolithic code
- Can be excluded at compile time via build flag
- Serves web interface on separate port (e.g., 3001)

## Security Considerations

- **Public-key authentication**: All authentication via Web Crypto API
- **UUID not for security**: UUID only for addressing; impersonation requires key theft
- **Secure key storage**: Private keys should be encrypted
- **Mutual authentication**: Verify router identity
- **Validate commands**: Sanitize and validate incoming APDU commands
- **Rate limiting**: Protect against DoS
- **Audit logging**: Log all operations
- **TLS/WSS**: Use in production

## Troubleshooting

### PC/SC Not Available

If PC/SC libraries are not installed, the cardhost will automatically fall back to mock mode if `USE_MOCK_PLATFORM=true`.

### Connection Issues

- Check router URL and network connectivity
- Verify firewall allows outbound WebSocket connections
- Verify public-key authentication is working
- Check router logs for connection attempts

### Key Management

- Protect private key file with appropriate permissions
- Consider hardware security module (HSM) for production
- Back up keys securely

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
- Public-key based access control
- Hardware security module (HSM) integration
- Enhanced monitoring dashboards
