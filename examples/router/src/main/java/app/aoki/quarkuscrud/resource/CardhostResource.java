package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.websocket.RoutingService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST API for jsapdu-over-ip router
 * Provides cardhost discovery and status
 */
@Path("/api/cardhosts")
public class CardhostResource {
    
    @Inject
    RoutingService routingService;
    
    /**
     * List connected cardhosts
     */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> listCardhosts() {
        List<String> connectedUuids = routingService.getConnectedCardhosts()
            .keySet()
            .stream()
            .collect(Collectors.toList());
        
        return Map.of(
            "cardhosts", connectedUuids,
            "total", connectedUuids.size()
        );
    }
}
