package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.generated.api.HealthApi;
import app.aoki.quarkuscrud.generated.model.HealthCheck200Response;
import app.aoki.quarkuscrud.generated.model.HealthCheck200ResponseChecksInner;
import app.aoki.quarkuscrud.service.CardhostService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;

/**
 * REST API implementation for health checks
 * Implements OpenAPI-generated HealthApi interface
 * 
 * This is a basic health check. For production, consider using
 * SmallRye Health at /q/health which provides more comprehensive checks.
 */
@ApplicationScoped
@Path("/api")
public class HealthApiImpl implements HealthApi {

  @Inject CardhostService cardhostService;

  @Override
  public Response healthCheck() {
    List<HealthCheck200ResponseChecksInner> checks = new ArrayList<>();

    // Check database connectivity by querying cardhost service
    boolean dbHealthy = checkDatabaseHealth();
    
    HealthCheck200ResponseChecksInner dbCheck = new HealthCheck200ResponseChecksInner();
    dbCheck.setName("database");
    dbCheck.setStatus(dbHealthy 
        ? HealthCheck200ResponseChecksInner.StatusEnum.UP 
        : HealthCheck200ResponseChecksInner.StatusEnum.DOWN);
    checks.add(dbCheck);

    // Overall status
    boolean allHealthy = checks.stream()
        .allMatch(check -> check.getStatus() == HealthCheck200ResponseChecksInner.StatusEnum.UP);

    HealthCheck200Response response = new HealthCheck200Response();
    response.setStatus(allHealthy 
        ? HealthCheck200Response.StatusEnum.UP 
        : HealthCheck200Response.StatusEnum.DOWN);
    response.setChecks(checks);

    return allHealthy 
        ? Response.ok(response).build()
        : Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(response).build();
  }

  private boolean checkDatabaseHealth() {
    try {
      // Attempt to query the database through the service
      cardhostService.getAllCardhostInfo();
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}
