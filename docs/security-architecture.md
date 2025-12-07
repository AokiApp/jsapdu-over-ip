# Security Architecture for jsapdu-over-ip Router

**Version:** 1.0  
**Date:** December 7, 2025  
**Status:** Design Document

## Overview

This document describes the authentication and encryption architecture for the jsapdu-over-ip router system, implementing end-to-end security between controllers and cardhosts through a semi-trusted router.

## Security Requirements

1. **Cardhost Authentication**: Fixed ECDSA/EdDSA key pair for peer identification
2. **Controller Authentication**: Bearer token or challenge-response
3. **End-to-End Encryption**: Controller ↔ Cardhost encrypted
4. **Router Authentication**: Router facilitates but doesn't decrypt E2E messages
5. **Session Security**: Secure HTTP → WebSocket upgrade
6. **Message Integrity**: All messages signed or MAC'd

## Threat Model

### Assumptions
- **Router is semi-trusted**: Can route messages, can't read E2E encrypted content
- **Network is hostile**: All connections over untrusted networks
- **Attackers can**: Intercept, replay, modify messages
- **Attackers cannot**: Break elliptic curve cryptography (hardness assumption)

### Threats
1. **Impersonation**: Attacker pretends to be cardhost/controller
2. **Man-in-the-Middle**: Attacker intercepts and modifies messages
3. **Replay Attacks**: Attacker replays old valid messages
4. **Message Tampering**: Attacker modifies messages in transit
5. **Unauthorized Access**: Attacker accesses cardhost without credentials

## Cryptographic Primitives

### Algorithms
- **Asymmetric**: ECDSA with P-256 (secp256r1) or Ed25519
- **Key Exchange**: ECDH with P-256 or X25519
- **Symmetric**: AES-256-GCM for encryption
- **Hashing**: SHA-256 for digests
- **MAC**: HMAC-SHA-256 or GMAC (from GCM)

### Libraries
- **Java Standard**: `java.security.*` for ECDSA, ECDH
- **Optional**: Bouncy Castle if needed for Ed25519
- **Quarkus**: SmallRye JWT for optional JWT tokens

## Architecture Components

### 1. Cardhost Identity

#### Key Pair Generation
```
Cardhost generates on first boot:
- Private key: ECDSA P-256 (stored encrypted in config)
- Public key: ECDSA P-256 (sent to router during registration)
- UUID: Addressing identifier (not for authentication)
```

#### Key Storage
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "privateKey": "base64(encrypted-with-passphrase)",
  "publicKey": "base64-encoded-public-key",
  "created": "2025-12-07T15:30:00Z"
}
```

#### Authentication Flow
```
1. Cardhost → Router: {"type":"auth-request","uuid":"xxx","publicKey":"yyy"}
2. Router → Cardhost: {"type":"auth-challenge","nonce":"random-bytes"}
3. Cardhost → Router: {"type":"auth-response","signature":"sign(nonce)"}
4. Router: Verify signature with public key
5. Router → Cardhost: {"type":"registered"} or {"type":"auth-failed"}
```

### 2. Controller Authentication

#### Session Token Flow
```
1. Controller → Router REST: POST /api/controller/sessions
   Header: Authorization: Bearer <token or nothing>
2. Router validates bearer token (if required)
3. Router generates session token (random 256-bit)
4. Router → Controller: {"sessionId":"uuid","wsUrl":"...","sessionToken":"xxx"}
5. Controller → Router WS: ws://...?sessionToken=xxx
6. Router validates token and upgrades to WebSocket
```

#### Bearer Token (Optional)
- For production: JWT with claims
- For examples: Simple shared secret or no auth (open)
- Controller stores in browser localStorage

### 3. End-to-End Encryption

#### Key Exchange Protocol (ECDHE)
```
After both connected:

1. Controller generates ephemeral ECDH key pair (ephemPubC, ephemPrivC)
2. Controller → Router → Cardhost: 
   {"type":"key-exchange-init","ephemPub":"base64(ephemPubC)"}
   
3. Cardhost generates ephemeral ECDH key pair (ephemPubH, ephemPrivH)
4. Cardhost → Router → Controller:
   {"type":"key-exchange-response","ephemPub":"base64(ephemPubH)"}
   
5. Both derive shared secret:
   - Controller: sharedSecret = ECDH(ephemPrivC, ephemPubH)
   - Cardhost: sharedSecret = ECDH(ephemPrivH, ephemPubC)
   
6. Both derive session keys using HKDF:
   - sessionKey = HKDF(sharedSecret, salt="jsapdu-session", info="")
   - Split into: encKey (32 bytes), macKey (32 bytes)
   
7. Both confirm:
   {"type":"key-exchange-confirm","mac":"HMAC(encKey||macKey)"}
```

#### Encrypted Message Flow
```
1. Controller encrypts RPC request:
   - nonce = random(12 bytes)
   - ciphertext = AES-GCM-encrypt(encKey, nonce, plaintext)
   - tag = GCM authentication tag
   
2. Controller → Router: {"type":"rpc-request-encrypted","nonce":"...","data":"...","tag":"..."}

3. Router routes to Cardhost (doesn't decrypt)

4. Cardhost decrypts and processes

5. Cardhost encrypts response and sends back

6. Router routes to Controller

7. Controller decrypts response
```

### 4. Message Authentication

#### Heartbeat with Signature
```
Cardhost → Router (every 30s):
{
  "type": "heartbeat",
  "timestamp": 1702000000,
  "signature": "ECDSA-sign(privateKey, timestamp)"
}

Router validates signature with stored public key
```

#### RPC Message MAC
```
All RPC messages include HMAC:
{
  "type": "rpc-request",
  "id": "request-id",
  "method": "...",
  "params": {...},
  "mac": "HMAC-SHA-256(macKey, type||id||method||params)"
}
```

### 5. Replay Attack Prevention

#### Nonce-Based
- Every message includes unique nonce
- Receiver tracks nonces in sliding window (last 1000)
- Reject duplicate nonces

#### Timestamp-Based
- Every message includes timestamp
- Receiver rejects messages older than 5 minutes
- Clock skew tolerance: ±2 minutes

## Implementation Phases

### Phase 1: Basic Authentication (Current Session)
- [x] Exception handling
- [x] Metrics integration
- [ ] Cardhost key pair generation utility
- [ ] Cardhost signature-based authentication
- [ ] Controller session token management
- [ ] Signature verification in router

### Phase 2: End-to-End Encryption (Future Session)
- [ ] ECDHE key exchange implementation
- [ ] Session key derivation (HKDF)
- [ ] AES-GCM encryption/decryption
- [ ] Message MAC implementation

### Phase 3: Replay Prevention (Future Session)
- [ ] Nonce tracking
- [ ] Timestamp validation
- [ ] Sliding window implementation

### Phase 4: Production Hardening (Future Session)
- [ ] Rate limiting
- [ ] DDoS protection
- [ ] Certificate pinning
- [ ] Key rotation
- [ ] Audit logging

## Security Considerations

### Key Management
- **Private keys**: Never transmitted, encrypted at rest
- **Session keys**: Ephemeral, discarded after session
- **Rotation**: Cardhost key pair rotatable by owner

### Performance
- **ECDH**: Fast, ~1ms per operation
- **AES-GCM**: Hardware accelerated on modern CPUs
- **Signatures**: ~2ms ECDSA verify, acceptable for infrequent operations

### Backwards Compatibility
- Encryption is optional initially
- Non-encrypted mode for testing
- Gradual rollout: auth → encryption → replay prevention

## Testing Strategy

### Unit Tests
- Key generation
- Signature verification
- Encryption/decryption
- Key derivation

### Integration Tests
- Full authentication flow
- Key exchange protocol
- Encrypted message routing

### Security Tests
- Replay attack rejection
- Signature forgery rejection
- Key exchange MitM resistance

## References

- **NIST SP 800-56A**: ECDH Key Agreement
- **RFC 5869**: HKDF Key Derivation
- **RFC 7516**: JSON Web Encryption (JWE)
- **RFC 7518**: JSON Web Algorithms (JWA)
- **NIST P-256**: secp256r1 curve
- **Bouncy Castle**: https://www.bouncycastle.org/
