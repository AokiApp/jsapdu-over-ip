package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.crypto.SessionTokenManager;
import app.aoki.quarkuscrud.generated.api.ControllerApi;
import app.aoki.quarkuscrud.generated.model.ControllerSession;
import app.aoki.quarkuscrud.generated.model.CreateSessionRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * REST API implementation for controller session management
 * Implements OpenAPI-generated ControllerApi interface
 */
@ApplicationScoped
@Path("/api")
public class ControllerResource implements ControllerApi {

  @Inject SessionTokenManager sessionTokenManager;

  @Inject
  @ConfigProperty(name = "quarkus.http.host", defaultValue = "localhost")
  String host;

  @Inject
  @ConfigProperty(name = "quarkus.http.port", defaultValue = "8080")
  String port;

  @Context UriInfo uriInfo;

  @Override
  public Response createControllerSession(CreateSessionRequest request) {
    // Generate session ID
    UUID sessionId = UUID.randomUUID();

    // Generate single-use session token for WebSocket upgrade
    String sessionToken = sessionTokenManager.generateToken(sessionId.toString());

    // Calculate expiration (24 hours from now)
    OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(24);

    // Build WebSocket URL with session token as query parameter
    String scheme = uriInfo.getBaseUri().getScheme().equals("https") ? "wss" : "ws";
    String wsUrl =
        String.format(
            "%s://%s:%s/ws/controller/%s?token=%s", scheme, host, port, sessionId, sessionToken);

    // Create session response
    ControllerSession session = new ControllerSession();
    session.setSessionId(sessionId);
    session.setName(request != null ? request.getName() : null);
    session.setWsUrl(wsUrl);
    session.setExpiresAt(expiresAt);

    return Response.status(Response.Status.CREATED).entity(session).build();
  }
}
