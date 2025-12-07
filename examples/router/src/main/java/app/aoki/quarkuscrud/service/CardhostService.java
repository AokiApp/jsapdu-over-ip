package app.aoki.quarkuscrud.service;

import app.aoki.quarkuscrud.model.CardhostInfo;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing cardhost connections and metadata.
 * 
 * Handles cardhost registration, tracking, and lifecycle management.
 * Separates business logic from WebSocket transport layer.
 */
@ApplicationScoped
public class CardhostService {
    private static final Logger LOG = Logger.getLogger(CardhostService.class);
    
    // Cardhost connections: UUID -> Connection
    private final Map<String, WebSocketConnection> connections = new ConcurrentHashMap<>();
    
    // Cardhost metadata: UUID -> CardhostInfo
    private final Map<String, CardhostInfo> cardhostInfo = new ConcurrentHashMap<>();
    
    /**
     * Register a new cardhost connection.
     * 
     * @param uuid Cardhost UUID
     * @param connection WebSocket connection
     * @param publicKey Public key for authentication
     * @return The registered CardhostInfo
     */
    public CardhostInfo registerCardhost(String uuid, WebSocketConnection connection, String publicKey) {
        connections.put(uuid, connection);
        
        // Create or update cardhost info
        CardhostInfo info = cardhostInfo.computeIfAbsent(uuid, k -> new CardhostInfo(uuid, publicKey));
        info.setStatus("connected");
        info.updateHeartbeat();
        
        LOG.infof("Cardhost registered: %s", uuid);
        return info;
    }
    
    /**
     * Unregister a cardhost connection.
     * 
     * @param uuid Cardhost UUID
     */
    public void unregisterCardhost(String uuid) {
        connections.remove(uuid);
        
        // Update status but keep info for history
        CardhostInfo info = cardhostInfo.get(uuid);
        if (info != null) {
            info.setStatus("disconnected");
        }
        
        LOG.infof("Cardhost unregistered: %s", uuid);
    }
    
    /**
     * Get cardhost information by UUID.
     * 
     * @param uuid Cardhost UUID
     * @return CardhostInfo or null if not found
     */
    public CardhostInfo getCardhostInfo(String uuid) {
        return cardhostInfo.get(uuid);
    }
    
    /**
     * Get all cardhost information (connected and recently disconnected).
     * 
     * @return Map of UUID to CardhostInfo
     */
    public Map<String, CardhostInfo> getAllCardhostInfo() {
        return Map.copyOf(cardhostInfo);
    }
    
    /**
     * Get WebSocket connection for a cardhost.
     * 
     * @param uuid Cardhost UUID
     * @return WebSocketConnection or null if not connected
     */
    public WebSocketConnection getConnection(String uuid) {
        return connections.get(uuid);
    }
    
    /**
     * Check if cardhost is currently connected.
     * 
     * @param uuid Cardhost UUID
     * @return true if connected and connection is open
     */
    public boolean isConnected(String uuid) {
        WebSocketConnection connection = connections.get(uuid);
        return connection != null && connection.isOpen();
    }
}
