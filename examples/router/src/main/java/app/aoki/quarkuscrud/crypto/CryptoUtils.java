package app.aoki.quarkuscrud.crypto;

import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

/**
 * Cryptographic utilities for signature verification and key management.
 * 
 * Uses ECDSA with P-256 curve for digital signatures.
 */
public class CryptoUtils {
    
    private static final String ALGORITHM = "EC";
    private static final String CURVE = "secp256r1"; // P-256
    private static final String SIGNATURE_ALGORITHM = "SHA256withECDSA";
    
    /**
     * Generate a new ECDSA key pair using P-256 curve.
     * 
     * @return KeyPair containing public and private keys
     * @throws NoSuchAlgorithmException if EC algorithm is not available
     * @throws InvalidAlgorithmParameterException if curve is not supported
     */
    public static KeyPair generateKeyPair() throws NoSuchAlgorithmException, InvalidAlgorithmParameterException {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance(ALGORITHM);
        ECGenParameterSpec ecSpec = new ECGenParameterSpec(CURVE);
        keyGen.initialize(ecSpec, new SecureRandom());
        return keyGen.generateKeyPair();
    }
    
    /**
     * Verify a signature using ECDSA.
     * 
     * @param publicKey The public key to verify with (base64-encoded)
     * @param data The data that was signed
     * @param signature The signature to verify (base64-encoded)
     * @return true if signature is valid, false otherwise
     */
    public static boolean verifySignature(String publicKey, byte[] data, String signature) {
        try {
            PublicKey pubKey = decodePublicKey(publicKey);
            byte[] sigBytes = Base64.getDecoder().decode(signature);
            
            Signature sig = Signature.getInstance(SIGNATURE_ALGORITHM);
            sig.initVerify(pubKey);
            sig.update(data);
            return sig.verify(sigBytes);
        } catch (Exception e) {
            // Log and return false on any error
            return false;
        }
    }
    
    /**
     * Sign data using ECDSA.
     * 
     * @param privateKey The private key to sign with
     * @param data The data to sign
     * @return Base64-encoded signature
     * @throws SignatureException if signing fails
     */
    public static String sign(PrivateKey privateKey, byte[] data) throws SignatureException {
        try {
            Signature sig = Signature.getInstance(SIGNATURE_ALGORITHM);
            sig.initSign(privateKey);
            sig.update(data);
            byte[] signature = sig.sign();
            return Base64.getEncoder().encodeToString(signature);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new SignatureException("Failed to sign data", e);
        }
    }
    
    /**
     * Encode public key to base64 string.
     * 
     * @param publicKey The public key to encode
     * @return Base64-encoded public key
     */
    public static String encodePublicKey(PublicKey publicKey) {
        return Base64.getEncoder().encodeToString(publicKey.getEncoded());
    }
    
    /**
     * Decode base64-encoded public key.
     * 
     * @param base64Key Base64-encoded public key
     * @return PublicKey object
     * @throws GeneralSecurityException if decoding fails
     */
    public static PublicKey decodePublicKey(String base64Key) throws GeneralSecurityException {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key);
        java.security.spec.X509EncodedKeySpec spec = new java.security.spec.X509EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance(ALGORITHM);
        return keyFactory.generatePublic(spec);
    }
    
    /**
     * Generate a secure random nonce.
     * 
     * @param length The length in bytes
     * @return Base64-encoded nonce
     */
    public static String generateNonce(int length) {
        byte[] nonce = new byte[length];
        new SecureRandom().nextBytes(nonce);
        return Base64.getEncoder().encodeToString(nonce);
    }
    
    /**
     * Verify timestamp is within acceptable range (to prevent replay attacks).
     * 
     * @param timestamp The timestamp to verify (Unix time in seconds)
     * @param maxAgeSeconds Maximum age in seconds (e.g., 300 for 5 minutes)
     * @return true if timestamp is recent enough
     */
    public static boolean verifyTimestamp(long timestamp, long maxAgeSeconds) {
        long currentTime = System.currentTimeMillis() / 1000;
        long age = Math.abs(currentTime - timestamp);
        return age <= maxAgeSeconds;
    }
}
