package app.aoki.quarkuscrud.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Cardhost Entity - Persisted cardhost registration information
 * 
 * Stores cardhost UUIDs, public keys, and connection history.
 * Enables audit trail and reconnection across router restarts.
 */
@Entity
@Table(name = "cardhosts",
       indexes = {
           @Index(name = "idx_cardhost_uuid", columnList = "uuid", unique = true),
           @Index(name = "idx_cardhost_status", columnList = "status"),
           @Index(name = "idx_cardhost_last_seen", columnList = "last_seen")
       })
public class CardhostEntity extends PanacheEntityBase {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    
    @Column(name = "uuid", nullable = false, unique = true, length = 128)
    public String uuid;
    
    @Column(name = "public_key", nullable = false, columnDefinition = "TEXT")
    public String publicKey;
    
    @Column(name = "name", length = 255)
    public String name;
    
    @Column(name = "status", nullable = false, length = 20)
    public String status; // "connected", "disconnected"
    
    @Column(name = "first_seen", nullable = false)
    public Instant firstSeen;
    
    @Column(name = "last_seen", nullable = false)
    public Instant lastSeen;
    
    @Column(name = "connection_count", nullable = false)
    public Integer connectionCount = 0;
    
    @Version
    @Column(name = "version")
    public Long version;
    
    /**
     * Find cardhost by UUID
     */
    public static CardhostEntity findByUuid(String uuid) {
        return find("uuid", uuid).firstResult();
    }
    
    /**
     * Find all active cardhosts
     */
    public static java.util.List<CardhostEntity> findActive() {
        return list("status", "connected");
    }
    
    /**
     * Update last seen timestamp
     */
    public void updateLastSeen() {
        this.lastSeen = Instant.now();
    }
    
    /**
     * Mark as connected
     */
    public void connect() {
        this.status = "connected";
        this.connectionCount++;
        this.lastSeen = Instant.now();
    }
    
    /**
     * Mark as disconnected
     */
    public void disconnect() {
        this.status = "disconnected";
        this.lastSeen = Instant.now();
    }
}
