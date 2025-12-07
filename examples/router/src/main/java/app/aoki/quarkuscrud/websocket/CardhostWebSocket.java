package app.aoki.quarkuscrud.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * WebSocket endpoint for cardhost connections
 * Cardhosts connect here and register with their UUID
 * 
 * Note: Quarkus WebSockets Next creates one instance per connection,
 * so instance variables are connection-scoped.
 */
@WebSocket(path = "/ws/cardhost")
public class CardhostWebSocket {
    private static final Logger LOG = Logger.getLogger(CardhostWebSocket.class);
    
    @Inject
    RoutingService routingService;
    
    @Inject
    ObjectMapper objectMapper;
    
    // Instance variable is safe - one instance per connection in WebSockets Next
    private String cardhostUuid;
    
    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        LOG.infof("Cardhost WebSocket connection opened: %s", connection.id());
    }
    
    @OnTextMessage
    public void onMessage(String message, WebSocketConnection connection) {
        try {
            RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);
            
            // Handle authentication message
            if ("auth-success".equals(rpcMessage.getType())) {
                // Extract UUID from auth success message
                // Simplified authentication - in production, verify signatures
                if (rpcMessage.getData() != null && rpcMessage.getData().has("uuid")) {
                    cardhostUuid = rpcMessage.getData().get("uuid").asText();
                    routingService.registerCardhost(cardhostUuid, connection);
                    
                    // Send confirmation using ObjectMapper to prevent JSON injection
                    RpcMessage confirmationMsg = new RpcMessage();
                    confirmationMsg.setType("registered");
                    var data = objectMapper.createObjectNode();
                    data.put("uuid", cardhostUuid);
                    confirmationMsg.setData(data);
                    
                    connection.sendTextAndAwait(objectMapper.writeValueAsString(confirmationMsg));
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
            
        } catch (Exception e) {
            LOG.errorf(e, "Error processing cardhost message: %s", message);
        }
    }
    
    @OnClose
    public void onClose(WebSocketConnection connection) {
        if (cardhostUuid != null) {
            routingService.unregisterCardhost(cardhostUuid);
        }
        LOG.infof("Cardhost WebSocket connection closed: %s", connection.id());
    }
}
