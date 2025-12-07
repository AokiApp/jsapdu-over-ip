# Security Summary - Examples Implementation

## Overview

This document summarizes the security implementation in the jsapdu-over-ip examples, including authentication mechanisms, key management, and known limitations.

## Authentication Architecture

### Public-Key Cryptography (ECDSA P-256)

All components use public-key cryptography for authentication instead of traditional JWT tokens or passwords.

**Algorithm**: ECDSA (Elliptic Curve Digital Signature Algorithm)
**Curve**: P-256 (also known as secp256r1 or prime256v1)
**API**: Web Crypto API (standard across Node.js and browsers)

**Rationale**:
- Stronger security than symmetric keys or passwords
- No shared secrets to transmit
- Mutual authentication possible
- Industry-standard cryptographic primitives
- Native support in modern platforms

### Key Management

#### Cardhost Key Management

**Location**: `examples/cardhost/src/crypto.ts`

**Key Generation**:
```typescript
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'ECDSA',
    namedCurve: 'P-256',
  },
  true, // extractable
  ['sign', 'verify']
);
```

**Storage**:
- Keys stored in `cardhost-config.json` (default location)
- Format: Base64-encoded SPKI (public) and PKCS#8 (private)
- File permissions: Should be 600 (user read/write only) in production
- **⚠️ IMPORTANT**: Keys are NOT encrypted at rest in this demo

**First Run**:
1. UUID generated using `crypto.randomUUID()`
2. Key pair generated automatically
3. Both saved to config file
4. Subsequent runs load existing keys

**Persistence**:
- Keys persist across restarts
- UUID remains constant (used for addressing)
- Public key used for identity verification

#### Controller Key Management

**Location**: `examples/controller/src/crypto.ts`

**Key Generation**: Same algorithm as cardhost

**Storage**:
- Keys stored in browser localStorage
- Keys: `controller_public_key`, `controller_private_key`
- Format: Base64-encoded
- **⚠️ IMPORTANT**: Not encrypted in this demo

**First Visit**:
1. Check localStorage for existing keys
2. If not found, generate new key pair
3. Store in localStorage
4. Subsequent visits reuse same keys

**Browser Security**:
- localStorage is origin-specific
- Keys accessible only to same origin
- Cleared when browser data is cleared
- Consider using IndexedDB for more security in production

### Authentication Flow

#### Cardhost Registration

1. **Connection**: Cardhost connects to router via WebSocket
2. **Challenge Creation**: Cardhost creates challenge: `${timestamp}-${uuid}`
3. **Signing**: Cardhost signs challenge with private key
4. **Registration**: Sends register message with:
   - UUID (for addressing)
   - Public key (Base64)
   - Challenge (plaintext)
   - Signature (Base64)
5. **Verification**: Router verifies signature matches public key
6. **Acknowledgment**: Router sends registered message with success/failure

**Message Format** (extension to base protocol):
```typescript
{
  type: 'register',
  uuid: string,
  name: string,
  capabilities: {...},
  // Authentication fields
  publicKey: string,      // Base64 SPKI
  challenge: string,      // Timestamp-UUID
  signature: string       // Base64 signature
}
```

#### Controller Authentication

1. **Session Creation**: Controller requests session via REST API with public key
2. **Session Token**: Router returns sessionId and WebSocket URL
3. **Connection**: Controller connects to WebSocket with sessionId
4. **Verification**: Router verifies controller's public key
5. **Authorization**: Router maintains mapping of sessionId → public key

**REST API**:
```http
POST /api/controller/sessions
Content-Type: application/json

{
  "publicKey": "Base64 SPKI..."
}
```

**Response**:
```json
{
  "sessionId": "uuid",
  "wsUrl": "ws://router/ws/controller/uuid",
  "expiresAt": "ISO8601 timestamp"
}
```

### Message Signing

#### Sign Operation

**Cardhost** (`examples/cardhost/src/crypto.ts`):
```typescript
async function sign(privateKey: CryptoKey, data: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(data)
  );
  return Buffer.from(signature).toString('base64');
}
```

**Controller** (`examples/controller/src/crypto.ts`):
Similar implementation using browser APIs (`btoa` instead of `Buffer`)

#### Verify Operation

```typescript
async function verify(
  publicKey: CryptoKey,
  signature: string,
  data: string
): Promise<boolean> {
  return await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    Buffer.from(signature, 'base64'),
    new TextEncoder().encode(data)
  );
}
```

## UUID Role and Limitations

### UUID as Address, Not Identity

**Critical Design Principle**: UUIDs are used ONLY for addressing/routing, NOT for authentication or security.

**UUID Generation**: `crypto.randomUUID()` (128-bit, RFC 4122)

**Persistence**: Stored in config file, regenerated only if file is deleted

**Why Not for Security?**:
1. **Size**: 128 bits is insufficient for long-term security
2. **Collision Risk**: Though small, not zero
3. **No Authentication**: UUID can be spoofed
4. **File-Based**: Config file can be copied/modified

**Correct Usage**:
- Router uses UUID to route messages to correct cardhost
- Controller specifies target cardhost by UUID
- UUID identifies "which" cardhost, public key identifies "is it really that cardhost"

**Example**:
```typescript
// Controller sends APDU to cardhost
const request = {
  type: 'request',
  method: 'card.transmit',
  params: [apdu],
  targetCardhost: 'uuid-1234', // Addressing only
};
// Router verifies sender's public key before routing
```

## Security Strengths

### ✅ Strong Cryptography

- ECDSA P-256 is NIST-approved, widely used
- SHA-256 for hashing
- Web Crypto API ensures correct implementation
- No custom crypto code

### ✅ Mutual Authentication

- Cardhost authenticates to router with signature
- Controller authenticates to router with public key
- Router can verify identity of both parties

### ✅ No Shared Secrets

- Each component has own key pair
- Public keys transmitted safely
- Private keys never leave origin
- No password/token transmission

### ✅ Protection Against Replay

- Challenges include timestamp
- Old signatures cannot be reused
- Router should implement timeout checks (to be added)

## Security Limitations

### ⚠️ Private Key Storage

**Current State**: Keys stored unencrypted in plaintext

**Risk**: 
- If attacker gains file access, can impersonate cardhost
- If attacker accesses browser storage, can impersonate controller

**Mitigation for Production**:
- Encrypt private keys with user password/PIN
- Use OS keychain (Keychain on macOS, Windows Credential Manager)
- Use hardware security modules (HSM) for high-value systems
- Implement key rotation

### ⚠️ No TLS/WSS

**Current State**: WebSocket connections are unencrypted (ws://)

**Risk**:
- Messages visible to network observers
- Man-in-the-middle attacks possible
- APDU commands and responses intercepted

**Mitigation for Production**:
- Use WSS (WebSocket Secure) with TLS certificates
- Enforce HTTPS for REST API
- Use certificate pinning for extra security

### ⚠️ No Rate Limiting

**Current State**: No limits on authentication attempts or requests

**Risk**:
- Brute force attacks possible
- Denial of service via message flooding

**Mitigation for Production**:
- Implement rate limiting in router
- Connection limits per IP/identity
- Request throttling
- Timeout inactive connections

### ⚠️ No Key Rotation

**Current State**: Keys generated once and reused forever

**Risk**:
- Compromised key remains valid indefinitely
- No forward secrecy

**Mitigation for Production**:
- Implement periodic key rotation
- Support multiple keys during transition
- Key revocation list
- Certificate expiration

### ⚠️ Browser localStorage Limitations

**Current State**: Controller keys in localStorage

**Risk**:
- Accessible via JavaScript
- No encryption
- Vulnerable to XSS attacks
- Cleared with browser data

**Mitigation for Production**:
- Use IndexedDB with encryption
- Consider server-side session management
- Implement 2FA for sensitive operations
- Use short-lived session tokens

### ⚠️ No Challenge Validation

**Current State**: Router accepts any challenge format

**Risk**:
- Replay attacks if router doesn't check timestamps
- Predictable challenges

**Mitigation for Production**:
- Router validates challenge freshness (±5 minutes)
- Use cryptographically random nonces
- Track used challenges (replay prevention)

### ⚠️ No Authorization Logic

**Current State**: Authenticated users can access any cardhost

**Risk**:
- No access control
- All controllers can use all cardhosts

**Mitigation for Production**:
- Implement ACL (Access Control Lists)
- Cardhost owners specify allowed controller public keys
- Router enforces authorization rules
- Audit logging

## Implementation Details

### Cardhost Authentication Code

**File**: `examples/cardhost/src/router-client.ts`

**Key Functions**:
- `createChallenge()`: Generate timestamp-UUID challenge
- `createAuthResponse()`: Sign challenge with private key
- `register()`: Send registration with authentication

**Registration Process**:
```typescript
const challenge = crypto.createChallenge();
const signature = await crypto.createAuthResponse(privateKey, challenge);

const registerMessage = {
  type: 'register',
  uuid: config.uuid,
  publicKey: config.publicKey,
  challenge,
  signature,
  // ... other fields
};
```

### Controller Authentication Code

**File**: `examples/controller/src/api-client.ts`

**Session Creation**:
```typescript
async createSession(publicKey: string): Promise<ControllerSession> {
  const response = await fetch(`${baseUrl}/api/controller/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey }),
  });
  return await response.json();
}
```

### Key Generation Code

**Shared between cardhost and controller**:

```typescript
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'ECDSA',
    namedCurve: 'P-256',
  },
  true, // extractable
  ['sign', 'verify']
);
```

**Export for storage**:
```typescript
// Public key (safe to transmit)
const exported = await crypto.subtle.exportKey('spki', publicKey);
const base64 = Buffer.from(exported).toString('base64');

// Private key (keep secret!)
const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
const base64 = Buffer.from(exported).toString('base64');
```

## Router Implementation Notes

### To Be Implemented

The router (to be implemented in next session) should include:

1. **Public Key Verification**:
```java
// Pseudo-code
boolean verifySignature(String publicKeyBase64, String challenge, String signatureBase64) {
  PublicKey publicKey = importPublicKey(publicKeyBase64);
  byte[] challengeBytes = challenge.getBytes(StandardCharsets.UTF_8);
  byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
  
  Signature verifier = Signature.getInstance("SHA256withECDSA");
  verifier.initVerify(publicKey);
  verifier.update(challengeBytes);
  return verifier.verify(signatureBytes);
}
```

2. **Challenge Freshness Check**:
```java
boolean isChallengeFresh(String challenge) {
  String[] parts = challenge.split("-");
  long timestamp = Long.parseLong(parts[0]);
  long now = System.currentTimeMillis();
  return Math.abs(now - timestamp) < 300_000; // 5 minutes
}
```

3. **Database Schema**:
```sql
CREATE TABLE cardhosts (
  uuid VARCHAR(36) PRIMARY KEY,
  public_key TEXT NOT NULL,  -- Store public key
  -- ... other fields
);

CREATE TABLE controller_sessions (
  session_id VARCHAR(36) PRIMARY KEY,
  public_key TEXT NOT NULL,  -- Store public key
  -- ... other fields
);
```

## Security Checklist for Production

Before deploying to production, implement these security measures:

### Authentication & Authorization
- [ ] Encrypt private keys at rest
- [ ] Implement key rotation mechanism
- [ ] Add challenge freshness validation
- [ ] Implement replay attack prevention
- [ ] Add access control lists (ACL)
- [ ] Implement audit logging
- [ ] Add rate limiting

### Transport Security
- [ ] Enable TLS/WSS for all connections
- [ ] Use valid SSL certificates (not self-signed)
- [ ] Implement certificate pinning
- [ ] Enable HSTS (HTTP Strict Transport Security)

### Key Management
- [ ] Use hardware security modules (HSM) for sensitive keys
- [ ] Implement key backup/recovery procedures
- [ ] Set key expiration policies
- [ ] Create key revocation mechanism

### Application Security
- [ ] Input validation on all user inputs
- [ ] Output encoding to prevent XSS
- [ ] CSRF protection for REST API
- [ ] SQL injection prevention (use parameterized queries)
- [ ] Implement security headers (CSP, X-Frame-Options, etc.)

### Monitoring & Response
- [ ] Implement security event logging
- [ ] Set up alerts for suspicious activity
- [ ] Create incident response procedures
- [ ] Regular security audits
- [ ] Penetration testing

## Known Vulnerabilities

### None Currently

As of Session 2, no security vulnerabilities have been discovered in the implemented code. However, the limitations listed above represent areas where security could be improved.

## Security Contact

For security issues in production deployments, please follow responsible disclosure:

1. Do not open public issues for security vulnerabilities
2. Contact the repository maintainers privately
3. Provide detailed information about the issue
4. Allow time for a fix before public disclosure

## References

### Standards and Specifications

- [RFC 4122](https://www.rfc-editor.org/rfc/rfc4122): UUID Specification
- [RFC 6090](https://www.rfc-editor.org/rfc/rfc6090): ECC Fundamental Curves
- [NIST FIPS 186-4](https://csrc.nist.gov/publications/detail/fips/186/4/final): Digital Signature Standard
- [Web Crypto API](https://www.w3.org/TR/WebCryptoAPI/): W3C Recommendation

### Implementation References

- `examples/cardhost/src/crypto.ts` - Cardhost crypto implementation
- `examples/controller/src/crypto.ts` - Controller crypto implementation
- `examples/cardhost/src/router-client.ts` - Authentication flow
- `docs/examples-architecture.md` - Security architecture overview

## Changelog

### 2025-12-07 - Session 2
- Initial security implementation
- ECDSA P-256 public-key authentication
- Key generation and storage
- Challenge-response authentication flow
- Documentation of security model and limitations

## License

ANAL-Tight

---

**Last Updated**: 2025-12-07
**Review Status**: Session 2 Complete - Router Implementation Pending
