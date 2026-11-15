import crypto from "crypto";

/**
 * Generates a cryptographically secure random token (hex string).
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Computes a SHA-256 hash of a raw token for secure database storage.
 * Storing hashes prevents token theft if the database is read unauthorized.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates an expiry date N hours or minutes from now.
 */
export function createExpiryDate(durationMinutes: number): Date {
  return new Date(Date.now() + durationMinutes * 60 * 1000);
}
