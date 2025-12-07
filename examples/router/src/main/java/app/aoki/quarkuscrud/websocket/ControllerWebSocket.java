package app.aoki.quarkuscrud.websocket;

import app.aoki.quarkuscrud.crypto.SessionTokenManager;
import app.aoki.quarkuscrud.service.CardhostService;
import app.aoki.quarkuscrud.usecase.EstablishConnectionUseCase;
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
 * WebSocket adapter for controller connections.
 * 
 * This is the adapter/interface layer - translates WebSocket protocol to domain operations.
 * Thin layer that delegates to use cases.
 */
@WebSocket(path = "/ws/controller/{sessionId}")
public class ControllerWebSocket {
    private static final Logger LOG = Logger.getLogger(ControllerWebSocket.class);
    
    @Inject
    SessionTokenManager sessionTokenManager;
    
    @Inject
    EstablishConnectionUseCase establishConnectionUseCase;
    
    @Inject
    RouteRpcMessageUseCase routeRpcMessageUseCase;
    
    @Inject
    CardhostService cardhostService;
    
    @Inject
    ObjectMapper objectMapper;
    
    // Instance variable is safe - one instance per connection in WebSockets Next
    private String targetCardhostUuid;
    private boolean authenticated = false;
    
    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        // Extract session ID and token from handshake
        String sessionId = connection.pathParam("sessionId");
        String queryString = connection.handshakeRequest().query();
        String token = extractQueryParam(queryString, "token");
        
        if (token == null) {
            LOG.warnf("Controller connection missing session token: %s", connection.id());
            connection.close();
            return;
        }
        
        // Validate and consume token
        String validatedSessionId = sessionTokenManager.validateAndConsumeToken(token);
        if (validatedSessionId == null || !validatedSessionId.equals(sessionId)) {
            LOG.warnf("Invalid session token for connection: %s", connection.id());
            connection.close();
            return;
        }
        
        authenticated = true;
        LOG.infof("Controller connection authenticated: %s (session: %s)", connection.id(), sessionId);
    }
    
    /**
     * Extract a query parameter from a query string.
     * Simple implementation for token extraction.
     */
    private String extractQueryParam(String queryString, String paramName) {
        if (queryString == null || queryString.isEmpty()) {
            return null;
        }
        
        String[] pairs = queryString.split("&");
        for (String pair : pairs) {
            String[] keyValue = pair.split("=", 2);
            if (keyValue.length == 2 && paramName.equals(keyValue[0])) {
                return keyValue[1];
            }
        }
        return null;
    }
    
    @OnTextMessage
    public void onMessage(String message, WebSocketConnection connection) {
        // Check authentication
        if (!authenticated) {
            LOG.warnf("Unauthenticated controller attempting to send message");
            sendError(connection, "Not authenticated");
            connection.close();
            return;
        }
        
        try {
            RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);
            
            // Handle connection request
            if ("connect".equals(rpcMessage.getType())) {
                handleConnectionRequest(connection, rpcMessage);
                return;
            }
            
            // Route RPC requests to cardhost
            if (targetCardhostUuid != null) {
                routeRpcMessageUseCase.routeToCardhost(connection, message);
            } else {
                sendError(connection, "Not connected to cardhost");
            }
            
        } catch (Exception e) {
            LOG.errorf(e, "Error processing controller message");
        }
    }
    
    @OnClose
    public void onClose(WebSocketConnection connection) {
        if (targetCardhostUuid != null) {
            cardhostService.unregisterCardhost(targetCardhostUuid);
        }
        LOG.infof("Controller connection closed: %s", connection.id());
    }
    
    private void handleConnectionRequest(WebSocketConnection connection, RpcMessage connectMessage) {
        try {
            if (connectMessage.getData() == null || !connectMessage.getData().has("cardhostUuid")) {
                LOG.warn("Connection message missing cardhost UUID");
                return;
            }
            
            String cardhostUuid = connectMessage.getData().get("cardhostUuid").asText();
            
            // Execute use case
            boolean available = establishConnectionUseCase.execute(connection, cardhostUuid);
            targetCardhostUuid = cardhostUuid;
            
            // Send confirmation (WebSocket-specific response)
            RpcMessage connectedMsg = new RpcMessage();
            connectedMsg.setType("connected");
            var data = objectMapper.createObjectNode();
            data.put("cardhostUuid", cardhostUuid);
            data.put("available", available);
            connectedMsg.setData(data);
            
            connection.sendTextAndAwait(objectMapper.writeValueAsString(connectedMsg));
            LOG.infof("Controller connected to cardhost: %s (available: %b)", cardhostUuid, available);
            
        } catch (Exception e) {
            LOG.errorf(e, "Error handling connection request");
        }
    }
    
    private void sendError(WebSocketConnection connection, String errorMessage) {
        try {
            RpcMessage errorMsg = new RpcMessage();
            errorMsg.setType("error");
            var data = objectMapper.createObjectNode();
            data.put("message", errorMessage);
            errorMsg.setData(data);
            
            connection.sendTextAndAwait(objectMapper.writeValueAsString(errorMsg));
        } catch (Exception e) {
            LOG.errorf(e, "Failed to send error message");
        }
    }
}
