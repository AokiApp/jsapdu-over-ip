package app.aoki.jsapdurouter.websocket;

/**
 * Message types for router WebSocket protocol
 */
public class RouterMessage {
    private String type;
    private Object data;

    public RouterMessage() {
    }

    public RouterMessage(String type, Object data) {
        this.type = type;
        this.data = data;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }

    // Message type constants
    public static final String AUTH_CHALLENGE = "auth-challenge";
    public static final String AUTH_SUCCESS = "auth-success";
    public static final String AUTH_FAILURE = "auth-failure";
    public static final String RPC_REQUEST = "rpc-request";
    public static final String RPC_RESPONSE = "rpc-response";
    public static final String RPC_EVENT = "rpc-event";
    public static final String HEARTBEAT = "heartbeat";
    public static final String ERROR = "error";
}
