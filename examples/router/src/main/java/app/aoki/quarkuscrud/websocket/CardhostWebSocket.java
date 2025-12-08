package app.aoki.quarkuscrud.websocket;

import app.aoki.quarkuscrud.crypto.CryptoUtils;
import app.aoki.quarkuscrud.generated.model.CardhostInfo;
import app.aoki.quarkuscrud.service.CardhostService;
import app.aoki.quarkuscrud.usecase.RegisterCardhostUseCase;
import app.aoki.quarkuscrud.usecase.RouteRpcMessageUseCase;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * WebSocket adapter for cardhost connections.
 *
 * <p>This is the adapter/interface layer - translates WebSocket protocol to domain operations. Thin
 * layer that delegates to use cases.
 */
@WebSocket(path = "/ws/cardhost")
public class CardhostWebSocket {
  private static final Logger LOG = Logger.getLogger(CardhostWebSocket.class);

  @Inject RegisterCardhostUseCase registerCardhostUseCase;

  @Inject RouteRpcMessageUseCase routeRpcMessageUseCase;

  @Inject CardhostService cardhostService;

  @Inject ObjectMapper objectMapper;

  // Instance variable is safe - one instance per connection in WebSockets Next
  private String cardhostUuid;
  private String pendingPublicKey;
  private String challengeNonce;
  private boolean authenticated = false;

  @OnOpen
  public void onOpen(WebSocketConnection connection) {
    LOG.infof("Cardhost connection opened: %s", connection.id());
  }

  @OnTextMessage
  public void onMessage(String message, WebSocketConnection connection) {
    try {
      RpcMessage rpcMessage = objectMapper.readValue(message, RpcMessage.class);

      // Handle authentication request (step 1)
      if ("auth-request".equals(rpcMessage.getType())) {
        handleAuthRequest(connection, rpcMessage);
        return;
      }

      // Handle authentication response (step 3)
      if ("auth-response".equals(rpcMessage.getType())) {
        handleAuthResponse(connection, rpcMessage);
        return;
      }

      // Route responses/events to controllers (only if authenticated)
      if (authenticated && cardhostUuid != null) {
        routeRpcMessageUseCase.routeToControllers(cardhostUuid, message);
      } else {
        LOG.warn("Received message from unauthenticated cardhost");
        sendAuthError(connection, "Not authenticated");
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

  /**
   * Handle authentication request (step 1 of challenge-response). Cardhost sends UUID and public
   * key, router responds with challenge.
   */
  private void handleAuthRequest(WebSocketConnection connection, RpcMessage authMessage) {
    try {
      if (authMessage.getData() == null
          || !authMessage.getData().has("uuid")
          || !authMessage.getData().has("publicKey")) {
        LOG.warn("Authentication request missing UUID or publicKey");
        sendAuthError(connection, "Missing UUID or publicKey");
        return;
      }

      String uuid = authMessage.getData().get("uuid").asText();
      String publicKey = authMessage.getData().get("publicKey").asText();

      // Store for verification later
      cardhostUuid = uuid;
      pendingPublicKey = publicKey;

      // Generate challenge nonce
      challengeNonce = CryptoUtils.generateNonce(32);

      // Send challenge
      RpcMessage challengeMsg = new RpcMessage();
      challengeMsg.setType("auth-challenge");
      var data = objectMapper.createObjectNode();
      data.put("nonce", challengeNonce);
      challengeMsg.setData(data);

      connection.sendTextAndAwait(objectMapper.writeValueAsString(challengeMsg));
      LOG.debugf("Sent authentication challenge to cardhost: %s", uuid);

    } catch (Exception e) {
      LOG.errorf(e, "Error handling auth request");
      sendAuthError(connection, "Internal error");
    }
  }

  /**
   * Handle authentication response (step 3 of challenge-response). Cardhost sends signature of
   * nonce, router verifies with public key.
   */
  private void handleAuthResponse(WebSocketConnection connection, RpcMessage authMessage) {
    try {
      if (authMessage.getData() == null || !authMessage.getData().has("signature")) {
        LOG.warn("Authentication response missing signature");
        sendAuthError(connection, "Missing signature");
        return;
      }

      if (cardhostUuid == null || pendingPublicKey == null || challengeNonce == null) {
        LOG.warn("No pending authentication for this connection");
        sendAuthError(connection, "No pending authentication");
        return;
      }

      String signature = authMessage.getData().get("signature").asText();

      // Verify signature
      boolean valid =
          CryptoUtils.verifySignature(pendingPublicKey, challengeNonce.getBytes(), signature);

      if (!valid) {
        LOG.warnf("Invalid signature from cardhost: %s", cardhostUuid);
        sendAuthError(connection, "Invalid signature");
        cardhostUuid = null;
        pendingPublicKey = null;
        challengeNonce = null;
        return;
      }

      // Authentication successful - register cardhost
      CardhostInfo info =
          registerCardhostUseCase.execute(cardhostUuid, pendingPublicKey, connection);
      authenticated = true;

      // Clear challenge data
      challengeNonce = null;
      pendingPublicKey = null;

      // Send success confirmation
      RpcMessage confirmationMsg = new RpcMessage();
      confirmationMsg.setType("registered");
      var data = objectMapper.createObjectNode();
      data.put("uuid", cardhostUuid);
      confirmationMsg.setData(data);

      connection.sendTextAndAwait(objectMapper.writeValueAsString(confirmationMsg));
      LOG.infof("Cardhost authenticated successfully: %s", cardhostUuid);

    } catch (Exception e) {
      LOG.errorf(e, "Error handling auth response");
      sendAuthError(connection, "Internal error");
    }
  }

  /** Send authentication error to cardhost. */
  private void sendAuthError(WebSocketConnection connection, String errorMessage) {
    try {
      RpcMessage errorMsg = new RpcMessage();
      errorMsg.setType("auth-failed");
      var data = objectMapper.createObjectNode();
      data.put("message", errorMessage);
      errorMsg.setData(data);

      connection.sendTextAndAwait(objectMapper.writeValueAsString(errorMsg));
    } catch (Exception e) {
      LOG.errorf(e, "Failed to send auth error message");
    }
  }
}
