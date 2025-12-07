package app.aoki.quarkuscrud.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Routing service for jsapdu-over-ip
 * Routes RPC messages between controllers and cardhosts
 */
@ApplicationScoped
public class RoutingService {
    private static final Logger LOG = Logger.getLogger(RoutingService.class);
    
    @Inject
    ObjectMapper objectMapper;
    
    // Cardhost connections: UUID -> Connection
    private final Map<String, WebSocketConnection> cardhosts = new ConcurrentHashMap<>();
    
    // Controller connections: Connection -> target cardhost UUID
    private final Map<WebSocketConnection, String> controllers = new ConcurrentHashMap<>();
    
    /**
     * Register a cardhost connection
     */
    public void registerCardhost(String uuid, WebSocketConnection connection) {
        cardhosts.put(uuid, connection);
        LOG.infof("Cardhost registered: %s", uuid);
    }
    
    /**
     * Unregister a cardhost connection
     */
    public void unregisterCardhost(String uuid) {
        cardhosts.remove(uuid);
        LOG.infof("Cardhost unregistered: %s", uuid);
    }
    
    /**
     * Register a controller connection
     */
    public void registerController(WebSocketConnection connection, String targetCardhostUuid) {
        controllers.put(connection, targetCardhostUuid);
        LOG.infof("Controller registered targeting cardhost: %s", targetCardhostUuid);
    }
    
    /**
     * Unregister a controller connection
     */
    public void unregisterController(WebSocketConnection connection) {
        String target = controllers.remove(connection);
        LOG.infof("Controller unregistered (was targeting: %s)", target);
    }
    
    /**
     * Route message from controller to cardhost
     */
    public void routeToCardhost(WebSocketConnection controllerConnection, String message) {
        String cardhostUuid = controllers.get(controllerConnection);
        if (cardhostUuid == null) {
            LOG.warnf("Controller connection not registered: %s", controllerConnection.id());
            return;
        }
        
        WebSocketConnection cardhostConnection = cardhosts.get(cardhostUuid);
        if (cardhostConnection == null) {
            LOG.warnf("Target cardhost not connected: %s", cardhostUuid);
            // Send error back to controller using ObjectMapper to prevent JSON injection
            try {
                RpcMessage errorMsg = new RpcMessage();
                errorMsg.setType("error");
                var data = objectMapper.createObjectNode();
                data.put("message", "Cardhost " + cardhostUuid + " not connected");
                errorMsg.setData(data);
                
                controllerConnection.sendTextAndAwait(objectMapper.writeValueAsString(errorMsg));
            } catch (Exception e) {
                LOG.errorf(e, "Failed to send error message");
            }
            return;
        }
        
        if (!cardhostConnection.isOpen()) {
            LOG.warnf("Target cardhost connection closed: %s", cardhostUuid);
            cardhosts.remove(cardhostUuid);
            return;
        }
        
        cardhostConnection.sendTextAndAwait(message);
        LOG.debugf("Routed message from controller to cardhost %s", cardhostUuid);
    }
    
    /**
     * Route message from cardhost to controller(s)
     */
    public void routeToControllers(String cardhostUuid, String message) {
        // Find all controllers targeting this cardhost
        // Use iterator to safely remove closed connections during iteration
        controllers.entrySet().removeIf(entry -> {
            if (cardhostUuid.equals(entry.getValue())) {
                WebSocketConnection controllerConnection = entry.getKey();
                if (controllerConnection.isOpen()) {
                    controllerConnection.sendTextAndAwait(message);
                    LOG.debugf("Routed message from cardhost %s to controller", cardhostUuid);
                    return false; // Keep in map
                } else {
                    return true; // Remove from map
                }
            }
            return false; // Keep in map
        });
    }
    
    /**
     * Check if cardhost is connected
     */
    public boolean isCardhostConnected(String uuid) {
        WebSocketConnection connection = cardhosts.get(uuid);
        return connection != null && connection.isOpen();
    }
    
    /**
     * Get all connected cardhost UUIDs
     */
    public Map<String, WebSocketConnection> getConnectedCardhosts() {
        return Map.copyOf(cardhosts);
    }
}
