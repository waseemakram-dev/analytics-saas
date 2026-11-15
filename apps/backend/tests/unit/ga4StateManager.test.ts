import { describe, it, expect } from "vitest";
import { generateOAuthState, verifyOAuthState } from "@/server/integrations/ga4/oauth/stateManager";

describe("GA4 OAuth CSRF Protection: State Token Signing & Verification", () => {
  it("should generate a valid signed state token and verify it cleanly", () => {
    const workspaceId = "ws_test_123";
    const userId = "usr_test_456";

    const state = generateOAuthState(workspaceId, userId);
    expect(state).toContain(".");

    const verified = verifyOAuthState(state);
    expect(verified.workspaceId).toBe(workspaceId);
    expect(verified.userId).toBe(userId);
    expect(verified.nonce).toBeDefined();
    expect(verified.timestamp).toBeGreaterThan(0);
  });

  it("should reject an OAuth state token if signature was tampered with", () => {
    const state = generateOAuthState("ws_test_123", "usr_test_456");
    const [payload, sig] = state.split(".");

    // Alter signature
    const tamperedSig = sig.slice(0, -2) + "xx";
    const tamperedState = `${payload}.${tamperedSig}`;

    expect(() => verifyOAuthState(tamperedState)).toThrow(
      "Invalid OAuth state signature. Possible CSRF attack detected."
    );
  });

  it("should reject a malformed state token without delimiter", () => {
    expect(() => verifyOAuthState("invalid_state_without_signature")).toThrow(
      "Malformed OAuth state token."
    );
  });

  it("should reject an expired OAuth state token", () => {
    const workspaceId = "ws_test_123";
    const userId = "usr_test_456";

    // Create a payload with timestamp from 30 minutes ago (exceeding 15-minute TTL)
    const oldTimestamp = Date.now() - 30 * 60 * 1000;
    const payload = {
      workspaceId,
      userId,
      timestamp: oldTimestamp,
      nonce: "fake_nonce_123",
    };

    const crypto = require("crypto");
    const secret = process.env.AUTH_SECRET || "fallback_saas_auth_secret_dev";
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
    const expiredState = `${payloadB64}.${signature}`;

    expect(() => verifyOAuthState(expiredState)).toThrow(
      "OAuth state token has expired. Please initiate connection again."
    );
  });
});
