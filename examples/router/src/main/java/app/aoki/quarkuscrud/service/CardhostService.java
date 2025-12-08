package app.aoki.quarkuscrud.service;

import app.aoki.quarkuscrud.entity.Cardhost;
import app.aoki.quarkuscrud.mapper.CardhostMapper;
import app.aoki.quarkuscrud.generated.model.CardhostInfo;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * Service for managing cardhost connections and metadata.
 *
 * <p>Uses MyBatis for database persistence and in-memory map for active WebSocket connections.
 * Implements persistent storage per documentation requirements.
 */
@ApplicationScoped
public class CardhostService {
  private static final Logger LOG = Logger.getLogger(CardhostService.class);

  @Inject MeterRegistry meterRegistry;
  @Inject CardhostMapper cardhostMapper;

  // Active WebSocket connections: UUID -> Connection (in-memory only)
  private final Map<String, WebSocketConnection> connections = new ConcurrentHashMap<>();

  public CardhostService() {
    // Default constructor for CDI
  }

  /** Initialize metrics gauges after injection. */
  @jakarta.annotation.PostConstruct
  void initializeMetrics() {
    Gauge.builder("router.cardhosts.connected", connections, Map::size)
        .description("Number of currently connected cardhosts")
        .register(meterRegistry);

    Gauge.builder("router.cardhosts.total", () -> cardhostMapper.findAll().size())
        .description("Total number of known cardhosts")
        .register(meterRegistry);
  }

  /**
   * Register a new cardhost connection.
   *
   * @param uuid Cardhost UUID
   * @param connection WebSocket connection
   * @param publicKey Public key for authentication
   * @return The registered CardhostInfo
   */
  @Transactional
  public CardhostInfo registerCardhost(
      String uuid, WebSocketConnection connection, String publicKey) {
    connections.put(uuid, connection);

    // Find or create cardhost entity in database
    Cardhost entity = cardhostMapper.findByUuid(uuid).orElse(null);
    if (entity == null) {
      entity = new Cardhost(uuid, publicKey);
      cardhostMapper.insert(entity);
    } else {
      entity.setStatus("connected");
      entity.setLastSeen(Instant.now());
      entity.setConnectionCount(entity.getConnectionCount() + 1);
      entity.setUpdatedAt(Instant.now());
      cardhostMapper.update(entity);
    }

    Counter.builder("router.cardhosts.registered")
        .description("Total number of cardhost registrations")
        .register(meterRegistry)
        .increment();

    LOG.infof("Cardhost registered: %s (total connections: %d)", uuid, entity.getConnectionCount());
    return toCardhostInfo(entity);
  }

  /**
   * Unregister a cardhost connection.
   *
   * @param uuid Cardhost UUID
   */
  @Transactional
  public void unregisterCardhost(String uuid) {
    connections.remove(uuid);

    // Update database status
    cardhostMapper
        .findByUuid(uuid)
        .ifPresent(
            entity -> {
              entity.setStatus("disconnected");
              entity.setLastSeen(Instant.now());
              entity.setUpdatedAt(Instant.now());
              cardhostMapper.update(entity);
            });

    Counter.builder("router.cardhosts.disconnected")
        .description("Total number of cardhost disconnections")
        .register(meterRegistry)
        .increment();

    LOG.infof("Cardhost unregistered: %s", uuid);
  }

  /**
   * Get cardhost information by UUID.
   *
   * @param uuid Cardhost UUID
   * @return CardhostInfo or null if not found
   */
  public CardhostInfo getCardhostInfo(String uuid) {
    return cardhostMapper.findByUuid(uuid).map(this::toCardhostInfo).orElse(null);
  }

  /**
   * Get all cardhost information (from database).
   *
   * @return Map of UUID to CardhostInfo
   */
  public Map<String, CardhostInfo> getAllCardhostInfo() {
    return cardhostMapper.findAll().stream()
        .collect(Collectors.toMap(Cardhost::getUuid, this::toCardhostInfo));
  }

  /**
   * Get WebSocket connection for a cardhost.
   *
   * @param uuid Cardhost UUID
   * @return WebSocketConnection or null if not connected
   */
  public WebSocketConnection getConnection(String uuid) {
    return connections.get(uuid);
  }

  /**
   * Check if cardhost is currently connected.
   *
   * @param uuid Cardhost UUID
   * @return true if connected and connection is open
   */
  public boolean isConnected(String uuid) {
    WebSocketConnection connection = connections.get(uuid);
    return connection != null && connection.isOpen();
  }

  /** Convert Cardhost entity to CardhostInfo model */
  private CardhostInfo toCardhostInfo(Cardhost entity) {
    CardhostInfo info = new CardhostInfo();
    info.setUuid(UUID.fromString(entity.getUuid()));
    info.setPublicKey(entity.getPublicKey());
    info.setName(entity.getName());
    info.setStatus(
        "connected".equals(entity.getStatus())
            ? CardhostInfo.StatusEnum.CONNECTED
            : CardhostInfo.StatusEnum.DISCONNECTED);
    info.setConnectedAt(
        entity.getFirstSeen() != null
            ? entity.getFirstSeen().atOffset(ZoneOffset.UTC)
            : null);
    info.setLastHeartbeat(
        entity.getLastSeen() != null ? entity.getLastSeen().atOffset(ZoneOffset.UTC) : null);
    return info;
  }
}
