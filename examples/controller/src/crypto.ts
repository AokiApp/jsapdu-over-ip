/**
 * Web Crypto API wrappers for controller (browser-based)
 *
 * Similar to cardhost crypto but adapted for browser environment
 */

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
      namedCurve: 'P-256',
    },
    true, // extractable
    ['sign', 'verify']
  );

  return keyPair;
}

/**
 * Export public key to Base64 string
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  const exportedAsArray = new Uint8Array(exported);
  return btoa(String.fromCharCode(...exportedAsArray));
}

/**
 * Export private key to Base64 string
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsArray = new Uint8Array(exported);
  return btoa(String.fromCharCode(...exportedAsArray));
}

/**
 * Import public key from Base64 string
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'spki',
    bytes.buffer,
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
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
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

  const signatureArray = new Uint8Array(signature);
  return btoa(String.fromCharCode(...signatureArray));
}

/**
 * Verify signature with public key
 */
export async function verify(
  publicKey: CryptoKey,
  signature: string,
  data: string | Uint8Array
): Promise<boolean> {
  const binaryString = atob(signature);
  const signatureBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    signatureBytes[i] = binaryString.charCodeAt(i);
  }

  const dataBuffer =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  return await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    publicKey,
    signatureBytes.buffer,
    dataBuffer
  );
}

/**
 * Create authentication challenge
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
 * Load or generate key pair from localStorage
 */
export async function loadOrGenerateKeyPair(): Promise<{
  keyPair: KeyPair;
  publicKeyBase64: string;
  privateKeyBase64: string;
}> {
  const storedPublic = localStorage.getItem('controller_public_key');
  const storedPrivate = localStorage.getItem('controller_private_key');

  let keyPair: KeyPair;
  let publicKeyBase64: string;
  let privateKeyBase64: string;

  if (storedPublic && storedPrivate) {
    // Load existing keys
    const publicKey = await importPublicKey(storedPublic);
    const privateKey = await importPrivateKey(storedPrivate);
    keyPair = { publicKey, privateKey };
    publicKeyBase64 = storedPublic;
    privateKeyBase64 = storedPrivate;
  } else {
    // Generate new keys
    keyPair = await generateKeyPair();
    publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
    privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

    // Store in localStorage
    localStorage.setItem('controller_public_key', publicKeyBase64);
    localStorage.setItem('controller_private_key', privateKeyBase64);
  }

  return { keyPair, publicKeyBase64, privateKeyBase64 };
}
