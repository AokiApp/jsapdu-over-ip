package app.aoki.quarkuscrud.websocket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.Session;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Routing service for jsapdu-over-ip
 * Routes RPC messages between controllers and cardhosts
 */
@ApplicationScoped
public class RoutingService {
    private static final Logger LOG = Logger.getLogger(RoutingService.class);
    
    // Cardhost connections: UUID -> Session
    private final Map<String, Session> cardhosts = new ConcurrentHashMap<>();
    
    // Controller connections: Session -> target cardhost UUID
    private final Map<Session, String> controllers = new ConcurrentHashMap<>();
    
    /**
     * Register a cardhost connection
     */
    public void registerCardhost(String uuid, Session session) {
        cardhosts.put(uuid, session);
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
    public void registerController(Session session, String targetCardhostUuid) {
        controllers.put(session, targetCardhostUuid);
        LOG.infof("Controller registered targeting cardhost: %s", targetCardhostUuid);
    }
    
    /**
     * Unregister a controller connection
     */
    public void unregisterController(Session session) {
        String target = controllers.remove(session);
        LOG.infof("Controller unregistered (was targeting: %s)", target);
    }
    
    /**
     * Route message from controller to cardhost
     */
    public void routeToCardhost(Session controllerSession, String message) throws IOException {
        String cardhostUuid = controllers.get(controllerSession);
        if (cardhostUuid == null) {
            LOG.warnf("Controller session not registered: %s", controllerSession.getId());
            return;
        }
        
        Session cardhostSession = cardhosts.get(cardhostUuid);
        if (cardhostSession == null) {
            LOG.warnf("Target cardhost not connected: %s", cardhostUuid);
            // Send error back to controller
            controllerSession.getBasicRemote().sendText(
                String.format("{\"type\":\"error\",\"data\":{\"message\":\"Cardhost %s not connected\"}}", 
                    cardhostUuid)
            );
            return;
        }
        
        if (!cardhostSession.isOpen()) {
            LOG.warnf("Target cardhost session closed: %s", cardhostUuid);
            cardhosts.remove(cardhostUuid);
            return;
        }
        
        cardhostSession.getBasicRemote().sendText(message);
        LOG.debugf("Routed message from controller to cardhost %s", cardhostUuid);
    }
    
    /**
     * Route message from cardhost to controller(s)
     */
    public void routeToControllers(String cardhostUuid, String message) throws IOException {
        // Find all controllers targeting this cardhost
        for (Map.Entry<Session, String> entry : controllers.entrySet()) {
            if (cardhostUuid.equals(entry.getValue())) {
                Session controllerSession = entry.getKey();
                if (controllerSession.isOpen()) {
                    controllerSession.getBasicRemote().sendText(message);
                    LOG.debugf("Routed message from cardhost %s to controller", cardhostUuid);
                } else {
                    controllers.remove(controllerSession);
                }
            }
        }
    }
    
    /**
     * Check if cardhost is connected
     */
    public boolean isCardhostConnected(String uuid) {
        Session session = cardhosts.get(uuid);
        return session != null && session.isOpen();
    }
    
    /**
     * Get all connected cardhost UUIDs
     */
    public Map<String, Session> getConnectedCardhosts() {
        return Map.copyOf(cardhosts);
    }
}
