import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/utils/password";

describe("Password Hashing & Verification (Argon2id)", () => {
  it("should generate a valid Argon2id hash", async () => {
    const password = "StrongPassword123!@#";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toBe(password);
  });

  it("should produce unique hashes for identical passwords due to salt", async () => {
    const password = "SamePassword456$";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  it("should successfully verify the correct password", async () => {
    const password = "ValidUserPassword#2026";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const password = "CorrectPassword!1";
    const wrongPassword = "WrongPassword!1";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });

  it("should handle corrupted or invalid hashes gracefully without crashing", async () => {
    const isMatch = await verifyPassword("AnyPassword123!", "invalid_hash_string");
    expect(isMatch).toBe(false);
  });
});
