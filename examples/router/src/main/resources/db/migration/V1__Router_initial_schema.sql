-- V1: Initial Schema for jsapdu-router
-- Cardhost registry and session management

-- Cardhosts table: stores registered cardhosts
CREATE TABLE cardhosts (
    uuid UUID PRIMARY KEY,
    public_key TEXT NOT NULL,
    name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
    capabilities JSONB,
    connected_at TIMESTAMP,
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cardhosts_status ON cardhosts(status);
CREATE INDEX idx_cardhosts_last_heartbeat ON cardhosts(last_heartbeat);

-- Controller sessions table: tracks active controller sessions
CREATE TABLE controller_sessions (
    session_id UUID PRIMARY KEY,
    target_cardhost_uuid UUID REFERENCES cardhosts(uuid) ON DELETE CASCADE,
    client_info JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE INDEX idx_controller_sessions_cardhost ON controller_sessions(target_cardhost_uuid);
CREATE INDEX idx_controller_sessions_status ON controller_sessions(status);
CREATE INDEX idx_controller_sessions_last_activity ON controller_sessions(last_activity);

-- Audit log for tracking connections and activities
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
