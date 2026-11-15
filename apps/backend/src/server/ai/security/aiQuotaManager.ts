import { prisma } from "@/server/database/prisma";
import { rateLimiter } from "@/server/security/rateLimiter";
import { AppError } from "@/lib/errors/appError";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export class AiQuotaManager {
  // Conservative baseline defaults for free tier (configurable via env)
  private static workspaceRpmLimit = Number(process.env.AI_WORKSPACE_RPM_LIMIT) || 5;
  private static globalRpmLimit = Number(process.env.GROQ_GLOBAL_RPM_LIMIT) || 20;
  private static globalRpdLimit = Number(process.env.GROQ_GLOBAL_RPD_LIMIT) || 900;
  private static globalTpmLimit = Number(process.env.GROQ_GLOBAL_TPM_LIMIT) || 6000;
  private static globalTpdLimit = Number(process.env.GROQ_GLOBAL_TPD_LIMIT) || 180000;
  private static maxConcurrentRequests = Number(process.env.GROQ_MAX_CONCURRENT_REQUESTS) || 2;

  // In-flight concurrency tracker
  private static activeInFlightRequests = 0;

  /**
   * Layer A: Workspace-scoped rate limit check.
   */
  static checkWorkspaceLimit(workspaceId: string): void {
    const rateLimitKey = `ai_insights:ws:${workspaceId}`;
    const isLimited = rateLimiter.isRateLimited(
      rateLimitKey,
      this.workspaceRpmLimit,
      60 * 1000
    );

    if (isLimited) {
      throw new AppError(
        `Workspace AI insight rate limit exceeded (${this.workspaceRpmLimit} req/min). Please wait before generating more insights.`,
        429,
        "AI_WORKSPACE_RATE_LIMIT_EXCEEDED"
      );
    }
  }

  /**
   * Layer B: Global provider-wide limit check (PostgreSQL backed).
   * Validates RPM, RPD, TPM, and TPD across all workspaces.
   */
  static async checkGlobalProviderLimit(
    provider: string = "groq",
    estimatedTokens: number = 1200
  ): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Check Requests Per Minute (RPM) & Tokens Per Minute (TPM)
    const recentMinuteLogs = await prisma.aiUsageLog.findMany({
      where: {
        provider,
        createdAt: { gte: oneMinuteAgo },
      },
      select: { totalTokens: true },
    });

    const currentMinuteRequests = recentMinuteLogs.length;
    const currentMinuteTokens = recentMinuteLogs.reduce((acc, l) => acc + (l.totalTokens || 0), 0);

    if (currentMinuteRequests >= this.globalRpmLimit) {
      throw new AppError(
        "AI intelligence provider is currently at global capacity. Please try again in 30 seconds.",
        429,
        "GLOBAL_AI_RPM_EXCEEDED"
      );
    }

    if (currentMinuteTokens + estimatedTokens > this.globalTpmLimit) {
      throw new AppError(
        "AI token rate limit exceeded for the current minute. Please retry in 30 seconds.",
        429,
        "GLOBAL_AI_TPM_EXCEEDED"
      );
    }

    // 2. Check Requests Per Day (RPD) & Tokens Per Day (TPD)
    const recentDayLogs = await prisma.aiUsageLog.findMany({
      where: {
        provider,
        createdAt: { gte: oneDayAgo },
      },
      select: { totalTokens: true },
    });

    const currentDayRequests = recentDayLogs.length;
    const currentDayTokens = recentDayLogs.reduce((acc, l) => acc + (l.totalTokens || 0), 0);

    if (currentDayRequests >= this.globalRpdLimit) {
      throw new AppError(
        "Global daily AI quota reached for this provider. Quota resets in next 24-hour cycle.",
        429,
        "GLOBAL_AI_RPD_EXCEEDED"
      );
    }

    if (currentDayTokens + estimatedTokens > this.globalTpdLimit) {
      throw new AppError(
        "Global daily AI token quota reached for this provider.",
        429,
        "GLOBAL_AI_TPD_EXCEEDED"
      );
    }
  }

  /**
   * Concurrency slot reservation.
   * Ensures no more than maxConcurrentRequests hit the provider simultaneously.
   */
  static async acquireConcurrencySlot(): Promise<() => void> {
    if (this.activeInFlightRequests >= this.maxConcurrentRequests) {
      // Short wait (up to 2000ms) to allow an active request to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (this.activeInFlightRequests >= this.maxConcurrentRequests) {
        throw new AppError(
          "AI provider is processing maximum simultaneous requests. Please retry in a few moments.",
          429,
          "AI_CONCURRENCY_LIMIT_EXCEEDED"
        );
      }
    }

    this.activeInFlightRequests++;
    let released = false;

    return () => {
      if (!released) {
        released = true;
        this.activeInFlightRequests = Math.max(0, this.activeInFlightRequests - 1);
      }
    };
  }

  /**
   * Resets in-memory concurrency tracker (useful for test isolation).
   */
  static resetConcurrency(): void {
    this.activeInFlightRequests = 0;
  }
}
