import crypto from "crypto";

export interface OAuthStatePayload {
  workspaceId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes expiration

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || "fallback_saas_auth_secret_dev";
  return secret;
}

/**
 * Generates an HMAC-signed OAuth state string to prevent CSRF attacks.
 */
export function generateOAuthState(workspaceId: string, userId: string): string {
  const payload: OAuthStatePayload = {
    workspaceId,
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes an OAuth state string.
 * Throws an error if invalid, tampered with, or expired.
 */
export function verifyOAuthState(state: string): OAuthStatePayload {
  if (!state || typeof state !== "string") {
    throw new Error("Missing or invalid state parameter.");
  }

  const parts = state.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed OAuth state token.");
  }

  const [payloadB64, signature] = parts;

  // Verify HMAC signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new Error("Invalid OAuth state signature. Possible CSRF attack detected.");
  }

  // Parse payload
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("Failed to parse OAuth state payload.");
  }

  // Check TTL
  const age = Date.now() - payload.timestamp;
  if (age > STATE_TTL_MS || age < -30000) {
    throw new Error("OAuth state token has expired. Please initiate connection again.");
  }

  if (!payload.workspaceId || !payload.userId) {
    throw new Error("Incomplete OAuth state payload.");
  }

  return payload;
}
