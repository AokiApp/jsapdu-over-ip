/**
 * Key Management for Cardhost
 * 
 * Handles persistent key pairs for cardhost authentication and peer identification.
 * Per Issue #2: "cardhostは固定の鍵ペアを持ち、それによりピア同定と認証を行う"
 */

import { webcrypto } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface KeyPair {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
}

/**
 * Get or create persistent key pair for cardhost
 * Keys are stored in JSON Web Key (JWK) format
 */
export async function getOrCreateKeyPair(keyPath: string): Promise<KeyPair> {
  const publicKeyPath = `${keyPath}.public.jwk`;
  const privateKeyPath = `${keyPath}.private.jwk`;

  // Try to load existing keys
  if (existsSync(publicKeyPath) && existsSync(privateKeyPath)) {
    try {
      const publicJwk = JSON.parse(readFileSync(publicKeyPath, 'utf-8'));
      const privateJwk = JSON.parse(readFileSync(privateKeyPath, 'utf-8'));

      const publicKey = await webcrypto.subtle.importKey(
        'jwk',
        publicJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );

      const privateKey = await webcrypto.subtle.importKey(
        'jwk',
        privateJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
      );

      return { publicKey, privateKey };
    } catch (error) {
      console.error('Failed to load existing keys, regenerating:', error);
      // Fall through to generate new keys
    }
  }

  // Generate new key pair
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );

  // Export and save keys
  const publicJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);

  // Ensure directory exists
  const dir = dirname(keyPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(publicKeyPath, JSON.stringify(publicJwk, null, 2), 'utf-8');
  writeFileSync(privateKeyPath, JSON.stringify(privateJwk, null, 2), 'utf-8');

  console.log(`✅ New key pair generated and saved to ${keyPath}`);

  return keyPair;
}

/**
 * Get public key fingerprint for identification
 */
export async function getKeyFingerprint(publicKey: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey('spki', publicKey);
  const hash = await webcrypto.subtle.digest('SHA-256', exported);
  return Buffer.from(hash).toString('hex').substring(0, 16);
}
