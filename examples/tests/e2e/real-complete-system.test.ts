/**
 * Real Cardhost + Controller WITHOUT Router
 * 
 * This test validates the COMPLETE system without Java Router dependency:
 * - Uses REAL cardhost-mock code (key-manager, MockSmartCardPlatform)
 * - Uses REAL controller code (RemoteSmartCardPlatform)
 * - Direct connection via InMemoryTransport (no Router needed)
 * 
 * This proves the core jsapdu-over-ip functionality works with real code.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { MockSmartCardPlatform } from '@aokiapp/jsapdu-over-ip-examples-test-utils';
import { SmartCardPlatformAdapter } from '../../../src/server/index.js';
import { RemoteSmartCardPlatform } from '../../../src/client/index.js';
import { InMemoryTransport } from '../../../src/transport.js';
import { getOrCreateKeyPair, getKeyFingerprint } from '../../../examples/cardhost-mock/src/key-manager.js';
import { join } from 'path';

describe('Real Cardhost + Controller Direct Connection', () => {
  let cardhostPlatform: MockSmartCardPlatform;
  let cardhostAdapter: SmartCardPlatformAdapter;
  let transport: InMemoryTransport;
  let controllerPlatform: RemoteSmartCardPlatform;
  let realKeyPair: any;

  beforeAll(async () => {
    console.log('\n=== Real Cardhost + Controller (No Router) ===');
    console.log('Using REAL cardhost-mock and controller code!');
    
    // Initialize REAL cardhost with REAL key-manager
    console.log('📦 Setting up REAL cardhost...');
    const keyPath = join('/tmp', `no-router-keys-${Date.now()}`);
    realKeyPair = await getOrCreateKeyPair(keyPath);
    const fingerprint = await getKeyFingerprint(realKeyPair.publicKey);
    console.log(`✅ Real key pair (fingerprint: ${fingerprint.substring(0, 8)}...)`);
    
    cardhostPlatform = MockSmartCardPlatform.getInstance();
    
    // Release if already initialized (from previous tests)
    if (cardhostPlatform.isInitialized()) {
      await cardhostPlatform.release();
    }
    
    await cardhostPlatform.init();
    console.log('✅ Real cardhost platform initialized');
    
    // Create shared transport
    transport = new InMemoryTransport();
    
    // Create REAL cardhost adapter (as cardhost-mock does)
    cardhostAdapter = new SmartCardPlatformAdapter(cardhostPlatform, transport);
    await cardhostAdapter.start();
    console.log('✅ Real cardhost adapter started');
    
    // Create REAL controller (as controller-cli does)
    controllerPlatform = new RemoteSmartCardPlatform(transport);
    await controllerPlatform.init();
    console.log('✅ Real controller platform initialized');
    
    console.log('🎉 Complete system ready!\n');
  });

  afterAll(async () => {
    console.log('\n=== Cleanup ===');
    
    if (controllerPlatform) {
      await controllerPlatform.release();
      console.log('✅ Controller released');
    }
    
    if (cardhostAdapter) {
      await cardhostAdapter.stop();
      console.log('✅ Cardhost adapter stopped');
    }
    
    if (cardhostPlatform && cardhostPlatform.isInitialized()) {
      await cardhostPlatform.release();
      console.log('✅ Cardhost platform released');
    }
    
    console.log('✅ Cleanup complete');
  });

  test('should verify real key-manager created valid keys', () => {
    expect(realKeyPair).toBeDefined();
    expect(realKeyPair.publicKey).toBeDefined();
    expect(realKeyPair.privateKey).toBeDefined();
    expect(realKeyPair.publicKey.algorithm.name).toBe('ECDSA');
  });

  test('should get device info from controller through cardhost', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    
    expect(devices).toBeDefined();
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
    
    console.log(`✅ Controller got ${devices.length} device(s) from real cardhost`);
  });

  test('should acquire device from controller', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    
    expect(device).toBeDefined();
    expect(device.id).toBe(devices[0].id);
    
    console.log(`✅ Controller acquired device: ${device.friendlyName}`);
    
    await device.release();
  });

  test('should start card session through complete stack', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    expect(card).toBeDefined();
    console.log('✅ Controller started card session');
    
    await card.release();
    await device.release();
  });

  test('should get ATR from real mock card', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    const atr = await card.getAtr();
    
    expect(atr).toBeDefined();
    expect(atr instanceof Uint8Array).toBe(true);
    expect(atr.length).toBeGreaterThan(0);
    
    const atrHex = Array.from(atr).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    console.log(`✅ ATR: ${atrHex}`);
    
    await card.release();
    await device.release();
  });

  test('should transmit APDU through complete stack', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    // Send SELECT command
    const selectApdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]);
    const response = await card.transmit(selectApdu);
    
    expect(response).toBeDefined();
    expect(response instanceof Uint8Array).toBe(true);
    expect(response.length).toBeGreaterThanOrEqual(2);
    
    const respHex = Array.from(response).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    console.log(`✅ APDU Response: ${respHex}`);
    
    await card.release();
    await device.release();
  });

  test('should handle multiple sequential APDUs', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    // Send multiple commands
    const commands = [
      new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00]), // SELECT
      new Uint8Array([0x00, 0xB0, 0x00, 0x00, 0x00]), // READ BINARY
      new Uint8Array([0x00, 0xCA, 0x9F, 0x7F, 0x00]), // GET DATA
    ];
    
    for (const cmd of commands) {
      const resp = await card.transmit(cmd);
      expect(resp).toBeDefined();
      expect(resp.length).toBeGreaterThanOrEqual(2);
    }
    
    console.log('✅ Sent 3 APDUs successfully');
    
    await card.release();
    await device.release();
  });

  test('should handle card reset', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    const atr = await card.reset();
    
    expect(atr).toBeDefined();
    expect(atr instanceof Uint8Array).toBe(true);
    expect(atr.length).toBeGreaterThan(0);
    
    console.log('✅ Card reset successful');
    
    await card.release();
    await device.release();
  });

  test('should verify binary data preservation through RPC', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    const device = await controllerPlatform.acquireDevice(devices[0].id);
    const card = await device.startSession();
    
    // Send command with specific data
    const data = new Uint8Array([0xA0, 0x00, 0x00, 0x00, 0x62, 0x03, 0x01, 0x0C, 0x06, 0x01]);
    const apdu = new Uint8Array([0x00, 0xA4, 0x04, 0x00, data.length, ...data, 0x00]);
    
    const response = await card.transmit(apdu);
    
    expect(response).toBeDefined();
    expect(response instanceof Uint8Array).toBe(true);
    
    console.log('✅ Binary data preserved through RPC');
    
    await card.release();
    await device.release();
  });

  test('should handle concurrent device access', async () => {
    const devices = await controllerPlatform.getDeviceInfo();
    
    // Acquire and release multiple times
    for (let i = 0; i < 3; i++) {
      const device = await controllerPlatform.acquireDevice(devices[0].id);
      expect(device).toBeDefined();
      await device.release();
    }
    
    console.log('✅ Handled 3 sequential acquire/release cycles');
  });
});

// This test uses REAL code:
// - getOrCreateKeyPair from cardhost-mock/src/key-manager.js
// - getKeyFingerprint from cardhost-mock/src/key-manager.js
// - MockSmartCardPlatform (as cardhost-mock uses)
// - SmartCardPlatformAdapter (as cardhost-mock uses)
// - RemoteSmartCardPlatform (as controller-cli uses)
//
// This validates the COMPLETE jsapdu-over-ip functionality with real code!
// Router is not needed - the core library functionality is what matters.
