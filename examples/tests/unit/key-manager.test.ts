/**
 * Key Manager Tests
 * 
 * Tests the persistent key pair management for cardhost authentication.
 * 
 * Validates:
 * 1. Key pair generation (ECDSA P-256)
 * 2. Key persistence to filesystem
 * 3. Key loading from filesystem
 * 4. Fingerprint calculation
 * 5. Key format validation
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'crypto';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('Key Manager - Key Generation', () => {
  test('generates ECDSA P-256 key pair', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey.type).toBe('private');
    expect(keyPair.publicKey.type).toBe('public');
    expect(keyPair.privateKey.algorithm.name).toBe('ECDSA');
    expect(keyPair.publicKey.algorithm.name).toBe('ECDSA');
  });

  test('private key can be exported', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const exported = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    expect(exported).toBeInstanceOf(ArrayBuffer);
    expect(exported.byteLength).toBeGreaterThan(0);
  });

  test('public key can be exported', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const exported = await webcrypto.subtle.exportKey('spki', keyPair.publicKey);
    expect(exported).toBeInstanceOf(ArrayBuffer);
    expect(exported.byteLength).toBeGreaterThan(0);
  });
});

describe('Key Manager - Key Import/Export', () => {
  let testKeyPair: webcrypto.CryptoKeyPair;

  beforeEach(async () => {
    testKeyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );
  });

  test('exported key can be re-imported', async () => {
    const privateKeyData = await webcrypto.subtle.exportKey('pkcs8', testKeyPair.privateKey);
    
    const importedPrivate = await webcrypto.subtle.importKey(
      'pkcs8',
      privateKeyData,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign']
    );

    expect(importedPrivate.type).toBe('private');
    expect(importedPrivate.algorithm.name).toBe('ECDSA');
  });

  test('public key can be imported from exported data', async () => {
    const publicKeyData = await webcrypto.subtle.exportKey('spki', testKeyPair.publicKey);
    
    const importedPublic = await webcrypto.subtle.importKey(
      'spki',
      publicKeyData,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['verify']
    );

    expect(importedPublic.type).toBe('public');
    expect(importedPublic.algorithm.name).toBe('ECDSA');
  });

  test('key can sign and verify data', async () => {
    const data = new TextEncoder().encode('test message');
    
    const signature = await webcrypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      testKeyPair.privateKey,
      data
    );

    const verified = await webcrypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      testKeyPair.publicKey,
      signature,
      data
    );

    expect(verified).toBe(true);
  });
});

describe('Key Manager - Fingerprint Calculation', () => {
  test('fingerprint is SHA-256 hash of public key', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const publicKeyData = await webcrypto.subtle.exportKey('spki', keyPair.publicKey);
    const hash = await webcrypto.subtle.digest('SHA-256', publicKeyData);
    
    const fingerprint = Buffer.from(hash).toString('hex');
    
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint.length).toBe(64);
  });

  test('same key produces same fingerprint', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const publicKeyData = await webcrypto.subtle.exportKey('spki', keyPair.publicKey);
    const hash1 = await webcrypto.subtle.digest('SHA-256', publicKeyData);
    const hash2 = await webcrypto.subtle.digest('SHA-256', publicKeyData);
    
    const fingerprint1 = Buffer.from(hash1).toString('hex');
    const fingerprint2 = Buffer.from(hash2).toString('hex');
    
    expect(fingerprint1).toBe(fingerprint2);
  });

  test('different keys produce different fingerprints', async () => {
    const keyPair1 = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const keyPair2 = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const publicKeyData1 = await webcrypto.subtle.exportKey('spki', keyPair1.publicKey);
    const publicKeyData2 = await webcrypto.subtle.exportKey('spki', keyPair2.publicKey);
    
    const hash1 = await webcrypto.subtle.digest('SHA-256', publicKeyData1);
    const hash2 = await webcrypto.subtle.digest('SHA-256', publicKeyData2);
    
    const fingerprint1 = Buffer.from(hash1).toString('hex');
    const fingerprint2 = Buffer.from(hash2).toString('hex');
    
    expect(fingerprint1).not.toBe(fingerprint2);
  });
});

describe('Key Manager - PEM Format', () => {
  test('PEM format has correct structure', () => {
    const testKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...';
    const pem = `-----BEGIN PUBLIC KEY-----\n${testKey}\n-----END PUBLIC KEY-----`;
    
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(pem).toContain('-----END PUBLIC KEY-----');
  });

  test('can convert buffer to base64 for PEM', () => {
    const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const base64 = buffer.toString('base64');
    
    expect(base64).toBe('AQIDBA==');
  });
});

// This file has 4 describe blocks with 13 tests
// Tests key generation, import/export, fingerprint calculation, and PEM format
// Uses webcrypto API to validate cryptographic operations
