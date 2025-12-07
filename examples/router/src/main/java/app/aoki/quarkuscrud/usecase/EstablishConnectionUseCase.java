package app.aoki.quarkuscrud.usecase;

import app.aoki.quarkuscrud.service.CardhostService;
import app.aoki.quarkuscrud.service.RoutingService;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * Use case for establishing controller-to-cardhost connection.
 * 
 * Domain-focused orchestration of connection establishment.
 * Protocol-agnostic - doesn't care about transport layer.
 */
@ApplicationScoped
public class EstablishConnectionUseCase {
    private static final Logger LOG = Logger.getLogger(EstablishConnectionUseCase.class);
    
    @Inject
    CardhostService cardhostService;
    
    @Inject
    RoutingService routingService;
    
    /**
     * Establish connection from controller to target cardhost.
     * 
     * @param controllerConnection Controller's connection handle
     * @param targetCardhostUuid Target cardhost UUID
     * @return true if cardhost is available, false otherwise
     */
    public boolean execute(WebSocketConnection controllerConnection, String targetCardhostUuid) {
        LOG.infof("Establishing connection to cardhost: %s", targetCardhostUuid);
        
        // Register the routing
        routingService.registerController(controllerConnection, targetCardhostUuid);
        
        // Check availability
        boolean available = cardhostService.isConnected(targetCardhostUuid);
        
        LOG.infof("Connection established to %s (available: %b)", targetCardhostUuid, available);
        return available;
    }
}
