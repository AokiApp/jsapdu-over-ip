package app.aoki.quarkuscrud.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import org.jboss.logging.Logger;

import java.io.IOException;

/**
 * WebSocket endpoint for cardhost connections
 * Cardhosts connect here and register with their UUID
 */
@ServerEndpoint("/ws/cardhost")
public class CardhostWebSocket {
    private static final Logger LOG = Logger.getLogger(CardhostWebSocket.class);
    
    @Inject
    RoutingService routingService;
    
    @Inject
    ObjectMapper objectMapper;
    
    private String cardhostUuid;
    
    @OnOpen
    public void onOpen(Session session) {
        LOG.infof("Cardhost WebSocket connection opened: %s", session.getId());
    }
    
    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);
            
            // Handle authentication message
            if ("auth-success".equals(rpcMessage.getType())) {
                // Extract UUID from auth success message
                // Simplified authentication - in production, verify signatures
                if (rpcMessage.getData() != null && rpcMessage.getData().has("uuid")) {
                    cardhostUuid = rpcMessage.getData().get("uuid").asText();
                    routingService.registerCardhost(cardhostUuid, session);
                    
                    // Send confirmation
                    session.getBasicRemote().sendText(
                        "{\"type\":\"registered\",\"data\":{\"uuid\":\"" + cardhostUuid + "\"}}"
                    );
                    LOG.infof("Cardhost authenticated: %s", cardhostUuid);
                }
                return;
            }
            
            // Route responses and events to controllers
            if (cardhostUuid != null) {
                routingService.routeToControllers(cardhostUuid, message);
            } else {
                LOG.warn("Received message from unauthenticated cardhost");
            }
            
        } catch (IOException e) {
            LOG.errorf(e, "Error processing cardhost message: %s", message);
        }
    }
    
    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        if (cardhostUuid != null) {
            routingService.unregisterCardhost(cardhostUuid);
        }
        LOG.infof("Cardhost WebSocket connection closed: %s, reason: %s", 
            session.getId(), closeReason);
    }
    
    @OnError
    public void onError(Session session, Throwable throwable) {
        LOG.errorf(throwable, "Cardhost WebSocket error: %s", session.getId());
    }
}
