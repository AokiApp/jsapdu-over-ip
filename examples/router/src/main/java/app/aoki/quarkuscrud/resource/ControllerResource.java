package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.model.ControllerSession;
import app.aoki.quarkuscrud.model.CreateSessionRequest;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * REST API for controller session management
 * Provides session creation per OpenAPI spec
 */
@Path("/api/controller")
public class ControllerResource {
    
    @Inject
    @ConfigProperty(name = "quarkus.http.host", defaultValue = "localhost")
    String host;
    
    @Inject
    @ConfigProperty(name = "quarkus.http.port", defaultValue = "8080")
    String port;
    
    /**
     * Create controller session
     * POST /api/controller/sessions
     * TODO: Add authentication before allowing session creation
     */
    @POST
    @Path("/sessions")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createControllerSession(
            @Valid CreateSessionRequest request,
            @Context UriInfo uriInfo) {
        
        // Generate session ID
        String sessionId = UUID.randomUUID().toString();
        
        // Calculate expiration (24 hours from now)
        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);
        
        // Build WebSocket URL from request context
        String scheme = uriInfo.getBaseUri().getScheme().equals("https") ? "wss" : "ws";
        String wsUrl = String.format("%s://%s:%s/ws/controller/%s", 
            scheme, host, port, sessionId);
        
        // Create session response
        ControllerSession session = new ControllerSession();
        session.setSessionId(sessionId);
        session.setName(request != null ? request.getName() : null);
        session.setWsUrl(wsUrl);
        session.setExpiresAt(expiresAt.toString());
        
        return Response.status(Response.Status.CREATED)
            .entity(session)
            .build();
    }
}
