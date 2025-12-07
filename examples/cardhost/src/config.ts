/**
 * Configuration management for cardhost
 *
 * Handles loading and saving of:
 * - UUID (persistent cardhost identifier for addressing)
 * - Key pair (for public-key authentication)
 * - Router connection settings
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface CardhostConfig {
  uuid: string;
  name?: string;
  routerUrl: string;
  publicKey?: string; // Base64 encoded public key
  privateKey?: string; // Base64 encoded private key (encrypted at rest in production)
  heartbeatInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  monitorEnabled: boolean;
  monitorPort: number;
}

export interface ConfigFile {
  uuid: string;
  name?: string;
  publicKey?: string;
  privateKey?: string;
}

const DEFAULT_CONFIG: Omit<CardhostConfig, 'uuid'> = {
  name: 'Cardhost',
  routerUrl: process.env.ROUTER_URL || 'ws://localhost:8080/ws/cardhost',
  heartbeatInterval: 30000,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  monitorEnabled: process.env.MONITOR_ENABLED !== 'false',
  monitorPort: parseInt(process.env.MONITOR_PORT || '3001', 10),
};

const CONFIG_FILE_PATH =
  process.env.CONFIG_FILE || path.join(process.cwd(), 'cardhost-config.json');

/**
 * Load configuration from file, or create new if doesn't exist
 */
export async function loadConfig(): Promise<CardhostConfig> {
  try {
    const fileContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    const configFile: ConfigFile = JSON.parse(fileContent);

    return {
      ...DEFAULT_CONFIG,
      uuid: configFile.uuid,
      name: configFile.name || DEFAULT_CONFIG.name,
      publicKey: configFile.publicKey,
      privateKey: configFile.privateKey,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Config file doesn't exist, create new
      console.log('Config file not found, creating new configuration...');
      const newConfig: CardhostConfig = {
        ...DEFAULT_CONFIG,
        uuid: randomUUID(),
      };

      // Save initial config (keys will be generated separately)
      await saveConfig(newConfig);
      return newConfig;
    }
    throw error;
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: CardhostConfig): Promise<void> {
  const configFile: ConfigFile = {
    uuid: config.uuid,
    name: config.name,
    publicKey: config.publicKey,
    privateKey: config.privateKey,
  };

  await fs.writeFile(
    CONFIG_FILE_PATH,
    JSON.stringify(configFile, null, 2),
    'utf-8'
  );
  console.log(`Configuration saved to ${CONFIG_FILE_PATH}`);
}

/**
 * Update keys in configuration
 */
export async function updateKeys(
  config: CardhostConfig,
  publicKey: string,
  privateKey: string
): Promise<CardhostConfig> {
  const updatedConfig = {
    ...config,
    publicKey,
    privateKey,
  };

  await saveConfig(updatedConfig);
  return updatedConfig;
}
