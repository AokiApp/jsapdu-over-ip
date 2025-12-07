package app.aoki.quarkuscrud.crypto;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** Scheduled tasks for security-related maintenance. */
@ApplicationScoped
public class SecurityScheduler {

  @Inject SessionTokenManager sessionTokenManager;

  /** Clean up expired session tokens every 5 minutes. */
  @Scheduled(every = "5m")
  void cleanupExpiredTokens() {
    sessionTokenManager.cleanupExpiredTokens();
  }
}
