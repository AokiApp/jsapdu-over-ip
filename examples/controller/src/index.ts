/**
 * Controller Browser Entry Point
 */

import { ControllerApp } from "./app.js";
import type { ApduCommand } from "./app.js";

// Global controller instance
let controller: ControllerApp | null = null;

// UI elements
let statusEl: HTMLElement | null = null;
let connectBtn: HTMLButtonElement | null = null;
let disconnectBtn: HTMLButtonElement | null = null;
let devicesEl: HTMLElement | null = null;
let apduFormEl: HTMLFormElement | null = null;
let responseEl: HTMLElement | null = null;

/**
 * Initialize UI
 */
function initUI() {
  statusEl = document.getElementById("status");
  connectBtn = document.getElementById("connectBtn") as HTMLButtonElement;
  disconnectBtn = document.getElementById("disconnectBtn") as HTMLButtonElement;
  devicesEl = document.getElementById("devices");
  apduFormEl = document.getElementById("apduForm") as HTMLFormElement;
  responseEl = document.getElementById("response");

  // Connect button
  connectBtn?.addEventListener("click", handleConnect);

  // Disconnect button
  disconnectBtn?.addEventListener("click", handleDisconnect);

  // APDU form
  apduFormEl?.addEventListener("submit", handleSendApdu);

  updateUI();
}

/**
 * Update UI state
 */
function updateUI() {
  const isConnected = controller?.isConnected() ?? false;

  if (connectBtn) connectBtn.disabled = isConnected;
  if (disconnectBtn) disconnectBtn.disabled = !isConnected;
  if (apduFormEl) {
    const inputs = apduFormEl.querySelectorAll("input, button");
    inputs.forEach((input) => {
      (input as HTMLInputElement | HTMLButtonElement).disabled = !isConnected;
    });
  }

  if (statusEl) {
    statusEl.textContent = isConnected ? "Connected" : "Disconnected";
    statusEl.className = isConnected ? "status-connected" : "status-disconnected";
  }
}

/**
 * Handle connect button
 */
async function handleConnect() {
  const routerUrl =
    (document.getElementById("routerUrl") as HTMLInputElement)?.value ||
    "ws://localhost:8080/ws/controller";
  const cardhostUuid =
    (document.getElementById("cardhostUuid") as HTMLInputElement)?.value || "";

  if (!cardhostUuid) {
    alert("Please enter cardhost UUID");
    return;
  }

  try {
    setStatus("Connecting...", "status-connecting");
    controller = new ControllerApp();
    await controller.connect({ routerUrl, cardhostUuid });
    setStatus("Connected", "status-connected");
    updateUI();
    await loadDevices();
  } catch (error) {
    setStatus(`Error: ${error}`, "status-error");
    controller = null;
    updateUI();
  }
}

/**
 * Handle disconnect button
 */
async function handleDisconnect() {
  if (!controller) return;

  try {
    await controller.disconnect();
    controller = null;
    setStatus("Disconnected", "status-disconnected");
    updateUI();
    clearDevices();
    clearResponse();
  } catch (error) {
    setStatus(`Error: ${error}`, "status-error");
  }
}

/**
 * Load devices from cardhost
 */
async function loadDevices() {
  if (!controller || !devicesEl) return;

  try {
    const devices = await controller.getDevices();
    devicesEl.innerHTML = "";

    if (devices.length === 0) {
      devicesEl.textContent = "No devices found";
      return;
    }

    devices.forEach((device) => {
      const deviceEl = document.createElement("div");
      deviceEl.className = "device";
      deviceEl.innerHTML = `
        <h3>${device.friendlyName || device.id}</h3>
        <p>ID: ${device.id}</p>
        <p>Protocol: ${device.d2cProtocol}</p>
      `;
      devicesEl.appendChild(deviceEl);
    });
  } catch (error) {
    devicesEl.textContent = `Error loading devices: ${error}`;
  }
}

/**
 * Clear devices list
 */
function clearDevices() {
  if (devicesEl) {
    devicesEl.innerHTML = "";
  }
}

/**
 * Handle APDU form submission
 */
async function handleSendApdu(event: Event) {
  event.preventDefault();

  if (!controller) return;

  const form = event.target as HTMLFormElement;
  const deviceId = (form.elements.namedItem("deviceId") as HTMLInputElement)
    .value;
  const cla = parseInt(
    (form.elements.namedItem("cla") as HTMLInputElement).value,
    16,
  );
  const ins = parseInt(
    (form.elements.namedItem("ins") as HTMLInputElement).value,
    16,
  );
  const p1 = parseInt(
    (form.elements.namedItem("p1") as HTMLInputElement).value,
    16,
  );
  const p2 = parseInt(
    (form.elements.namedItem("p2") as HTMLInputElement).value,
    16,
  );
  const dataStr = (form.elements.namedItem("data") as HTMLInputElement).value;

  let data: number[] | undefined = undefined;
  if (dataStr.trim()) {
    try {
      data = dataStr
        .trim()
        .split(/\s+/)
        .map((byte) => parseInt(byte, 16));
    } catch (error) {
      setResponse(`Error parsing data: ${error}`, true);
      return;
    }
  }

  const command: ApduCommand = { cla, ins, p1, p2, data };

  try {
    setResponse("Sending APDU...", false);
    const response = await controller.sendApdu(deviceId, command);
    const responseText = `
      SW1: 0x${response.sw1.toString(16).padStart(2, "0")}
      SW2: 0x${response.sw2.toString(16).padStart(2, "0")}
      Data: ${response.data.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
    `;
    setResponse(responseText, false);
  } catch (error) {
    setResponse(`Error: ${error}`, true);
  }
}

/**
 * Set status message
 */
function setStatus(message: string, className: string) {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = className;
  }
}

/**
 * Set response message
 */
function setResponse(message: string, isError: boolean) {
  if (responseEl) {
    responseEl.textContent = message;
    responseEl.className = isError ? "response-error" : "response-success";
  }
}

/**
 * Clear response
 */
function clearResponse() {
  if (responseEl) {
    responseEl.textContent = "";
    responseEl.className = "";
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initUI);
