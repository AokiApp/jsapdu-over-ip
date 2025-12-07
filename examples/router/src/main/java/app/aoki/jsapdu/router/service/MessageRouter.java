package app.aoki.jsapdu.router.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.Session;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MessageRouter service routes RPC messages between controllers and cardhosts.
 * This is a simple in-memory implementation for demonstration purposes.
 */
@ApplicationScoped
public class MessageRouter {
    private static final Logger LOG = Logger.getLogger(MessageRouter.class);

    // Maps cardhost UUID to WebSocket session
    private final Map<UUID, Session> cardhostSessions = new ConcurrentHashMap<>();
    
    // Maps controller session ID to WebSocket session
    private final Map<UUID, Session> controllerSessions = new ConcurrentHashMap<>();
    
    // Maps controller session ID to target cardhost UUID
    private final Map<UUID, UUID> controllerToCardhost = new ConcurrentHashMap<>();

    /**
     * Register a cardhost WebSocket session.
     */
    public void registerCardhost(UUID cardhostUuid, Session session) {
        cardhostSessions.put(cardhostUuid, session);
        LOG.infof("Registered cardhost: %s", cardhostUuid);
    }

    /**
     * Unregister a cardhost WebSocket session.
     */
    public void unregisterCardhost(UUID cardhostUuid) {
        cardhostSessions.remove(cardhostUuid);
        LOG.infof("Unregistered cardhost: %s", cardhostUuid);
    }

    /**
     * Register a controller WebSocket session.
     */
    public void registerController(UUID sessionId, UUID targetCardhostUuid, Session session) {
        controllerSessions.put(sessionId, session);
        controllerToCardhost.put(sessionId, targetCardhostUuid);
        LOG.infof("Registered controller session: %s targeting cardhost: %s", sessionId, targetCardhostUuid);
    }

    /**
     * Unregister a controller WebSocket session.
     */
    public void unregisterController(UUID sessionId) {
        controllerSessions.remove(sessionId);
        controllerToCardhost.remove(sessionId);
        LOG.infof("Unregistered controller session: %s", sessionId);
    }

    /**
     * Route message from controller to cardhost.
     */
    public void routeToCardhost(UUID controllerSessionId, String message) {
        UUID cardhostUuid = controllerToCardhost.get(controllerSessionId);
        if (cardhostUuid == null) {
            LOG.warnf("No cardhost mapping for controller session: %s", controllerSessionId);
            return;
        }

        Session cardhostSession = cardhostSessions.get(cardhostUuid);
        if (cardhostSession == null || !cardhostSession.isOpen()) {
            LOG.warnf("Cardhost session not found or closed: %s", cardhostUuid);
            return;
        }

        try {
            cardhostSession.getBasicRemote().sendText(message);
            LOG.debugf("Routed message from controller %s to cardhost %s", controllerSessionId, cardhostUuid);
        } catch (IOException e) {
            LOG.errorf(e, "Failed to route message to cardhost: %s", cardhostUuid);
        }
    }

    /**
     * Route message from cardhost to controller.
     * In this simple implementation, we broadcast to all controllers connected to this cardhost.
     */
    public void routeToControllers(UUID cardhostUuid, String message) {
        controllerToCardhost.forEach((controllerSessionId, targetCardhostUuid) -> {
            if (targetCardhostUuid.equals(cardhostUuid)) {
                Session controllerSession = controllerSessions.get(controllerSessionId);
                if (controllerSession != null && controllerSession.isOpen()) {
                    try {
                        controllerSession.getBasicRemote().sendText(message);
                        LOG.debugf("Routed message from cardhost %s to controller %s", cardhostUuid, controllerSessionId);
                    } catch (IOException e) {
                        LOG.errorf(e, "Failed to route message to controller: %s", controllerSessionId);
                    }
                }
            }
        });
    }

    /**
     * Check if cardhost is connected.
     */
    public boolean isCardhostConnected(UUID cardhostUuid) {
        Session session = cardhostSessions.get(cardhostUuid);
        return session != null && session.isOpen();
    }

    /**
     * Get number of connected cardhosts.
     */
    public int getConnectedCardhostCount() {
        return (int) cardhostSessions.values().stream()
                .filter(Session::isOpen)
                .count();
    }

    /**
     * Get number of connected controllers.
     */
    public int getConnectedControllerCount() {
        return (int) controllerSessions.values().stream()
                .filter(Session::isOpen)
                .count();
    }
}
