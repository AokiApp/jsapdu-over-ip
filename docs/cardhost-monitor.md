# Cardhost Monitor

Web-based monitoring dashboard for cardhost owners to view operational status, metrics, and logs.

## Overview

The cardhost monitor is a web UI that provides visibility into cardhost operations. It can run as a standalone application or be embedded within the cardhost process.

## Features

- **Real-time Status**: View connection state and active sessions
- **Reader Information**: List of connected card readers and card presence
- **Metrics Dashboard**: Charts for uptime, command count, and latency
- **Event Log**: View recent card insertion/removal events
- **System Information**: Display cardhost UUID, version, and configuration
- **Responsive UI**: Works on desktop and mobile browsers

## Architecture

```
┌────────────────────────┐
│   Browser UI           │
│   (Web Dashboard)      │
├────────────────────────┤
│   Charts & Metrics     │
│   (Chart.js/D3)        │
├────────────────────────┤
│   API Client           │
│   (REST/WebSocket)     │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│   Cardhost Service     │
│   (HTTP/WS Server)     │
└────────────────────────┘
```

### Deployment Modes

**Embedded Mode**: Monitor runs in same process as cardhost
- Cardhost starts HTTP server on separate port
- Monitor served as static files
- Direct access to cardhost state

**Standalone Mode**: Monitor as separate application
- Connects to cardhost via API
- Can monitor multiple cardhosts
- Better isolation

## Technology Stack

- **TypeScript**: Type-safe development
- **HTML/CSS**: User interface
- **Web Framework**: React/Vue/Svelte or vanilla (TBD)
- **Charts**: Chart.js or D3.js for metrics visualization
- **WebSocket**: Real-time updates

## Features Detail

### Dashboard View

**Status Panel**:
- Connection state (connected/disconnected)
- Cardhost UUID
- Router URL
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
- Error messages
- Timestamp for each event

### Configuration View

- Display current configuration
- Router URL
- Heartbeat interval
- UUID persistence location

## API Requirements

The monitor expects the cardhost to expose these endpoints:

### REST API

- `GET /api/status` - Current status
- `GET /api/readers` - List of card readers
- `GET /api/metrics` - Metrics data
- `GET /api/events` - Recent events
- `GET /api/config` - Configuration

### WebSocket

- `ws://host:port/ws/monitor` - Real-time updates

## Usage

### Standalone Mode

```bash
cd examples/cardhost-monitor
npm install
npm run dev
```

### Embedded Mode

Start cardhost with monitor enabled:

```bash
cd examples/cardhost
ENABLE_MONITOR=true npm start
# Monitor available at http://localhost:3001
```

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

## Configuration

### Environment Variables

- `CARDHOST_API_URL`: Cardhost API URL (default: `http://localhost:3001`)
- `REFRESH_INTERVAL`: Metrics refresh interval in ms (default: `5000`)

## Security

- Monitor should be accessible only to cardhost owner
- Implement authentication for standalone mode
- Use HTTPS in production
- Restrict CORS to trusted origins

## Future Enhancements

- Historical metrics storage
- Alert configuration
- Email/SMS notifications
- Multi-cardhost monitoring
- Export metrics (CSV/JSON)
- Dark mode theme
- Mobile app version
