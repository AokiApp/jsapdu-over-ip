package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.model.CardhostInfo;
import app.aoki.quarkuscrud.websocket.RoutingService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST API for jsapdu-over-ip router
 * Provides cardhost discovery and management per OpenAPI spec
 */
@Path("/api/cardhosts")
public class CardhostResource {
    
    @Inject
    RoutingService routingService;
    
    /**
     * List available cardhosts
     * GET /api/cardhosts
     */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> listCardhosts(
            @QueryParam("status") @DefaultValue("connected") String status) {
        
        List<CardhostInfo> allCardhosts = routingService.getAllCardhostInfo().values()
            .stream()
            .collect(Collectors.toList());
        
        // Filter by status if specified
        List<CardhostInfo> filteredCardhosts;
        if ("all".equals(status)) {
            filteredCardhosts = allCardhosts;
        } else {
            filteredCardhosts = allCardhosts.stream()
                .filter(info -> status.equals(info.getStatus()))
                .collect(Collectors.toList());
        }
        
        return Map.of(
            "cardhosts", filteredCardhosts,
            "total", filteredCardhosts.size()
        );
    }
    
    /**
     * Get cardhost details by UUID
     * GET /api/cardhosts/{uuid}
     */
    @GET
    @Path("/{uuid}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCardhost(@PathParam("uuid") String uuid) {
        CardhostInfo info = routingService.getCardhostInfo(uuid);
        
        if (info == null) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of(
                    "code", 404,
                    "message", "Cardhost not found",
                    "details", "No cardhost with UUID: " + uuid
                ))
                .build();
        }
        
        return Response.ok(info).build();
    }
}
