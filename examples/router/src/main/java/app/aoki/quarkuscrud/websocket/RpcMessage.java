package app.aoki.quarkuscrud.websocket;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * RPC Message format for jsapdu-over-ip routing Messages are passed through without interpretation
 */
public class RpcMessage {
  @JsonProperty("type")
  private String type;

  @JsonProperty("data")
  private JsonNode data;

  public RpcMessage() {}

  public RpcMessage(String type, JsonNode data) {
    this.type = type;
    this.data = data;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public JsonNode getData() {
    return data;
  }

  public void setData(JsonNode data) {
    this.data = data;
  }
}
