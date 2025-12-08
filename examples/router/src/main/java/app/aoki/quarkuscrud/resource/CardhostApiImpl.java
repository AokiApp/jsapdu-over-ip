package app.aoki.quarkuscrud.resource;

import app.aoki.quarkuscrud.generated.api.CardhostApi;
import app.aoki.quarkuscrud.generated.model.CardhostInfo;
import app.aoki.quarkuscrud.generated.model.ListCardhosts200Response;
import app.aoki.quarkuscrud.service.CardhostService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * REST API implementation for cardhost management Implements OpenAPI-generated CardhostApi
 * interface
 */
@ApplicationScoped
public class CardhostApiImpl implements CardhostApi {

  @Inject CardhostService cardhostService;

  @Override
  public Response listCardhosts(String status) {
    // Validate status parameter
    if (!List.of("connected", "disconnected", "all").contains(status)) {
      return Response.status(Response.Status.BAD_REQUEST).build();
    }

    List<CardhostInfo> allCardhosts =
        cardhostService.getAllCardhostInfo().values().stream().collect(Collectors.toList());

    // Filter by status if specified
    List<CardhostInfo> filteredCardhosts;
    if ("all".equals(status)) {
      filteredCardhosts = allCardhosts;
    } else {
      filteredCardhosts =
          allCardhosts.stream()
              .filter(info -> status.equals(info.getStatus().value()))
              .collect(Collectors.toList());
    }

    ListCardhosts200Response response = new ListCardhosts200Response();
    response.setCardhosts(filteredCardhosts);
    response.setTotal(filteredCardhosts.size());

    return Response.ok(response).build();
  }

  @Override
  public Response getCardhost(UUID uuid) {
    CardhostInfo info = cardhostService.getCardhostInfo(uuid.toString());

    if (info == null) {
      return Response.status(Response.Status.NOT_FOUND).build();
    }

    return Response.ok(info).build();
  }
}
