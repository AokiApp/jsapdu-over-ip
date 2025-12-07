package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.model.ControllerSession;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

/**
 * REST API for controller session management
 * Provides session creation per OpenAPI spec
 */
@Path("/api/controller")
public class ControllerResource {
    
    /**
     * Create controller session
     * POST /api/controller/sessions
     */
    @POST
    @Path("/sessions")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createControllerSession(Map<String, Object> request) {
        // Generate session ID
        String sessionId = UUID.randomUUID().toString();
        
        // Get optional session name
        String name = request != null && request.containsKey("name") 
            ? (String) request.get("name") 
            : null;
        
        // Calculate expiration (24 hours from now)
        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);
        
        // Create session response
        ControllerSession session = new ControllerSession();
        session.setSessionId(sessionId);
        session.setName(name);
        session.setWsUrl("ws://localhost:8080/ws/controller/" + sessionId);
        session.setExpiresAt(expiresAt.toString());
        
        return Response.status(Response.Status.CREATED)
            .entity(session)
            .build();
    }
}
