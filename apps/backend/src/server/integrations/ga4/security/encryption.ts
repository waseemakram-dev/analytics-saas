import crypto from "crypto";
import "dotenv/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const CURRENT_KEY_VERSION = 1;

/**
 * Derives a deterministic 256-bit (32-byte) key buffer from ENCRYPTION_MASTER_KEY.
 */
function getMasterKeyBuffer(keyVersion = CURRENT_KEY_VERSION): Buffer {
  const masterSecret = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterSecret) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY is not defined in environment variables. Cannot encrypt or decrypt integration tokens."
    );
  }

  // Use SHA-256 to ensure exact 32-byte key material regardless of input encoding or length
  return crypto.createHash("sha256").update(masterSecret).digest();
}

export interface EncryptedData {
  ciphertext: string; // Hex encoded
  iv: string; // Hex encoded
  tag: string; // Hex encoded
  keyVersion: number;
}

/**
 * Encrypts a plaintext string (e.g. OAuth token) using AES-256-GCM with a unique nonce/IV.
 * Nonces are never reused.
 */
export function encryptToken(plaintext: string): EncryptedData {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty token string.");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getMasterKeyBuffer(CURRENT_KEY_VERSION);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext using the stored IV and authentication tag.
 * Throws an error if the ciphertext has been modified or corrupted.
 */
export function decryptToken(encrypted: {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion?: number;
}): string {
  if (!encrypted.ciphertext || !encrypted.iv || !encrypted.tag) {
    throw new Error("Missing required encryption components (ciphertext, iv, or tag).");
  }

  const ivBuffer = Buffer.from(encrypted.iv, "hex");
  const tagBuffer = Buffer.from(encrypted.tag, "hex");
  const key = getMasterKeyBuffer(encrypted.keyVersion ?? CURRENT_KEY_VERSION);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(encrypted.ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
