package app.aoki.quarkuscrud.usecase;

import app.aoki.quarkuscrud.model.CardhostInfo;
import app.aoki.quarkuscrud.service.CardhostService;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * Use case for cardhost registration and authentication.
 *
 * <p>Domain-focused orchestration of cardhost lifecycle operations. Protocol-agnostic - doesn't
 * care if it's WebSocket, REST, gRPC, etc.
 */
@ApplicationScoped
public class RegisterCardhostUseCase {
  private static final Logger LOG = Logger.getLogger(RegisterCardhostUseCase.class);

  @Inject CardhostService cardhostService;

  /**
   * Register a cardhost with authentication credentials.
   *
   * @param uuid Cardhost UUID
   * @param publicKey Public key for authentication
   * @param connection Connection handle (transport-agnostic)
   * @return Registered cardhost info
   */
  public CardhostInfo execute(String uuid, String publicKey, WebSocketConnection connection) {
    LOG.infof("Registering cardhost: %s", uuid);

    // TODO: Verify public key signature in production
    // For now, simplified authentication

    CardhostInfo info = cardhostService.registerCardhost(uuid, connection, publicKey);

    LOG.infof("Cardhost registered successfully: %s", uuid);
    return info;
  }
}
