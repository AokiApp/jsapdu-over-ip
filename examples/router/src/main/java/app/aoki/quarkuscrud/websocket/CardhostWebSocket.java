package app.aoki.quarkuscrud.websocket;

import app.aoki.quarkuscrud.model.CardhostInfo;
import app.aoki.quarkuscrud.service.CardhostService;
import app.aoki.quarkuscrud.usecase.RegisterCardhostUseCase;
import app.aoki.quarkuscrud.usecase.RouteRpcMessageUseCase;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * WebSocket adapter for cardhost connections.
 * 
 * This is the adapter/interface layer - translates WebSocket protocol to domain operations.
 * Thin layer that delegates to use cases.
 */
@WebSocket(path = "/ws/cardhost")
public class CardhostWebSocket {
    private static final Logger LOG = Logger.getLogger(CardhostWebSocket.class);
    
    @Inject
    RegisterCardhostUseCase registerCardhostUseCase;
    
    @Inject
    RouteRpcMessageUseCase routeRpcMessageUseCase;
    
    @Inject
    CardhostService cardhostService;
    
    @Inject
    ObjectMapper objectMapper;
    
    // Instance variable is safe - one instance per connection in WebSockets Next
    private String cardhostUuid;
    
    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        LOG.infof("Cardhost connection opened: %s", connection.id());
    }
    
    @OnTextMessage
    public void onMessage(String message, WebSocketConnection connection) {
        try {
            RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);
            
            // Handle authentication message
            if ("auth-success".equals(rpcMessage.getType())) {
                handleAuthentication(connection, rpcMessage);
                return;
            }
            
            // Route responses/events to controllers
            if (cardhostUuid != null) {
                routeRpcMessageUseCase.routeToControllers(cardhostUuid, message);
            } else {
                LOG.warn("Received message from unauthenticated cardhost");
            }
            
        } catch (Exception e) {
            LOG.errorf(e, "Error processing cardhost message");
        }
    }
    
    @OnClose
    public void onClose(WebSocketConnection connection) {
        if (cardhostUuid != null) {
            cardhostService.unregisterCardhost(cardhostUuid);
        }
        LOG.infof("Cardhost connection closed: %s", connection.id());
    }
    
    private void handleAuthentication(WebSocketConnection connection, RpcMessage authMessage) {
        try {
            if (authMessage.getData() == null || !authMessage.getData().has("uuid")) {
                LOG.warn("Authentication message missing UUID");
                return;
            }
            
            String uuid = authMessage.getData().get("uuid").asText();
            String publicKey = authMessage.getData().has("publicKey") 
                ? authMessage.getData().get("publicKey").asText() 
                : "";
            
            // Execute use case
            CardhostInfo info = registerCardhostUseCase.execute(uuid, publicKey, connection);
            cardhostUuid = uuid;
            
            // Send confirmation (WebSocket-specific response)
            RpcMessage confirmationMsg = new RpcMessage();
            confirmationMsg.setType("registered");
            var data = objectMapper.createObjectNode();
            data.put("uuid", uuid);
            confirmationMsg.setData(data);
            
            connection.sendTextAndAwait(objectMapper.writeValueAsString(confirmationMsg));
            LOG.infof("Cardhost authenticated: %s", uuid);
            
        } catch (Exception e) {
            LOG.errorf(e, "Error handling cardhost authentication");
        }
    }
}
