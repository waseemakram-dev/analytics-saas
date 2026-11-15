import { prisma } from "@/server/database/prisma";
import { AiInsightsResult, AiLanguage, InsightType } from "../types/ai.types";
import crypto from "crypto";

export class AiInsightsCacheService {
  private defaultTtlHours = 6;

  /**
   * Deterministic query hash.
   */
  static generateHash(params: {
    propertyId: string;
    dateRange: string;
    language: AiLanguage;
    focus?: InsightType;
  }): string {
    const serialized = JSON.stringify({
      p: params.propertyId,
      d: params.dateRange,
      l: params.language,
      f: params.focus || "general",
    });
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Fetches cached AI insights from PostgreSQL.
   */
  async get(params: {
    connectedPropertyId: string;
    queryHash: string;
  }): Promise<AiInsightsResult | null> {
    const entry = await prisma.aiInsightCache.findUnique({
      where: {
        connectedPropertyId_queryHash: {
          connectedPropertyId: params.connectedPropertyId,
          queryHash: params.queryHash,
        },
      },
    });

    if (!entry) return null;

    // Check if expired
    if (new Date() > entry.expiresAt) {
      return null;
    }

    return {
      propertyId: entry.connectedPropertyId,
      dateRange: {
        startDate: (entry.insights as any)?._dateRange?.startDate || "N/A",
        endDate: (entry.insights as any)?._dateRange?.endDate || "N/A",
        label: entry.dateRange,
      },
      language: entry.language as AiLanguage,
      generatedAt: entry.fetchedAt.toISOString(),
      dataFetchedAt: entry.fetchedAt.toISOString(),
      provider: entry.provider,
      model: entry.model,
      summary: entry.summary,
      insights: (entry.insights as any)?.items || [],
      verifiedFacts: (entry.verifiedFacts as any) || {},
      limitations: (entry.limitations as any) || [],
      cache: {
        hit: true,
        cachedAt: entry.fetchedAt.toISOString(),
        expiresAt: entry.expiresAt.toISOString(),
      },
      usage: {
        promptTokens: entry.promptTokens || 0,
        completionTokens: entry.completionTokens || 0,
        totalTokens: entry.totalTokens || 0,
      },
    };
  }

  /**
   * Persists newly generated AI insights to PostgreSQL.
   */
  async set(params: {
    workspaceId: string;
    connectedPropertyId: string;
    dateRange: string;
    language: AiLanguage;
    queryHash: string;
    provider: string;
    model: string;
    result: AiInsightsResult;
    ttlHours?: number;
  }): Promise<void> {
    const ttl = params.ttlHours || this.defaultTtlHours;
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);

    const payload = {
      _dateRange: params.result.dateRange,
      items: params.result.insights,
    };

    await prisma.aiInsightCache.upsert({
      where: {
        connectedPropertyId_queryHash: {
          connectedPropertyId: params.connectedPropertyId,
          queryHash: params.queryHash,
        },
      },
      create: {
        workspaceId: params.workspaceId,
        connectedPropertyId: params.connectedPropertyId,
        dateRange: params.dateRange,
        language: params.language,
        queryHash: params.queryHash,
        provider: params.provider,
        model: params.model,
        summary: params.result.summary,
        insights: payload as any,
        limitations: params.result.limitations as any,
        verifiedFacts: params.result.verifiedFacts as any,
        promptTokens: params.result.usage?.promptTokens || 0,
        completionTokens: params.result.usage?.completionTokens || 0,
        totalTokens: params.result.usage?.totalTokens || 0,
        fetchedAt: new Date(params.result.generatedAt),
        expiresAt,
        isStale: false,
      },
      update: {
        provider: params.provider,
        model: params.model,
        summary: params.result.summary,
        insights: payload as any,
        limitations: params.result.limitations as any,
        verifiedFacts: params.result.verifiedFacts as any,
        promptTokens: params.result.usage?.promptTokens || 0,
        completionTokens: params.result.usage?.completionTokens || 0,
        totalTokens: params.result.usage?.totalTokens || 0,
        fetchedAt: new Date(),
        expiresAt,
        isStale: false,
      },
    });
  }
}

export const aiInsightsCacheService = new AiInsightsCacheService();
