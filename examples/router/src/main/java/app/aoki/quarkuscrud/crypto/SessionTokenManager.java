package app.aoki.quarkuscrud.crypto;

import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages session tokens for HTTP to WebSocket upgrade.
 * 
 * Session tokens are single-use, time-limited tokens that allow a controller
 * to upgrade from REST API to WebSocket connection securely.
 */
@ApplicationScoped
public class SessionTokenManager {
    private static final Logger LOG = Logger.getLogger(SessionTokenManager.class);
    
    private static final int TOKEN_LENGTH_BYTES = 32; // 256 bits
    private static final long TOKEN_VALIDITY_MINUTES = 5; // Tokens expire after 5 minutes
    
    private final SecureRandom random = new SecureRandom();
    
    // Token -> SessionInfo
    private final Map<String, SessionInfo> tokens = new ConcurrentHashMap<>();
    
    /**
     * Generate a new session token for a controller session.
     * 
     * @param sessionId The controller session ID
     * @return The generated token (base64-encoded)
     */
    public String generateToken(String sessionId) {
        byte[] tokenBytes = new byte[TOKEN_LENGTH_BYTES];
        random.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        
        SessionInfo info = new SessionInfo(
            sessionId,
            Instant.now().plus(TOKEN_VALIDITY_MINUTES, ChronoUnit.MINUTES)
        );
        tokens.put(token, info);
        
        LOG.debugf("Generated session token for session %s", sessionId);
        return token;
    }
    
    /**
     * Validate and consume a session token.
     * 
     * Tokens are single-use - once validated, they are removed and cannot be reused.
     * 
     * @param token The token to validate
     * @return The session ID if token is valid, null otherwise
     */
    public String validateAndConsumeToken(String token) {
        SessionInfo info = tokens.remove(token);
        
        if (info == null) {
            LOG.warnf("Invalid or already used token");
            return null;
        }
        
        if (Instant.now().isAfter(info.expiresAt)) {
            LOG.warnf("Expired token for session %s", info.sessionId);
            return null;
        }
        
        LOG.debugf("Valid token consumed for session %s", info.sessionId);
        return info.sessionId;
    }
    
    /**
     * Clean up expired tokens periodically.
     * 
     * Should be called by a scheduled task.
     */
    public void cleanupExpiredTokens() {
        Instant now = Instant.now();
        int initialSize = tokens.size();
        
        tokens.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt));
        
        int removed = initialSize - tokens.size();
        if (removed > 0) {
            LOG.infof("Cleaned up %d expired session tokens", removed);
        }
    }
    
    /**
     * Get the number of active tokens.
     * 
     * @return Number of tokens currently stored
     */
    public int getActiveTokenCount() {
        return tokens.size();
    }
    
    /**
     * Information about a session token.
     */
    private record SessionInfo(String sessionId, Instant expiresAt) {}
}
