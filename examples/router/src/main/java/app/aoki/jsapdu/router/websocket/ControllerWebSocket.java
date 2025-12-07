package app.aoki.jsapdu.router.websocket;

import app.aoki.jsapdu.router.service.MessageRouter;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import org.jboss.logging.Logger;

import java.util.UUID;

/**
 * WebSocket endpoint for controller connections.
 * Controllers connect to ws://host:port/ws/controller/{sessionId}/{cardhostUuid}
 */
@ServerEndpoint("/ws/controller/{sessionId}/{cardhostUuid}")
public class ControllerWebSocket {
    private static final Logger LOG = Logger.getLogger(ControllerWebSocket.class);

    @Inject
    MessageRouter messageRouter;

    private UUID sessionId;
    private UUID cardhostUuid;

    @OnOpen
    public void onOpen(Session session, @PathParam("sessionId") String sessionIdStr, @PathParam("cardhostUuid") String cardhostUuidStr) {
        try {
            sessionId = UUID.fromString(sessionIdStr);
            cardhostUuid = UUID.fromString(cardhostUuidStr);
            
            messageRouter.registerController(sessionId, cardhostUuid, session);
            LOG.infof("Controller connected: session=%s targeting cardhost=%s (ws session: %s)", 
                     sessionId, cardhostUuid, session.getId());
        } catch (IllegalArgumentException e) {
            LOG.errorf("Invalid UUID in controller connection: sessionId=%s, cardhostUuid=%s", 
                      sessionIdStr, cardhostUuidStr);
            try {
                session.close(new CloseReason(CloseReason.CloseCodes.CANNOT_ACCEPT, "Invalid UUID"));
            } catch (Exception ex) {
                LOG.error("Failed to close session", ex);
            }
        }
    }

    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        if (sessionId != null) {
            messageRouter.unregisterController(sessionId);
            LOG.infof("Controller disconnected: session=%s (reason: %s)", sessionId, closeReason);
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        LOG.errorf(throwable, "Controller WebSocket error (session: %s)", session.getId());
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        if (sessionId == null) {
            LOG.warn("Received message from unregistered controller");
            return;
        }

        LOG.debugf("Received message from controller %s: %s", sessionId, message);
        
        // Route message to cardhost
        messageRouter.routeToCardhost(sessionId, message);
    }
}
