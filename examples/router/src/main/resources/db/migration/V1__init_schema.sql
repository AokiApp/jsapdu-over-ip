-- jsapdu-router initial schema
-- Cardhost registry and session management

-- Cardhosts table: registry of connected cardhosts
CREATE TABLE cardhosts (
    uuid UUID PRIMARY KEY,
    public_key TEXT NOT NULL,
    name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
    capabilities JSONB,
    connected_at TIMESTAMP,
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_cardhosts_status ON cardhosts(status);
CREATE INDEX idx_cardhosts_public_key ON cardhosts(public_key);

-- Controller sessions table: active controller connections
CREATE TABLE controller_sessions (
    session_id UUID PRIMARY KEY,
    public_key TEXT,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup of expired sessions
CREATE INDEX idx_controller_sessions_expires_at ON controller_sessions(expires_at);

-- Routing table: tracks which controller is connected to which cardhost
CREATE TABLE active_connections (
    id SERIAL PRIMARY KEY,
    controller_session_id UUID NOT NULL REFERENCES controller_sessions(session_id) ON DELETE CASCADE,
    cardhost_uuid UUID NOT NULL REFERENCES cardhosts(uuid) ON DELETE CASCADE,
    connected_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    UNIQUE(controller_session_id, cardhost_uuid)
);

-- Indexes for routing lookups
CREATE INDEX idx_active_connections_controller ON active_connections(controller_session_id);
CREATE INDEX idx_active_connections_cardhost ON active_connections(cardhost_uuid);
