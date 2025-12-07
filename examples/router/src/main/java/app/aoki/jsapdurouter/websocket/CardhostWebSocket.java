package app.aoki.jsapdurouter.websocket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * WebSocket endpoint for cardhost connections
 * Handles cardhost registration, authentication, and message routing
 */
@ApplicationScoped
@ServerEndpoint("/ws/cardhost")
public class CardhostWebSocket {

    @Inject
    MessageRouter messageRouter;

    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // Store cardhost UUID per session
    private final java.util.Map<String, String> sessionToUuid = new java.util.concurrent.ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session) {
        System.out.println("[CardhostWebSocket] New connection: " + session.getId());
        
        try {
            // Send authentication challenge
            RouterMessage challenge = new RouterMessage(
                RouterMessage.AUTH_CHALLENGE,
                java.util.Map.of("challenge", UUID.randomUUID().toString())
            );
            session.getBasicRemote().sendText(objectMapper.writeValueAsString(challenge));
        } catch (Exception e) {
            System.err.println("[CardhostWebSocket] Error sending challenge: " + e.getMessage());
        }
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String type = node.get("type").asText();
            
            switch (type) {
                case RouterMessage.AUTH_SUCCESS: {
                    // Extract cardhost UUID and register
                    JsonNode data = node.get("data");
                    String uuid = data.get("uuid").asText();
                    
                    // TODO: Verify signature with public key
                    // For now, accept if UUID is provided
                    
                    sessionToUuid.put(session.getId(), uuid);
                    messageRouter.registerCardhost(uuid, session);
                    
                    // Send success response
                    RouterMessage success = new RouterMessage(RouterMessage.AUTH_SUCCESS, null);
                    session.getBasicRemote().sendText(objectMapper.writeValueAsString(success));
                    break;
                }
                
                case RouterMessage.RPC_RESPONSE: {
                    // Route response back to controller using request ID
                    JsonNode data = node.get("data");
                    String requestId = data.get("id").asText();
                    
                    // Use MessageRouter to route response to correct controller
                    boolean routed = messageRouter.routeResponseToController(requestId, message);
                    if (!routed) {
                        System.err.println("[CardhostWebSocket] Failed to route response for request: " + requestId);
                    }
                    break;
                }
                
                case RouterMessage.RPC_EVENT: {
                    // Broadcast events to all controllers connected to this cardhost
                    String cardhostUuid = sessionToUuid.get(session.getId());
                    if (cardhostUuid != null) {
                        messageRouter.broadcastEventToControllers(cardhostUuid, message);
                    }
                    break;
                }
                
                case RouterMessage.HEARTBEAT: {
                    // Respond to heartbeat
                    session.getBasicRemote().sendText(message);
                    break;
                }
                
                default:
                    System.err.println("[CardhostWebSocket] Unknown message type: " + type);
            }
        } catch (Exception e) {
            System.err.println("[CardhostWebSocket] Error processing message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @OnClose
    public void onClose(Session session) {
        String uuid = sessionToUuid.remove(session.getId());
        if (uuid != null) {
            messageRouter.unregisterCardhost(uuid);
        }
        System.out.println("[CardhostWebSocket] Connection closed: " + session.getId());
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("[CardhostWebSocket] Error: " + throwable.getMessage());
    }
}
