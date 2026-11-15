import { describe, it, expect, beforeEach } from "vitest";
import { rateLimiter } from "@/server/security/rateLimiter";

describe("Rate Limiter", () => {
  const testKey = "test-ip-key";

  beforeEach(() => {
    rateLimiter.reset(testKey);
  });

  it("should allow requests within threshold", () => {
    expect(rateLimiter.isRateLimited(testKey, 3, 10000)).toBe(false);
    expect(rateLimiter.isRateLimited(testKey, 3, 10000)).toBe(false);
    expect(rateLimiter.isRateLimited(testKey, 3, 10000)).toBe(false);
  });

  it("should block requests exceeding the threshold", () => {
    rateLimiter.isRateLimited(testKey, 2, 10000); // 1
    rateLimiter.isRateLimited(testKey, 2, 10000); // 2
    const blocked = rateLimiter.isRateLimited(testKey, 2, 10000); // 3 (exceeded)

    expect(blocked).toBe(true);
  });

  it("should allow requests again after reset", () => {
    rateLimiter.isRateLimited(testKey, 1, 10000);
    expect(rateLimiter.isRateLimited(testKey, 1, 10000)).toBe(true);

    rateLimiter.reset(testKey);
    expect(rateLimiter.isRateLimited(testKey, 1, 10000)).toBe(false);
  });
});
