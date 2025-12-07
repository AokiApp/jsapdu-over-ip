package app.aoki.jsapdu.router.health;

import app.aoki.jsapdu.router.service.MessageRouter;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

/**
 * Readiness health check for the router.
 * Indicates if the router is ready to accept connections.
 */
@Readiness
@ApplicationScoped
public class RouterReadinessCheck implements HealthCheck {

    @Inject
    MessageRouter messageRouter;

    @Override
    public HealthCheckResponse call() {
        // Simple check - router is always ready if it's running
        return HealthCheckResponse
                .named("Router readiness check")
                .up()
                .withData("cardhosts", messageRouter.getConnectedCardhostCount())
                .withData("controllers", messageRouter.getConnectedControllerCount())
                .build();
    }
}
