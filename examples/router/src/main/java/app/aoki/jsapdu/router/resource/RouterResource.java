package app.aoki.jsapdu.router.resource;

import app.aoki.jsapdu.router.service.MessageRouter;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * REST API endpoints for router status and information.
 */
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
public class RouterResource {

    @Inject
    MessageRouter messageRouter;

    /**
     * Get router status including connection counts.
     */
    @GET
    @Path("/status")
    public Response getStatus() {
        Map<String, Object> status = Map.of(
            "status", "running",
            "connectedCardhosts", messageRouter.getConnectedCardhostCount(),
            "connectedControllers", messageRouter.getConnectedControllerCount()
        );
        return Response.ok(status).build();
    }

    /**
     * Simple ping endpoint for connectivity testing.
     */
    @GET
    @Path("/ping")
    public Response ping() {
        return Response.ok(Map.of("message", "pong")).build();
    }
}
