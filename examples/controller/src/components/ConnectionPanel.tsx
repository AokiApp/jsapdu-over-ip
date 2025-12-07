/**
 * ConnectionPanel - Handle connection to cardhost via router
 */

import { useState } from "react";

interface ConnectionPanelProps {
  status: string;
  onConnect: (routerUrl: string, cardhostUuid: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function ConnectionPanel({
  status,
  onConnect,
  onDisconnect,
}: ConnectionPanelProps) {
  const [routerUrl, setRouterUrl] = useState("ws://localhost:8080/ws/controller");
  const [cardhostUuid, setCardhostUuid] = useState("");

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const handleConnect = async () => {
    if (!cardhostUuid.trim()) {
      alert("Please enter cardhost UUID");
      return;
    }
    await onConnect(routerUrl, cardhostUuid);
  };

  return (
    <section className="connection-section">
      <h2>Connection</h2>
      <div className="form-group">
        <label htmlFor="routerUrl">Router URL:</label>
        <input
          type="text"
          id="routerUrl"
          value={routerUrl}
          onChange={(e) => setRouterUrl(e.target.value)}
          disabled={isConnected || isConnecting}
          placeholder="ws://localhost:8080/ws/controller"
        />
      </div>
      <div className="form-group">
        <label htmlFor="cardhostUuid">Cardhost UUID:</label>
        <input
          type="text"
          id="cardhostUuid"
          value={cardhostUuid}
          onChange={(e) => setCardhostUuid(e.target.value)}
          disabled={isConnected || isConnecting}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </div>
      <div className="button-group">
        <button
          onClick={handleConnect}
          disabled={isConnected || isConnecting}
          className="primary-btn"
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </button>
        <button
          onClick={onDisconnect}
          disabled={!isConnected}
          className="secondary-btn"
        >
          Disconnect
        </button>
      </div>
    </section>
  );
}
