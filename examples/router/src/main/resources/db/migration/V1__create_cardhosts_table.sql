-- Cardhost registration and tracking table
CREATE TABLE cardhosts (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(128) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
    first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    connection_count INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX idx_cardhost_uuid ON cardhosts(uuid);
CREATE INDEX idx_cardhost_status ON cardhosts(status);
CREATE INDEX idx_cardhost_last_seen ON cardhosts(last_seen);

-- Comment for documentation
COMMENT ON TABLE cardhosts IS 'Stores cardhost registration information and connection history';
COMMENT ON COLUMN cardhosts.uuid IS 'Unique identifier for the cardhost';
COMMENT ON COLUMN cardhosts.public_key IS 'Public key for authentication';
COMMENT ON COLUMN cardhosts.status IS 'Current status: connected or disconnected';
COMMENT ON COLUMN cardhosts.connection_count IS 'Total number of times connected';
