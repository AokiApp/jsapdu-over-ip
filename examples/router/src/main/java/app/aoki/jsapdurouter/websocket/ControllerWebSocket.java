package app.aoki.jsapdurouter.websocket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * WebSocket endpoint for controller connections
 * Handles controller registration and message routing to cardhosts
 */
@ApplicationScoped
@ServerEndpoint("/ws/controller")
public class ControllerWebSocket {

    @Inject
    MessageRouter messageRouter;

    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // Store controller session info
    private final java.util.Map<String, String> sessionToId = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, String> sessionToTarget = new java.util.concurrent.ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session) {
        System.out.println("[ControllerWebSocket] New connection: " + session.getId());
        
        try {
            // Send authentication challenge
            RouterMessage challenge = new RouterMessage(
                RouterMessage.AUTH_CHALLENGE,
                java.util.Map.of("challenge", UUID.randomUUID().toString())
            );
            session.getBasicRemote().sendText(objectMapper.writeValueAsString(challenge));
        } catch (Exception e) {
            System.err.println("[ControllerWebSocket] Error sending challenge: " + e.getMessage());
        }
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String type = node.get("type").asText();
            
            switch (type) {
                case RouterMessage.AUTH_SUCCESS: {
                    // Extract target cardhost UUID
                    JsonNode data = node.get("data");
                    String targetUuid = data.get("target").asText();
                    
                    // Generate controller session ID
                    String controllerSessionId = UUID.randomUUID().toString();
                    
                    // Register controller
                    sessionToId.put(session.getId(), controllerSessionId);
                    sessionToTarget.put(session.getId(), targetUuid);
                    messageRouter.registerController(controllerSessionId, targetUuid, session);
                    
                    // Check if target cardhost is available
                    if (!messageRouter.isCardhostConnected(targetUuid)) {
                        RouterMessage error = new RouterMessage(
                            RouterMessage.ERROR,
                            java.util.Map.of("message", "Target cardhost not connected: " + targetUuid)
                        );
                        session.getBasicRemote().sendText(objectMapper.writeValueAsString(error));
                        return;
                    }
                    
                    // Send success response
                    RouterMessage success = new RouterMessage(RouterMessage.AUTH_SUCCESS, null);
                    session.getBasicRemote().sendText(objectMapper.writeValueAsString(success));
                    break;
                }
                
                case RouterMessage.RPC_REQUEST: {
                    // Route request to cardhost
                    JsonNode data = node.get("data");
                    String targetUuid = data.get("target").asText();
                    JsonNode request = data.get("request");
                    
                    // Create message to send to cardhost
                    RouterMessage cardhostMessage = new RouterMessage(RouterMessage.RPC_REQUEST, request);
                    String cardhostMessageStr = objectMapper.writeValueAsString(cardhostMessage);
                    
                    // Route to cardhost
                    boolean routed = messageRouter.routeToCardhost(targetUuid, cardhostMessageStr);
                    
                    if (!routed) {
                        // Send error back to controller
                        RouterMessage error = new RouterMessage(
                            RouterMessage.ERROR,
                            java.util.Map.of("message", "Failed to route to cardhost: " + targetUuid)
                        );
                        session.getBasicRemote().sendText(objectMapper.writeValueAsString(error));
                    }
                    break;
                }
                
                case RouterMessage.HEARTBEAT: {
                    // Respond to heartbeat
                    session.getBasicRemote().sendText(message);
                    break;
                }
                
                default:
                    System.err.println("[ControllerWebSocket] Unknown message type: " + type);
            }
        } catch (Exception e) {
            System.err.println("[ControllerWebSocket] Error processing message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @OnClose
    public void onClose(Session session) {
        String controllerSessionId = sessionToId.remove(session.getId());
        sessionToTarget.remove(session.getId());
        if (controllerSessionId != null) {
            messageRouter.unregisterController(controllerSessionId);
        }
        System.out.println("[ControllerWebSocket] Connection closed: " + session.getId());
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("[ControllerWebSocket] Error: " + throwable.getMessage());
    }
}
