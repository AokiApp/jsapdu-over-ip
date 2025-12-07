/**
 * Cardhost Main Entry Point
 *
 * Starts the cardhost service with:
 * - Configuration loading
 * - Key pair generation/loading
 * - Platform initialization (mock or PC/SC)
 * - Router connection
 * - Optional integrated monitor
 */

import { loadConfig, updateKeys } from './config.js';
import * as crypto from './crypto.js';
import { RouterClient } from './router-client.js';
import { CardhostService } from './cardhost-service.js';
import { createMockPlatform } from './mock-platform.js';

async function main() {
  console.log('=== Cardhost Starting ===');

  try {
    // Load configuration
    console.log('Loading configuration...');
    let config = await loadConfig();

    // Generate or load key pair for authentication
    let privateKeyObj: crypto.KeyPair['privateKey'];
    let publicKeyObj: crypto.KeyPair['publicKey'];

    if (config.publicKey && config.privateKey) {
      console.log('Loading existing key pair...');
      publicKeyObj = await crypto.importPublicKey(config.publicKey);
      privateKeyObj = await crypto.importPrivateKey(config.privateKey);
    } else {
      console.log('Generating new key pair...');
      const keyPair = await crypto.generateKeyPair();
      publicKeyObj = keyPair.publicKey;
      privateKeyObj = keyPair.privateKey;

      const publicKeyBase64 = await crypto.exportPublicKey(publicKeyObj);
      const privateKeyBase64 = await crypto.exportPrivateKey(privateKeyObj);

      config = await updateKeys(config, publicKeyBase64, privateKeyBase64);
      console.log('Key pair generated and saved');
    }

    console.log(`Cardhost UUID: ${config.uuid}`);
    console.log(`Cardhost Name: ${config.name}`);
    console.log(`Router URL: ${config.routerUrl}`);

    // Initialize platform (mock for now - in production would detect PC/SC)
    console.log('Initializing platform...');
    const useMock = process.env.USE_MOCK !== 'false'; // Default to mock
    const platform = useMock ? createMockPlatform() : createMockPlatform(); // TODO: Add PC/SC support

    // Initialize cardhost service
    const service = new CardhostService({
      platform,
      onEvent: async (event, data) => {
        // Forward events to router
        if (routerClient) {
          await routerClient.sendEvent(event, data);
        }
      },
    });

    await service.initialize();

    // Start integrated monitor if enabled
    if (config.monitorEnabled) {
      console.log(`Starting integrated monitor on port ${config.monitorPort}...`);
      // TODO: Import and start monitor
      // const { startMonitor } = await import('./monitor/index.js');
      // await startMonitor(config.monitorPort, service);
      console.log('Monitor not yet implemented, continuing without it...');
    }

    // Connect to router
    console.log('Connecting to router...');
    const routerClient = new RouterClient({
      url: config.routerUrl,
      uuid: config.uuid,
      publicKey: config.publicKey!,
      privateKey: privateKeyObj,
      heartbeatInterval: config.heartbeatInterval,
      reconnectInterval: config.reconnectInterval,
      maxReconnectAttempts: config.maxReconnectAttempts,
      onRequest: async (request) => {
        return await service.handleRequest(request);
      },
      onConnected: () => {
        console.log('✓ Connected to router');
      },
      onDisconnected: () => {
        console.log('✗ Disconnected from router');
      },
    });

    await routerClient.connect();

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      routerClient.disconnect();
      await service.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('=== Cardhost Running ===');
    console.log('Press Ctrl+C to stop');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
