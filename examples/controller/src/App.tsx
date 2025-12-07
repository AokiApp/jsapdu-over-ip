/**
 * Controller React App
 * Uses RemoteSmartCardPlatform with minimal React hooks
 */

import { useRef, useState } from "react";
import { RemoteSmartCardPlatform } from "@aokiapp/jsapdu-over-ip/client";
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import { RouterClientTransport } from "./router-transport";

interface DeviceInfo {
  id: string;
  friendlyName?: string;
  description?: string;
}

export function App() {
  // Minimal state - only for UI updates
  const [status, setStatus] = useState<string>("Disconnected");
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [response, setResponse] = useState<string>("");

  // Use refs for values that don't need to trigger renders
  const platformRef = useRef<RemoteSmartCardPlatform | null>(null);
  const transportRef = useRef<RouterClientTransport | null>(null);

  // Connect to cardhost via router
  const handleConnect = async () => {
    const routerUrl = (document.getElementById("routerUrl") as HTMLInputElement)?.value || "ws://localhost:8080/ws/controller";
    const cardhostUuid = (document.getElementById("cardhostUuid") as HTMLInputElement)?.value || "";

    if (!cardhostUuid) {
      setStatus("Error: Enter cardhost UUID");
      return;
    }

    try {
      setStatus("Connecting...");

      // Create transport
      const transport = new RouterClientTransport({
        routerUrl,
        cardhostUuid,
      });
      transportRef.current = transport;

      // Create remote platform
      const platform = new RemoteSmartCardPlatform(transport);
      platformRef.current = platform;

      // Initialize
      await platform.init();

      setStatus("Connected");

      // Load devices
      await loadDevices();
    } catch (error) {
      setStatus(`Error: ${error}`);
      platformRef.current = null;
      transportRef.current = null;
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (platformRef.current) {
      await platformRef.current.release();
      platformRef.current = null;
    }

    if (transportRef.current) {
      await transportRef.current.close();
      transportRef.current = null;
    }

    setStatus("Disconnected");
    setDevices([]);
    setResponse("");
  };

  // Load devices from cardhost
  const loadDevices = async () => {
    if (!platformRef.current) return;

    try {
      const deviceInfos = await platformRef.current.getDeviceInfo();
      setDevices(deviceInfos as DeviceInfo[]);
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  // Send APDU command
  const handleSendApdu = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!platformRef.current) {
      setResponse("Error: Not connected");
      return;
    }

    const form = e.target as HTMLFormElement;
    const deviceId = (form.elements.namedItem("deviceId") as HTMLInputElement).value;
    const cla = parseInt((form.elements.namedItem("cla") as HTMLInputElement).value, 16);
    const ins = parseInt((form.elements.namedItem("ins") as HTMLInputElement).value, 16);
    const p1 = parseInt((form.elements.namedItem("p1") as HTMLInputElement).value, 16);
    const p2 = parseInt((form.elements.namedItem("p2") as HTMLInputElement).value, 16);
    const dataStr = (form.elements.namedItem("data") as HTMLInputElement).value;

    try {
      setResponse("Sending...");

      // Parse data
      let data: Uint8Array = new Uint8Array(0);
      if (dataStr.trim()) {
        const bytes = dataStr.trim().split(/\s+/).map((b) => parseInt(b, 16));
        data = new Uint8Array(bytes);
      }

      // Create CommandApdu
      const command = new CommandApdu(cla, ins, p1, p2, data.length > 0 ? data : null, null);

      // Get device and card
      const device = await platformRef.current.acquireDevice(deviceId);
      if (!device) {
        setResponse("Error: Device not found");
        return;
      }

      // Check card presence
      const isPresent = await device.isCardPresent();
      if (!isPresent) {
        await device.waitForCardPresence(5000);
      }

      // Start session
      const card = await device.startSession();

      // Transmit APDU
      const apduResponse = await card.transmit(command);

      // Format response
      const responseText = `SW1: 0x${apduResponse.sw1.toString(16).padStart(2, "0")}
SW2: 0x${apduResponse.sw2.toString(16).padStart(2, "0")}
Data: ${Array.from(apduResponse.data).map((b) => b.toString(16).padStart(2, "0")).join(" ")}`;

      setResponse(responseText);

      // Release resources
      await card.release();
      await device.release();
    } catch (error) {
      setResponse(`Error: ${error}`);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>🎮 jsapdu Controller</h1>
        <div className={`status ${status.includes("Error") ? "status-error" : status === "Connected" ? "status-connected" : "status-disconnected"}`}>
          {status}
        </div>
      </header>

      <main>
        <section className="connection-section">
          <h2>Connection</h2>
          <div className="form-group">
            <label htmlFor="routerUrl">Router URL:</label>
            <input
              type="text"
              id="routerUrl"
              defaultValue="ws://localhost:8080/ws/controller"
              placeholder="ws://localhost:8080/ws/controller"
            />
          </div>
          <div className="form-group">
            <label htmlFor="cardhostUuid">Cardhost UUID:</label>
            <input
              type="text"
              id="cardhostUuid"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div className="button-group">
            <button
              onClick={handleConnect}
              disabled={status === "Connected"}
              className="primary-btn"
            >
              Connect
            </button>
            <button
              onClick={handleDisconnect}
              disabled={status !== "Connected"}
              className="secondary-btn"
            >
              Disconnect
            </button>
          </div>
        </section>

        <section className="devices-section">
          <h2>Devices</h2>
          <div className="devices-list">
            {devices.length === 0 ? (
              <p>No devices</p>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="device">
                  <h3>{device.friendlyName || device.id}</h3>
                  <p>ID: {device.id}</p>
                  {device.description && <p>{device.description}</p>}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="apdu-section">
          <h2>Send APDU</h2>
          <form onSubmit={handleSendApdu}>
            <div className="form-group">
              <label htmlFor="deviceId">Device ID:</label>
              <input
                type="text"
                id="deviceId"
                name="deviceId"
                defaultValue={devices[0]?.id || ""}
                placeholder="Device ID"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cla">CLA (hex):</label>
                <input type="text" id="cla" name="cla" defaultValue="00" maxLength={2} />
              </div>
              <div className="form-group">
                <label htmlFor="ins">INS (hex):</label>
                <input type="text" id="ins" name="ins" defaultValue="A4" maxLength={2} />
              </div>
              <div className="form-group">
                <label htmlFor="p1">P1 (hex):</label>
                <input type="text" id="p1" name="p1" defaultValue="04" maxLength={2} />
              </div>
              <div className="form-group">
                <label htmlFor="p2">P2 (hex):</label>
                <input type="text" id="p2" name="p2" defaultValue="00" maxLength={2} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="data">Data (hex, space-separated):</label>
              <input
                type="text"
                id="data"
                name="data"
                placeholder="01 02 03 04"
              />
            </div>
            <button type="submit" className="primary-btn" disabled={status !== "Connected"}>
              Send APDU
            </button>
          </form>
        </section>

        <section className="response-section">
          <h2>Response</h2>
          <pre>{response}</pre>
        </section>
      </main>
    </div>
  );
}
