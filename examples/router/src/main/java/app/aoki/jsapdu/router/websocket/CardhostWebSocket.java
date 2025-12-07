package app.aoki.jsapdu.router.websocket;

import app.aoki.jsapdu.router.service.MessageRouter;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import org.jboss.logging.Logger;

import java.util.UUID;

/**
 * WebSocket endpoint for cardhost connections.
 * Cardhosts connect to ws://host:port/ws/cardhost/{uuid}
 */
@ServerEndpoint("/ws/cardhost/{uuid}")
public class CardhostWebSocket {
    private static final Logger LOG = Logger.getLogger(CardhostWebSocket.class);

    @Inject
    MessageRouter messageRouter;

    private UUID cardhostUuid;

    @OnOpen
    public void onOpen(Session session, @PathParam("uuid") String uuidStr) {
        try {
            cardhostUuid = UUID.fromString(uuidStr);
            messageRouter.registerCardhost(cardhostUuid, session);
            LOG.infof("Cardhost connected: %s (session: %s)", cardhostUuid, session.getId());
        } catch (IllegalArgumentException e) {
            LOG.errorf("Invalid cardhost UUID: %s", uuidStr);
            try {
                session.close(new CloseReason(CloseReason.CloseCodes.CANNOT_ACCEPT, "Invalid UUID"));
            } catch (Exception ex) {
                LOG.error("Failed to close session", ex);
            }
        }
    }

    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        if (cardhostUuid != null) {
            messageRouter.unregisterCardhost(cardhostUuid);
            LOG.infof("Cardhost disconnected: %s (reason: %s)", cardhostUuid, closeReason);
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        LOG.errorf(throwable, "Cardhost WebSocket error (session: %s)", session.getId());
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        if (cardhostUuid == null) {
            LOG.warn("Received message from unregistered cardhost");
            return;
        }

        LOG.debugf("Received message from cardhost %s: %s", cardhostUuid, message);
        
        // Route message to controllers
        messageRouter.routeToControllers(cardhostUuid, message);
    }
}
