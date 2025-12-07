/**
 * Main Controller Application
 *
 * Manages UI state and coordinates between API client, WebSocket, and crypto
 */

import { ApiClient, type CardhostInfo } from './api-client.js';
import { WebSocketClient, ConnectionState, type EventMessage } from './websocket-client.js';
import { loadOrGenerateKeyPair } from './crypto.js';

export class ControllerApp {
  private apiClient: ApiClient;
  private wsClient: WebSocketClient | null = null;
  private keyPair: { publicKeyBase64: string; privateKeyBase64: string } | null = null;
  private selectedCardhost: string | null = null;
  private connected = false;

  constructor(private routerUrl: string) {
    this.apiClient = new ApiClient(routerUrl);
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    // Load or generate key pair
    const keys = await loadOrGenerateKeyPair();
    this.keyPair = {
      publicKeyBase64: keys.publicKeyBase64,
      privateKeyBase64: keys.privateKeyBase64,
    };

    this.updateStatus('Initialized with key pair');
    this.displayPublicKey(keys.publicKeyBase64);
  }

  /**
   * Connect to router
   */
  async connect(): Promise<void> {
    if (this.connected || !this.keyPair) {
      return;
    }

    try {
      this.updateStatus('Creating session...');

      // Create session
      const session = await this.apiClient.createSession(
        this.keyPair.publicKeyBase64
      );

      this.updateStatus('Connecting to WebSocket...');

      // Connect to WebSocket
      this.wsClient = new WebSocketClient({
        url: session.wsUrl,
        onConnected: () => {
          this.connected = true;
          this.updateStatus('Connected to router');
          this.updateConnectionState(ConnectionState.Connected);
        },
        onDisconnected: () => {
          this.connected = false;
          this.updateStatus('Disconnected from router');
          this.updateConnectionState(ConnectionState.Disconnected);
        },
        onEvent: (event: EventMessage) => {
          this.handleEvent(event);
        },
      });

      await this.wsClient.connect();
    } catch (error) {
      this.updateStatus(`Connection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from router
   */
  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
    this.connected = false;
    this.updateStatus('Disconnected');
  }

  /**
   * Refresh list of cardhosts
   */
  async refreshCardhosts(): Promise<CardhostInfo[]> {
    try {
      this.updateStatus('Refreshing cardhosts...');
      const cardhosts = await this.apiClient.listCardhosts();
      this.displayCardhosts(cardhosts);
      this.updateStatus(`Found ${cardhosts.length} cardhost(s)`);
      return cardhosts;
    } catch (error) {
      this.updateStatus(`Failed to refresh: ${error}`);
      throw error;
    }
  }

  /**
   * Select a cardhost for APDU operations
   */
  selectCardhost(uuid: string): void {
    this.selectedCardhost = uuid;
    this.updateStatus(`Selected cardhost: ${uuid.substring(0, 8)}...`);
  }

  /**
   * Send APDU command to selected cardhost
   */
  async sendApdu(apduHex: string): Promise<string> {
    if (!this.wsClient || !this.selectedCardhost) {
      throw new Error('Not connected or no cardhost selected');
    }

    try {
      // Parse hex string to byte array
      const apdu = this.hexToBytes(apduHex);

      // Send transmit request
      const result = await this.wsClient.sendRequest(
        'card.transmit',
        [Array.from(apdu)],
        this.selectedCardhost
      );

      // Convert response back to hex
      const response = result as { response: number[] };
      const responseHex = this.bytesToHex(response.response);

      this.addToLog('TX', apduHex);
      this.addToLog('RX', responseHex);

      return responseHex;
    } catch (error) {
      this.addToLog('ERROR', String(error));
      throw error;
    }
  }

  /**
   * Get device info from selected cardhost
   */
  async getDeviceInfo(): Promise<unknown> {
    if (!this.wsClient || !this.selectedCardhost) {
      throw new Error('Not connected or no cardhost selected');
    }

    return await this.wsClient.sendRequest(
      'platform.getDeviceInfo',
      [],
      this.selectedCardhost
    );
  }

  // UI update methods (to be implemented by actual UI)

  private updateStatus(message: string): void {
    console.log('Status:', message);
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  private updateConnectionState(state: ConnectionState): void {
    console.log('Connection state:', state);
    const stateEl = document.getElementById('connection-state');
    if (stateEl) {
      stateEl.textContent = state;
      stateEl.className = `connection-${state}`;
    }
  }

  private displayPublicKey(publicKey: string): void {
    const keyEl = document.getElementById('public-key');
    if (keyEl) {
      keyEl.textContent = publicKey.substring(0, 32) + '...';
      keyEl.title = publicKey;
    }
  }

  private displayCardhosts(cardhosts: CardhostInfo[]): void {
    const listEl = document.getElementById('cardhost-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (cardhosts.length === 0) {
      listEl.innerHTML = '<div class="no-cardhosts">No cardhosts available</div>';
      return;
    }

    cardhosts.forEach((cardhost) => {
      const item = document.createElement('div');
      item.className = 'cardhost-item';
      item.innerHTML = `
        <div class="cardhost-info">
          <div class="cardhost-name">${cardhost.name || 'Unnamed'}</div>
          <div class="cardhost-uuid">${cardhost.uuid}</div>
          <div class="cardhost-status status-${cardhost.status}">${cardhost.status}</div>
        </div>
        <button class="select-btn" data-uuid="${cardhost.uuid}">Select</button>
      `;

      const selectBtn = item.querySelector('.select-btn');
      if (selectBtn) {
        selectBtn.addEventListener('click', () => {
          this.selectCardhost(cardhost.uuid);
          // Visual feedback
          document.querySelectorAll('.cardhost-item').forEach((el) => {
            el.classList.remove('selected');
          });
          item.classList.add('selected');
        });
      }

      listEl.appendChild(item);
    });
  }

  private addToLog(type: string, message: string): void {
    const logEl = document.getElementById('log');
    if (!logEl) return;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type.toLowerCase()}`;
    entry.innerHTML = `
      <span class="log-time">${new Date().toLocaleTimeString()}</span>
      <span class="log-type">${type}</span>
      <span class="log-message">${message}</span>
    `;

    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  private handleEvent(event: EventMessage): void {
    console.log('Event received:', event);
    this.addToLog('EVENT', `${event.event} from ${event.sourceCardhost}`);
  }

  private hexToBytes(hex: string): Uint8Array {
    // Remove spaces and convert to bytes
    hex = hex.replace(/\s/g, '');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }
}
