package app.aoki.quarkuscrud.model;

/** Controller session model Represents a controller session for connecting to cardhosts */
public class ControllerSession {
  private String sessionId;
  private String name;
  private String wsUrl;
  private String expiresAt;

  public ControllerSession() {}

  public ControllerSession(String sessionId, String wsUrl) {
    this.sessionId = sessionId;
    this.wsUrl = wsUrl;
  }

  public String getSessionId() {
    return sessionId;
  }

  public void setSessionId(String sessionId) {
    this.sessionId = sessionId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getWsUrl() {
    return wsUrl;
  }

  public void setWsUrl(String wsUrl) {
    this.wsUrl = wsUrl;
  }

  public String getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(String expiresAt) {
    this.expiresAt = expiresAt;
  }
}
