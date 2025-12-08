package app.aoki.quarkuscrud.entity;

import java.time.Instant;

/**
 * Cardhost entity - persisted cardhost registration
 *
 * <p>Stores cardhost metadata for persistence across router restarts. Used with MyBatis for
 * database access.
 */
public class Cardhost {
  private Long id;
  private String uuid;
  private String publicKey;
  private String name;
  private String status; // "connected" or "disconnected"
  private Instant firstSeen;
  private Instant lastSeen;
  private Integer connectionCount;
  private Instant createdAt;
  private Instant updatedAt;

  // Default constructor for MyBatis
  public Cardhost() {}

  public Cardhost(String uuid, String publicKey) {
    this.uuid = uuid;
    this.publicKey = publicKey;
    this.status = "connected";
    this.firstSeen = Instant.now();
    this.lastSeen = Instant.now();
    this.connectionCount = 1;
    this.createdAt = Instant.now();
    this.updatedAt = Instant.now();
  }

  // Getters and setters
  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
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

  public Instant getFirstSeen() {
    return firstSeen;
  }

  public void setFirstSeen(Instant firstSeen) {
    this.firstSeen = firstSeen;
  }

  public Instant getLastSeen() {
    return lastSeen;
  }

  public void setLastSeen(Instant lastSeen) {
    this.lastSeen = lastSeen;
  }

  public Integer getConnectionCount() {
    return connectionCount;
  }

  public void setConnectionCount(Integer connectionCount) {
    this.connectionCount = connectionCount;
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
