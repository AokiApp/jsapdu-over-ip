package app.aoki.quarkuscrud.usecase;

import app.aoki.quarkuscrud.service.RoutingService;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * Use case for routing RPC messages between controller and cardhost.
 * 
 * Domain-focused message routing logic.
 * Protocol-agnostic - handles business rules, not transport details.
 */
@ApplicationScoped
public class RouteRpcMessageUseCase {
    private static final Logger LOG = Logger.getLogger(RouteRpcMessageUseCase.class);
    
    @Inject
    RoutingService routingService;
    
    /**
     * Route RPC message from controller to cardhost.
     * 
     * @param controllerConnection Controller's connection
     * @param message RPC message to route
     */
    public void routeToCardhost(WebSocketConnection controllerConnection, String message) {
        LOG.debugf("Routing message from controller to cardhost");
        routingService.routeToCardhost(controllerConnection, message);
    }
    
    /**
     * Route RPC message from cardhost to controller(s).
     * 
     * @param cardhostUuid Cardhost UUID
     * @param message RPC message to route
     */
    public void routeToControllers(String cardhostUuid, String message) {
        LOG.debugf("Routing message from cardhost %s to controllers", cardhostUuid);
        routingService.routeToControllers(cardhostUuid, message);
    }
}
