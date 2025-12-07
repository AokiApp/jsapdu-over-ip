package app.aoki.jsapdu.router.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * Cardhost entity representing a connected cardhost.
 */
public class Cardhost {
    private UUID uuid;
    private String publicKey;
    private String name;
    private String status; // connected, disconnected
    private String capabilities; // JSON string
    private Instant connectedAt;
    private Instant lastHeartbeat;
    private Instant createdAt;
    private Instant updatedAt;

    // Constructors
    public Cardhost() {}

    public Cardhost(UUID uuid, String publicKey) {
        this.uuid = uuid;
        this.publicKey = publicKey;
        this.status = "disconnected";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    // Getters and Setters
    public UUID getUuid() {
        return uuid;
    }

    public void setUuid(UUID uuid) {
        this.uuid = uuid;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(String publicKey) {
        this.publicKey = publicKey;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCapabilities() {
        return capabilities;
    }

    public void setCapabilities(String capabilities) {
        this.capabilities = capabilities;
    }

    public Instant getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(Instant connectedAt) {
        this.connectedAt = connectedAt;
    }

    public Instant getLastHeartbeat() {
        return lastHeartbeat;
    }

    public void setLastHeartbeat(Instant lastHeartbeat) {
        this.lastHeartbeat = lastHeartbeat;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
