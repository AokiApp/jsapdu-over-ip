package app.aoki.quarkuscrud.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import org.jboss.logging.Logger;

import java.io.IOException;

/**
 * WebSocket endpoint for controller connections
 * Controllers connect here and specify target cardhost UUID
 */
@ServerEndpoint("/ws/controller")
public class ControllerWebSocket {
    private static final Logger LOG = Logger.getLogger(ControllerWebSocket.class);
    
    @Inject
    RoutingService routingService;
    
    @Inject
    ObjectMapper objectMapper;
    
    private String targetCardhostUuid;
    
    @OnOpen
    public void onOpen(Session session) {
        LOG.infof("Controller WebSocket connection opened: %s", session.getId());
    }
    
    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);
            
            // Handle connection request with target cardhost UUID
            if ("connect".equals(rpcMessage.getType())) {
                // Extract target cardhost UUID
                if (rpcMessage.getData() != null && rpcMessage.getData().has("cardhostUuid")) {
                    targetCardhostUuid = rpcMessage.getData().get("cardhostUuid").asText();
                    routingService.registerController(session, targetCardhostUuid);
                    
                    // Check if cardhost is connected
                    boolean connected = routingService.isCardhostConnected(targetCardhostUuid);
                    session.getBasicRemote().sendText(
                        String.format("{\"type\":\"connected\",\"data\":{\"cardhostUuid\":\"%s\",\"available\":%b}}", 
                            targetCardhostUuid, connected)
                    );
                    LOG.infof("Controller connected targeting cardhost: %s (available: %b)", 
                        targetCardhostUuid, connected);
                }
                return;
            }
            
            // Route RPC requests to cardhost
            if (targetCardhostUuid != null) {
                routingService.routeToCardhost(session, message);
            } else {
                LOG.warn("Received message from unregistered controller");
                session.getBasicRemote().sendText(
                    "{\"type\":\"error\",\"data\":{\"message\":\"Not connected to cardhost\"}}"
                );
            }
            
        } catch (IOException e) {
            LOG.errorf(e, "Error processing controller message: %s", message);
        }
    }
    
    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        if (targetCardhostUuid != null) {
            routingService.unregisterController(session);
        }
        LOG.infof("Controller WebSocket connection closed: %s, reason: %s", 
            session.getId(), closeReason);
    }
    
    @OnError
    public void onError(Session session, Throwable throwable) {
        LOG.errorf(throwable, "Controller WebSocket error: %s", session.getId());
    }
}
