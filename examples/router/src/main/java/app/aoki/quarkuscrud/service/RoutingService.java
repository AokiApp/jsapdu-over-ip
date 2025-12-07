package app.aoki.quarkuscrud.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import app.aoki.quarkuscrud.websocket.RpcMessage;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for routing RPC messages between controllers and cardhosts.
 * 
 * Handles the business logic of message routing, separate from WebSocket transport.
 */
@ApplicationScoped
public class RoutingService {
    private static final Logger LOG = Logger.getLogger(RoutingService.class);
    
    @Inject
    ObjectMapper objectMapper;
    
    @Inject
    CardhostService cardhostService;
    
    // Controller connections: Connection -> target cardhost UUID
    private final Map<WebSocketConnection, String> controllers = new ConcurrentHashMap<>();
    
    /**
     * Register a controller connection targeting a specific cardhost.
     * 
     * @param connection Controller WebSocket connection
     * @param targetCardhostUuid Target cardhost UUID
     */
    public void registerController(WebSocketConnection connection, String targetCardhostUuid) {
        controllers.put(connection, targetCardhostUuid);
        LOG.infof("Controller registered targeting cardhost: %s", targetCardhostUuid);
    }
    
    /**
     * Unregister a controller connection.
     * 
     * @param connection Controller WebSocket connection
     */
    public void unregisterController(WebSocketConnection connection) {
        String target = controllers.remove(connection);
        LOG.infof("Controller unregistered (was targeting: %s)", target);
    }
    
    /**
     * Route message from controller to cardhost.
     * 
     * @param controllerConnection Controller WebSocket connection
     * @param message RPC message to route
     */
    public void routeToCardhost(WebSocketConnection controllerConnection, String message) {
        String cardhostUuid = controllers.get(controllerConnection);
        if (cardhostUuid == null) {
            LOG.warnf("Controller connection not registered: %s", controllerConnection.id());
            return;
        }
        
        WebSocketConnection cardhostConnection = cardhostService.getConnection(cardhostUuid);
        if (cardhostConnection == null) {
            LOG.warnf("Target cardhost not connected: %s", cardhostUuid);
            sendError(controllerConnection, "Cardhost " + cardhostUuid + " not connected");
            return;
        }
        
        if (!cardhostConnection.isOpen()) {
            LOG.warnf("Target cardhost connection closed: %s", cardhostUuid);
            cardhostService.unregisterCardhost(cardhostUuid);
            return;
        }
        
        cardhostConnection.sendTextAndAwait(message);
        LOG.debugf("Routed message from controller to cardhost %s", cardhostUuid);
    }
    
    /**
     * Route message from cardhost to controller(s).
     * 
     * @param cardhostUuid Cardhost UUID sending the message
     * @param message RPC message to route
     */
    public void routeToControllers(String cardhostUuid, String message) {
        // Find all controllers targeting this cardhost
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
     * Send error message to controller.
     * 
     * @param connection Controller connection
     * @param errorMessage Error message
     */
    private void sendError(WebSocketConnection connection, String errorMessage) {
        try {
            RpcMessage errorMsg = new RpcMessage();
            errorMsg.setType("error");
            var data = objectMapper.createObjectNode();
            data.put("message", errorMessage);
            errorMsg.setData(data);
            
            connection.sendTextAndAwait(objectMapper.writeValueAsString(errorMsg));
        } catch (Exception e) {
            LOG.errorf(e, "Failed to send error message");
        }
    }
}
