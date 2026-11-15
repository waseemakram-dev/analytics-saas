import { describe, it, expect } from "vitest";
import { generateSecureToken, hashToken, createExpiryDate } from "@/server/auth/utils/tokens";

describe("Secure Token Utilities", () => {
  it("should generate cryptographically random hex tokens with expected length", () => {
    const token = generateSecureToken(32);
    expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
    expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
  });

  it("should generate distinct tokens across invocations", () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);
    expect(token1).not.toBe(token2);
  });

  it("should compute deterministic SHA-256 hashes", () => {
    const raw = "sample_raw_token_value";
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(raw);
  });

  it("should create accurate future expiry dates", () => {
    const before = Date.now();
    const expiry = createExpiryDate(60); // 60 minutes
    const after = Date.now();

    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + 60 * 60 * 1000);
  });
});
