package app.aoki.quarkuscrud.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.Map;

/**
 * Health check endpoint per OpenAPI spec
 */
@Path("/healthz")
public class HealthResource {
    
    /**
     * Health check
     * GET /healthz
     */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> healthCheck() {
        // Simple health check - in production, check database, services, etc.
        return Map.of(
            "status", "UP",
            "checks", List.of(
                Map.of(
                    "name", "router",
                    "status", "UP"
                ),
                Map.of(
                    "name", "websocket",
                    "status", "UP"
                )
            )
        );
    }
}
