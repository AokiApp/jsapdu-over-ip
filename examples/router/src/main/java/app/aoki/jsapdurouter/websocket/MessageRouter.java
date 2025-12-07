package app.aoki.jsapdurouter.websocket;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.Session;

/**
 * Central registry and routing service for WebSocket connections
 * Manages cardhost and controller sessions and routes messages between them
 */
@ApplicationScoped
public class MessageRouter {
    
    // Map of cardhost UUID to WebSocket session
    private final Map<String, Session> cardhostSessions = new ConcurrentHashMap<>();
    
    // Map of controller session ID to WebSocket session
    private final Map<String, Session> controllerSessions = new ConcurrentHashMap<>();
    
    // Map of controller session ID to target cardhost UUID
    private final Map<String, String> controllerTargets = new ConcurrentHashMap<>();

    /**
     * Register a cardhost connection
     */
    public void registerCardhost(String uuid, Session session) {
        cardhostSessions.put(uuid, session);
        System.out.println("[MessageRouter] Cardhost registered: " + uuid);
    }

    /**
     * Unregister a cardhost connection
     */
    public void unregisterCardhost(String uuid) {
        cardhostSessions.remove(uuid);
        System.out.println("[MessageRouter] Cardhost unregistered: " + uuid);
    }

    /**
     * Register a controller connection
     */
    public void registerController(String sessionId, String targetCardhostUuid, Session session) {
        controllerSessions.put(sessionId, session);
        controllerTargets.put(sessionId, targetCardhostUuid);
        System.out.println("[MessageRouter] Controller registered: " + sessionId + " -> " + targetCardhostUuid);
    }

    /**
     * Unregister a controller connection
     */
    public void unregisterController(String sessionId) {
        controllerSessions.remove(sessionId);
        controllerTargets.remove(sessionId);
        System.out.println("[MessageRouter] Controller unregistered: " + sessionId);
    }

    /**
     * Route RPC request from controller to cardhost
     */
    public boolean routeToCardhost(String cardhostUuid, String message) {
        Session session = cardhostSessions.get(cardhostUuid);
        if (session == null || !session.isOpen()) {
            System.err.println("[MessageRouter] Cardhost not available: " + cardhostUuid);
            return false;
        }

        try {
            session.getBasicRemote().sendText(message);
            return true;
        } catch (Exception e) {
            System.err.println("[MessageRouter] Error routing to cardhost: " + e.getMessage());
            return false;
        }
    }

    /**
     * Route RPC response from cardhost to controller
     */
    public boolean routeToController(String controllerSessionId, String message) {
        Session session = controllerSessions.get(controllerSessionId);
        if (session == null || !session.isOpen()) {
            System.err.println("[MessageRouter] Controller not available: " + controllerSessionId);
            return false;
        }

        try {
            session.getBasicRemote().sendText(message);
            return true;
        } catch (Exception e) {
            System.err.println("[MessageRouter] Error routing to controller: " + e.getMessage());
            return false;
        }
    }

    /**
     * Check if a cardhost is connected
     */
    public boolean isCardhostConnected(String uuid) {
        Session session = cardhostSessions.get(uuid);
        return session != null && session.isOpen();
    }

    /**
     * Get target cardhost UUID for a controller session
     */
    public String getControllerTarget(String controllerSessionId) {
        return controllerTargets.get(controllerSessionId);
    }
}
