/**
 * Controller React App
 * Uses CardManager to separate jsapdu-over-ip logic from UI
 * Broken into smaller, focused components
 */

import { useEffect, useState } from "react";
import { CardManager, type ApduCommand } from "./CardManager";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { DeviceList } from "./components/DeviceList";
import { ApduForm } from "./components/ApduForm";
import { ResponseDisplay } from "./components/ResponseDisplay";

// Create manager instance (singleton pattern)
const manager = new CardManager();

export function App() {
  // Manager state (updated by manager)
  const [state, setState] = useState(manager.getState());
  const [response, setResponse] = useState<string>("");

  // Subscribe to manager state changes
  useEffect(() => {
    const unsubscribe = manager.addListener(setState);
    return unsubscribe;
  }, []);

  // Connection handlers
  const handleConnect = async (routerUrl: string, cardhostUuid: string) => {
    try {
      await manager.connect({ routerUrl, cardhostUuid });
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await manager.disconnect();
      setResponse("");
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  // APDU handler
  const handleSendApdu = async (deviceId: string, command: ApduCommand) => {
    try {
      setResponse("Sending...");
      const apduResponse = await manager.sendApdu(deviceId, command);

      const responseText = `SW1: 0x${apduResponse.sw1.toString(16).padStart(2, "0")}
SW2: 0x${apduResponse.sw2.toString(16).padStart(2, "0")}
Data: ${Array.from(apduResponse.data).map((b) => b.toString(16).padStart(2, "0")).join(" ")}`;

      setResponse(responseText);
    } catch (error) {
      setResponse(`Error: ${error}`);
    }
  };

  const statusClass =
    state.status === "error"
      ? "status-error"
      : state.status === "connected"
      ? "status-connected"
      : "status-disconnected";

  const displayStatus = state.error
    ? `Error: ${state.error}`
    : state.status.charAt(0).toUpperCase() + state.status.slice(1);

  return (
    <div className="container">
      <header>
        <h1>🎮 jsapdu Controller</h1>
        <div className={`status ${statusClass}`}>{displayStatus}</div>
      </header>

      <main>
        <ConnectionPanel
          status={state.status}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

        <DeviceList devices={state.devices} />

        <ApduForm
          devices={state.devices}
          disabled={state.status !== "connected"}
          onSend={handleSendApdu}
        />

        <ResponseDisplay response={response} />
      </main>
    </div>
  );
}
