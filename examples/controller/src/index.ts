/**
 * Controller Entry Point
 */

import { ControllerApp } from './app.js';

// Get router URL from environment or default
const ROUTER_URL = import.meta.env?.VITE_ROUTER_URL || 'http://localhost:8080';

let app: ControllerApp | null = null;

async function initialize() {
  try {
    app = new ControllerApp(ROUTER_URL);
    await app.initialize();

    // Setup UI event handlers
    setupEventHandlers();

    console.log('Controller initialized');
  } catch (error) {
    console.error('Failed to initialize:', error);
    alert('Failed to initialize controller: ' + error);
  }
}

function setupEventHandlers() {
  // Connect button
  const connectBtn = document.getElementById('connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      try {
        connectBtn.textContent = 'Connecting...';
        connectBtn.setAttribute('disabled', 'true');
        await app!.connect();
        connectBtn.textContent = 'Disconnect';
        connectBtn.removeAttribute('disabled');
        // Change to disconnect handler
        connectBtn.onclick = () => {
          app!.disconnect();
          connectBtn.textContent = 'Connect';
          connectBtn.onclick = null;
          setupEventHandlers();
        };
      } catch (error) {
        connectBtn.textContent = 'Connect';
        connectBtn.removeAttribute('disabled');
        alert('Connection failed: ' + error);
      }
    });
  }

  // Refresh cardhosts button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        await app!.refreshCardhosts();
      } catch (error) {
        alert('Failed to refresh: ' + error);
      }
    });
  }

  // Send APDU button
  const sendBtn = document.getElementById('send-apdu-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const apduInput = document.getElementById('apdu-input') as HTMLInputElement;
      if (!apduInput) return;

      const apdu = apduInput.value.trim();
      if (!apdu) {
        alert('Please enter an APDU command');
        return;
      }

      try {
        sendBtn.textContent = 'Sending...';
        sendBtn.setAttribute('disabled', 'true');
        const response = await app!.sendApdu(apdu);
        // Response is already logged by app
        sendBtn.textContent = 'Send';
        sendBtn.removeAttribute('disabled');
      } catch (error) {
        sendBtn.textContent = 'Send';
        sendBtn.removeAttribute('disabled');
        alert('Failed to send APDU: ' + error);
      }
    });
  }

  // Get device info button
  const deviceInfoBtn = document.getElementById('device-info-btn');
  if (deviceInfoBtn) {
    deviceInfoBtn.addEventListener('click', async () => {
      try {
        const info = await app!.getDeviceInfo();
        alert('Device Info:\n' + JSON.stringify(info, null, 2));
      } catch (error) {
        alert('Failed to get device info: ' + error);
      }
    });
  }

  // Clear log button
  const clearLogBtn = document.getElementById('clear-log-btn');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      const logEl = document.getElementById('log');
      if (logEl) {
        logEl.innerHTML = '';
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
