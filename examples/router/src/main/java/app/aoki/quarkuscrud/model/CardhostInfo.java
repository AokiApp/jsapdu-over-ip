package app.aoki.quarkuscrud.model;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;

/**
 * Cardhost information model
 * Matches CardhostInfo schema from OpenAPI spec
 */
public class CardhostInfo {
    private String uuid;
    private String publicKey;
    private String name;
    private String status; // "connected" or "disconnected"
    
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant connectedAt;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant lastHeartbeat;
    
    public CardhostInfo() {}
    
    public CardhostInfo(String uuid, String publicKey) {
        this.uuid = uuid;
        this.publicKey = publicKey;
        this.status = "connected";
        this.connectedAt = Instant.now();
        this.lastHeartbeat = Instant.now();
    }
    
    public String getUuid() {
        return uuid;
    }
    
    public void setUuid(String uuid) {
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
    
    public void updateHeartbeat() {
        this.lastHeartbeat = Instant.now();
    }
}
