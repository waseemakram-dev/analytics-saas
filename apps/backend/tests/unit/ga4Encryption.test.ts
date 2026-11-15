import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@/server/integrations/ga4/security/encryption";

describe("GA4 Token Security: AES-256-GCM Encryption & Decryption", () => {
  it("should successfully encrypt and decrypt a plaintext OAuth access token", () => {
    const rawToken = "ya29.a0AfH6SMDh_sample_google_access_token_xyz_123456789";
    const encrypted = encryptToken(rawToken);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.keyVersion).toBe(1);

    // Ciphertext must not match raw token
    expect(encrypted.ciphertext).not.toBe(rawToken);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it("should encrypt and decrypt a long refresh token", () => {
    const rawRefreshToken = "1//04_SampleGoogleRefreshToken_LongSecretString_AbCdEf12345";
    const encrypted = encryptToken(rawRefreshToken);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(rawRefreshToken);
  });

  it("should produce unique ciphertexts and IVs for the same plaintext due to random nonces", () => {
    const token = "ya29.identical_token_value_repeated";
    const enc1 = encryptToken(token);
    const enc2 = encryptToken(token);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    expect(enc1.tag).not.toBe(enc2.tag);

    // Both must decrypt back to original plaintext
    expect(decryptToken(enc1)).toBe(token);
    expect(decryptToken(enc2)).toBe(token);
  });

  it("should throw an error if the ciphertext has been tampered with", () => {
    const token = "ya29.sensitive_token_to_tamper";
    const encrypted = encryptToken(token);

    // Tamper with the last character of ciphertext
    const lastChar = encrypted.ciphertext.slice(-1);
    const tamperedLast = lastChar === "a" ? "b" : "a";
    const tamperedCiphertext = encrypted.ciphertext.slice(0, -1) + tamperedLast;

    expect(() => {
      decryptToken({
        ...encrypted,
        ciphertext: tamperedCiphertext,
      });
    }).toThrow();
  });

  it("should throw an error if the authentication tag has been altered", () => {
    const token = "ya29.sensitive_token_tag_tamper";
    const encrypted = encryptToken(token);

    const tamperedTag = encrypted.tag.slice(0, -2) + "00";

    expect(() => {
      decryptToken({
        ...encrypted,
        tag: tamperedTag,
      });
    }).toThrow();
  });

  it("should reject empty token encryption attempts", () => {
    expect(() => encryptToken("")).toThrow("Cannot encrypt empty token string.");
  });
});
