import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiQuotaManager } from "@/server/ai/security/aiQuotaManager";
import { prisma } from "@/server/database/prisma";
import { rateLimiter } from "@/server/security/rateLimiter";

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    aiUsageLog: {
      findMany: vi.fn(),
    },
  },
}));

describe("AiQuotaManager (Two-Tier Rate Limiting)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AiQuotaManager.resetConcurrency();
    rateLimiter.reset("ai_insights:ws:ws_test_123");
  });

  describe("Layer A: Workspace Usage Limits", () => {
    it("should allow requests within workspace RPM limit and throw when exceeded", () => {
      const workspaceId = "ws_test_123";

      // Allow default 5 calls
      for (let i = 0; i < 5; i++) {
        expect(() => AiQuotaManager.checkWorkspaceLimit(workspaceId)).not.toThrow();
      }

      // 6th call should be blocked
      expect(() => AiQuotaManager.checkWorkspaceLimit(workspaceId)).toThrowError(
        /Workspace AI insight rate limit exceeded/
      );
    });
  });

  describe("Layer B: Global Provider Quota Limits (PostgreSQL Backed)", () => {
    it("should pass when global usage is within RPM and TPM limits", async () => {
      vi.mocked(prisma.aiUsageLog.findMany).mockResolvedValue([
        { totalTokens: 500 },
        { totalTokens: 600 },
      ] as any);

      await expect(
        AiQuotaManager.checkGlobalProviderLimit("groq", 1200)
      ).resolves.not.toThrow();
    });

    it("should reject when global RPM limit is exceeded across all workspaces", async () => {
      // Simulate 20 logs in the last minute (global limit is 20)
      const mockLogs = Array.from({ length: 20 }, () => ({ totalTokens: 100 }));
      vi.mocked(prisma.aiUsageLog.findMany).mockResolvedValueOnce(mockLogs as any);

      await expect(
        AiQuotaManager.checkGlobalProviderLimit("groq", 1200)
      ).rejects.toThrowError(/AI intelligence provider is currently at global capacity/);
    });

    it("should reject when global TPM limit would be exceeded with estimated tokens", async () => {
      // Simulate 5,500 tokens used in current minute (limit is 6,000, estimated is 1,200)
      vi.mocked(prisma.aiUsageLog.findMany).mockResolvedValueOnce([
        { totalTokens: 3000 },
        { totalTokens: 2500 },
      ] as any);

      await expect(
        AiQuotaManager.checkGlobalProviderLimit("groq", 1200)
      ).rejects.toThrowError(/AI token rate limit exceeded for the current minute/);
    });
  });

  describe("Concurrency Control", () => {
    it("should acquire and release concurrency slots safely", async () => {
      const release1 = await AiQuotaManager.acquireConcurrencySlot();
      const release2 = await AiQuotaManager.acquireConcurrencySlot();

      // Max concurrent is 2 by default; 3rd acquire should throw after wait
      await expect(AiQuotaManager.acquireConcurrencySlot()).rejects.toThrowError(
        /AI provider is processing maximum simultaneous requests/
      );

      // Release a slot
      release1();

      // Now 3rd slot should be acquirable
      const release3 = await AiQuotaManager.acquireConcurrencySlot();
      expect(typeof release3).toBe("function");

      release2();
      release3();
    });
  });
});
