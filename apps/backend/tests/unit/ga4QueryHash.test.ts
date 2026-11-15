import { describe, it, expect } from "vitest";
import { generateQueryHash } from "@/server/integrations/ga4/security/queryHash";

describe("GA4 Reporting Query Hashing: Determinism & Collision Prevention", () => {
  it("should generate identical hashes for objects with differently ordered keys", () => {
    const queryA = {
      propertyId: "12345678",
      type: "overview",
      dateRange: "30d",
      options: { limit: 25, sort: "asc" },
    };

    const queryB = {
      options: { sort: "asc", limit: 25 },
      dateRange: "30d",
      type: "overview",
      propertyId: "12345678",
    };

    const hashA = generateQueryHash(queryA);
    const hashB = generateQueryHash(queryB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64); // SHA-256 hex string
  });

  it("should generate distinct hashes when any parameter changes", () => {
    const hash30d = generateQueryHash({ propertyId: "12345678", dateRange: "30d" });
    const hash7d = generateQueryHash({ propertyId: "12345678", dateRange: "7d" });
    const hashDiffProp = generateQueryHash({ propertyId: "87654321", dateRange: "30d" });

    expect(hash30d).not.toBe(hash7d);
    expect(hash30d).not.toBe(hashDiffProp);
  });
});
