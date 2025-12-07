/**
 * Web Crypto API wrappers for public-key cryptography
 *
 * Implements authentication using ECDSA (Elliptic Curve Digital Signature Algorithm)
 * with P-256 curve for compatibility across platforms.
 */

import { webcrypto } from 'crypto';

const crypto = webcrypto as unknown as Crypto;

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * Generate a new ECDSA key pair for authentication
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256', // Also known as secp256r1 or prime256v1
    },
    true, // extractable
    ['sign', 'verify']
  );

  return keyPair;
}

/**
 * Export public key to Base64 string (for transmission/storage)
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return Buffer.from(exported).toString('base64');
}

/**
 * Export private key to Base64 string (for storage)
 * WARNING: In production, this should be encrypted!
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return Buffer.from(exported).toString('base64');
}

/**
 * Import public key from Base64 string
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyData = Buffer.from(base64Key, 'base64');
  return await crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
}

/**
 * Import private key from Base64 string
 */
export async function importPrivateKey(
  base64Key: string
): Promise<CryptoKey> {
  const keyData = Buffer.from(base64Key, 'base64');
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign']
  );
}

/**
 * Sign data with private key
 */
export async function sign(
  privateKey: CryptoKey,
  data: string | Uint8Array
): Promise<string> {
  const dataBuffer =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    privateKey,
    dataBuffer
  );

  return Buffer.from(signature).toString('base64');
}

/**
 * Verify signature with public key
 */
export async function verify(
  publicKey: CryptoKey,
  signature: string,
  data: string | Uint8Array
): Promise<boolean> {
  const signatureBuffer = Buffer.from(signature, 'base64');
  const dataBuffer =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  return await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    publicKey,
    signatureBuffer,
    dataBuffer
  );
}

/**
 * Create authentication challenge (timestamp-based)
 */
export function createChallenge(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Create authentication response (signed challenge)
 */
export async function createAuthResponse(
  privateKey: CryptoKey,
  challenge: string
): Promise<string> {
  return await sign(privateKey, challenge);
}

/**
 * Verify authentication response
 */
export async function verifyAuthResponse(
  publicKey: CryptoKey,
  challenge: string,
  response: string
): Promise<boolean> {
  return await verify(publicKey, response, challenge);
}
