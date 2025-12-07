# Cardhost Integrated Monitor

Web-based monitoring UI integrated into the cardhost service for operational visibility.

## Overview

The cardhost monitor is a web UI module that runs within the same process as the cardhost service. It provides the cardhost owner with visibility into operational status, metrics, and events. This is not a standalone application or microservice.

## Integration Architecture

- **Same Process**: Runs within cardhost Node.js process
- **No Formal API**: Direct access to cardhost internal state
- **Monolithic Code**: Efficient, tightly coupled implementation
- **Optional**: Can be excluded at compile time
- **Separate Port**: Serves UI on different port (e.g., 3001) while cardhost runs main service

## Features

- **Real-time Status**: View connection state and active sessions
- **Reader Information**: List of connected card readers and card presence
- **Metrics Dashboard**: Charts for uptime, command count, and latency
- **Event Log**: View recent card insertion/removal events
- **System Information**: Display cardhost UUID, public key fingerprint, version
- **Responsive UI**: Works on desktop and mobile browsers

## Technology Stack (Suggested)

- **TypeScript**: Type-safe development
- **HTML/CSS**: User interface
- **Simple Web Framework**: Minimal overhead
- **Optional**: Chart.js for metrics visualization

## Features Detail

### Dashboard View

**Status Panel**:
- Connection state (connected/disconnected)
- Cardhost UUID
- UUID (for addressing)
- Public key fingerprint (for identity)
- Uptime counter

**Readers Panel**:
- List of connected readers
- Reader name and status
- Card presence indicator
- Card ATR (if present)

**Metrics Panel**:
- Total APDU commands processed
- Commands per minute (chart)
- Average response time (chart)
- Connection uptime (chart)

**Events Panel**:
- Recent card insertions/removals
- Connection events
- Authentication events
- Error messages
- Timestamp for each event

## Implementation Notes

### No Formal API

The monitor module directly accesses cardhost internal state:
- Shared memory/objects within the same process
- No REST API or explicit interface needed
- Efficient monolithic implementation
- Event emitters for real-time updates

### Usage

The monitor is automatically available when cardhost starts (if not excluded at build time):

```bash
cd examples/cardhost
npm start
# Cardhost runs on default port
# Monitor UI available at http://localhost:3001
```

To build without monitor:

```bash
npm run build -- --no-monitor
# or use environment variable
BUILD_WITHOUT_MONITOR=true npm run build
```

## Development

Since the monitor is integrated into cardhost, development is done within the cardhost codebase:

```bash
cd examples/cardhost
npm run dev  # Starts cardhost with monitor
```
```

## Security

- Monitor should be accessible only to cardhost owner
- Bind to localhost or use authentication
- Use HTTPS in production
- Restrict network access appropriately

## Future Enhancements

- Historical metrics storage
- Alert configuration
- Enhanced visualization
- Export metrics (CSV/JSON)
- Dark mode theme
