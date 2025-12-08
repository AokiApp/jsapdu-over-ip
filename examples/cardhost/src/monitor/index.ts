/**
 * Integrated Monitor for Cardhost
 *
 * Provides a web UI for monitoring cardhost status, metrics, and logs
 * Runs in the same process as the cardhost service
 */

import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MonitorConfig {
  port: number;
}

export interface MonitorData {
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  uuid: string;
  readers: Array<{
    name: string;
    hasCard: boolean;
  }>;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    lastRequestTime?: string;
  };
  connection: {
    state: string;
    connectedAt?: string;
    lastHeartbeat?: string;
  };
}

class Monitor {
  private server: http.Server | null = null;
  private startTime: number = Date.now();
  private monitorData: MonitorData = {
    status: 'running',
    uptime: 0,
    uuid: '',
    readers: [],
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
    },
    connection: {
      state: 'disconnected',
    },
  };

  constructor(private config: MonitorConfig) {}

  public async start(uuid: string): Promise<void> {
    this.monitorData.uuid = uuid;

    this.server = http.createServer((req, res) => {
      void (async () => {
        await this.handleRequest(req, res);
      })();
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, () => {
        console.log(`Monitor UI available at http://localhost:${this.config.port}`);
        resolve();
      });

      this.server!.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }

  public updateStatus(data: Partial<MonitorData>): void {
    this.monitorData = {
      ...this.monitorData,
      ...data,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = req.url || '/';

    try {
      if (url === '/' || url === '/index.html') {
        await this.serveHTML(res);
      } else if (url === '/api/status') {
        await this.serveStatus(res);
      } else if (url === '/styles.css') {
        await this.serveCSS(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      console.error('Monitor error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private async serveHTML(res: http.ServerResponse): Promise<void> {
    try {
      const htmlPath = path.join(__dirname, 'ui', 'index.html');
      const html = await fs.readFile(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      // If file doesn't exist, serve inline HTML
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this.getDefaultHTML());
    }
  }

  private serveCSS(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(this.getDefaultCSS());
  }

  private serveStatus(res: http.ServerResponse): void {
    this.monitorData.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.monitorData));
  }

  private getDefaultHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cardhost Monitor</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>📡 Cardhost Monitor</h1>
            <div class="status-badge" id="status">Loading...</div>
        </header>

        <section class="info-section">
            <h2>Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">UUID:</span>
                    <span class="value" id="uuid">-</span>
                </div>
                <div class="info-item">
                    <span class="label">Uptime:</span>
                    <span class="value" id="uptime">-</span>
                </div>
                <div class="info-item">
                    <span class="label">Connection:</span>
                    <span class="value" id="connection">-</span>
                </div>
            </div>
        </section>

        <section class="readers-section">
            <h2>Card Readers</h2>
            <div id="readers" class="readers-list">
                <p class="loading">Loading readers...</p>
            </div>
        </section>

        <section class="metrics-section">
            <h2>Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value" id="total-requests">0</div>
                    <div class="metric-label">Total Requests</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" id="successful-requests">0</div>
                    <div class="metric-label">Successful</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" id="failed-requests">0</div>
                    <div class="metric-label">Failed</div>
                </div>
            </div>
        </section>
    </div>

    <script>
        function formatUptime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return \`\${hours}h \${minutes}m \${secs}s\`;
        }

        async function updateStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();

                // Update status badge
                const statusEl = document.getElementById('status');
                statusEl.textContent = data.status.toUpperCase();
                statusEl.className = 'status-badge status-' + data.status;

                // Update info
                document.getElementById('uuid').textContent = data.uuid || '-';
                document.getElementById('uptime').textContent = formatUptime(data.uptime);
                document.getElementById('connection').textContent = data.connection.state;

                // Update readers
                const readersEl = document.getElementById('readers');
                if (data.readers && data.readers.length > 0) {
                    readersEl.innerHTML = data.readers.map(reader => \`
                        <div class="reader-card">
                            <div class="reader-name">\${reader.name}</div>
                            <div class="reader-status \${reader.hasCard ? 'has-card' : 'no-card'}">
                                \${reader.hasCard ? '🟢 Card Present' : '⚪ No Card'}
                            </div>
                        </div>
                    \`).join('');
                } else {
                    readersEl.innerHTML = '<p class="no-data">No readers found</p>';
                }

                // Update metrics
                document.getElementById('total-requests').textContent = data.metrics.totalRequests;
                document.getElementById('successful-requests').textContent = data.metrics.successfulRequests;
                document.getElementById('failed-requests').textContent = data.metrics.failedRequests;

            } catch (error) {
                console.error('Failed to fetch status:', error);
            }
        }

        // Update every 2 seconds
        updateStatus();
        setInterval(updateStatus, 2000);
    </script>
</body>
</html>`;
  }

  private getDefaultCSS(): string {
    return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    color: #333;
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

h1 {
    font-size: 24px;
    color: #2c3e50;
}

h2 {
    font-size: 18px;
    color: #2c3e50;
    margin-bottom: 15px;
}

.status-badge {
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 12px;
}

.status-running {
    background: #d4edda;
    color: #155724;
}

.status-stopped {
    background: #f8d7da;
    color: #721c24;
}

.status-error {
    background: #fff3cd;
    color: #856404;
}

section {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
}

.info-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 4px;
}

.label {
    font-weight: 600;
    color: #666;
}

.value {
    color: #2c3e50;
    font-family: 'Courier New', monospace;
}

.readers-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 15px;
}

.reader-card {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 4px;
    border-left: 4px solid #3498db;
}

.reader-name {
    font-weight: 600;
    margin-bottom: 8px;
}

.reader-status {
    font-size: 14px;
}

.has-card {
    color: #27ae60;
}

.no-card {
    color: #95a5a6;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.metric-card {
    text-align: center;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 4px;
}

.metric-value {
    font-size: 32px;
    font-weight: bold;
    color: #3498db;
    margin-bottom: 8px;
}

.metric-label {
    color: #666;
    font-size: 14px;
}

.loading, .no-data {
    text-align: center;
    color: #999;
    padding: 20px;
}
`;
  }
}

let monitorInstance: Monitor | null = null;

export async function startMonitor(
  port: number,
  uuid: string
): Promise<Monitor> {
  if (monitorInstance) {
    throw new Error('Monitor already running');
  }

  monitorInstance = new Monitor({ port });
  await monitorInstance.start(uuid);
  return monitorInstance;
}

export async function stopMonitor(): Promise<void> {
  if (monitorInstance) {
    await monitorInstance.stop();
    monitorInstance = null;
  }
}

export function getMonitor(): Monitor | null {
  return monitorInstance;
}
