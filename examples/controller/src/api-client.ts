/**
 * REST API Client for interacting with router HTTP API
 */

export interface CardhostInfo {
  uuid: string;
  name?: string;
  status: 'connected' | 'disconnected';
  connectedAt: string;
  lastHeartbeat?: string;
  capabilities?: {
    readers: number;
    supportedProtocols?: string[];
  };
}

export interface ControllerSession {
  sessionId: string;
  wsUrl: string;
  expiresAt: string;
}

export class ApiClient {
  constructor(private baseUrl: string) {}

  /**
   * List all available cardhosts
   */
  async listCardhosts(): Promise<CardhostInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/cardhosts`);

    if (!response.ok) {
      throw new Error(`Failed to list cardhosts: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get details of a specific cardhost
   */
  async getCardhost(uuid: string): Promise<CardhostInfo> {
    const response = await fetch(`${this.baseUrl}/api/cardhosts/${uuid}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Cardhost not found: ${uuid}`);
      }
      throw new Error(`Failed to get cardhost: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create a controller session
   */
  async createSession(publicKey: string): Promise<ControllerSession> {
    const response = await fetch(`${this.baseUrl}/api/controller/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return await response.json();
  }
}
