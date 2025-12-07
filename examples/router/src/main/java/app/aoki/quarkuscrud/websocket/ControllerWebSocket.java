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
 * WebSocket endpoint for controller connections
 * Controllers connect here and specify target cardhost UUID
 * 
 * Note: Quarkus WebSockets Next creates one instance per connection,
 * so instance variables are connection-scoped.
 */
@WebSocket(path = "/ws/controller")
public class ControllerWebSocket {
    private static final Logger LOG = Logger.getLogger(ControllerWebSocket.class);
    
    @Inject
    RoutingService routingService;
    
    @Inject
    ObjectMapper objectMapper;
    
    // Instance variable is safe - one instance per connection in WebSockets Next
    private String targetCardhostUuid;
    
    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        LOG.infof("Controller WebSocket connection opened: %s", connection.id());
    }
    
    @OnTextMessage
    public void onMessage(String message, WebSocketConnection connection) {
        try {
            RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);
            
            // Handle connection request with target cardhost UUID
            if ("connect".equals(rpcMessage.getType())) {
                // Extract target cardhost UUID
                if (rpcMessage.getData() != null && rpcMessage.getData().has("cardhostUuid")) {
                    targetCardhostUuid = rpcMessage.getData().get("cardhostUuid").asText();
                    routingService.registerController(connection, targetCardhostUuid);
                    
                    // Check if cardhost is connected
                    boolean connected = routingService.isCardhostConnected(targetCardhostUuid);
                    
                    // Send confirmation using ObjectMapper to prevent JSON injection
                    RpcMessage connectedMsg = new RpcMessage();
                    connectedMsg.setType("connected");
                    var data = objectMapper.createObjectNode();
                    data.put("cardhostUuid", targetCardhostUuid);
                    data.put("available", connected);
                    connectedMsg.setData(data);
                    
                    connection.sendTextAndAwait(objectMapper.writeValueAsString(connectedMsg));
                    LOG.infof("Controller connected targeting cardhost: %s (available: %b)", 
                        targetCardhostUuid, connected);
                }
                return;
            }
            
            // Route RPC requests to cardhost
            if (targetCardhostUuid != null) {
                routingService.routeToCardhost(connection, message);
            } else {
                LOG.warn("Received message from unregistered controller");
                // Send error using ObjectMapper to prevent JSON injection
                RpcMessage errorMsg = new RpcMessage();
                errorMsg.setType("error");
                var data = objectMapper.createObjectNode();
                data.put("message", "Not connected to cardhost");
                errorMsg.setData(data);
                
                connection.sendTextAndAwait(objectMapper.writeValueAsString(errorMsg));
            }
            
        } catch (Exception e) {
            LOG.errorf(e, "Error processing controller message: %s", message);
        }
    }
    
    @OnClose
    public void onClose(WebSocketConnection connection) {
        if (targetCardhostUuid != null) {
            routingService.unregisterController(connection);
        }
        LOG.infof("Controller WebSocket connection closed: %s", connection.id());
    }
}
