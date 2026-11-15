import { prisma } from "@/server/database/prisma";
import {
  AiInsightsResult,
  AiLanguage,
  GenerateInsightsOptions,
  DeterministicFact,
  GeneratedInsightItem,
} from "../types/ai.types";
import { propertyRepository } from "../../integrations/ga4/repositories/propertyRepository";
import { AnalyticsContextBuilder } from "../grounding/analyticsContextBuilder";
import { InsightsPromptBuilder } from "../prompts/insightsPrompt";
import { AiProviderFactory } from "../providers/aiProviderFactory";
import { aiInsightsCacheService, AiInsightsCacheService } from "../caching/aiInsightsCache";
import { aiGeneratedResponseSchema } from "../validators/insightsSchemas";
import { AiQuotaManager } from "../security/aiQuotaManager";
import { AppError } from "@/lib/errors/appError";

export class AiInsightsService {
  /**
   * Cleans raw model output to safely isolate JSON payload.
   */
  private cleanJsonResponse(raw: string): string {
    let cleaned = raw.trim();
    // Remove markdown code fences if present
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return cleaned.trim();
  }

  /**
   * Main orchestrator: generates grounded, verified AI insights.
   */
  async generateInsights(options: GenerateInsightsOptions): Promise<AiInsightsResult> {
    const {
      workspaceId,
      userId,
      propertyId,
      dateRange = "30d",
      language = "en",
      focus,
      refresh = false,
    } = options;

    // 1. Verify property access in workspace
    const property = await propertyRepository.getProperty(workspaceId, propertyId);
    if (!property) {
      throw new AppError(
        `Connected property '${propertyId}' was not found in active workspace.`,
        404,
        "PROPERTY_NOT_FOUND"
      );
    }

    // 2. Check Fresh Cache (Zero-token fast path)
    const providerInstance = AiProviderFactory.getProvider();
    const queryHash = AiInsightsCacheService.generateHash({
      propertyId: property.id,
      dateRange,
      language,
      focus,
      provider: providerInstance.name,
      model: providerInstance.defaultModel,
      schemaVersion: "v2-structured",
    });

    if (!refresh) {
      const cached = await aiInsightsCacheService.get({
        connectedPropertyId: property.id,
        queryHash,
      });
      if (cached) {
        return cached;
      }
    }

    // 3. Check Quotas Before Calling LLM
    try {
      AiQuotaManager.checkWorkspaceLimit(workspaceId);
      await AiQuotaManager.checkGlobalProviderLimit(providerInstance.name, 1200);
    } catch (quotaErr: any) {
      // If rate limited, attempt graceful stale cache fallback
      if (quotaErr.status === 429 || quotaErr.statusCode === 429) {
        const stale = await aiInsightsCacheService.getStaleFallback({
          connectedPropertyId: property.id,
          maxAgeHours: 24,
        });
        if (stale) {
          return stale;
        }
      }
      throw quotaErr;
    }

    // 4. Build Grounded Analytics Context
    const context = await AnalyticsContextBuilder.buildContext({
      workspaceId,
      propertyId: property.id,
      dateRange,
      refresh,
    });

    // 5. Build Facts Dictionary (for immutable O(1) fact lookup)
    const verifiedFacts: Record<string, DeterministicFact> = {};
    for (const fact of context.facts) {
      verifiedFacts[fact.factId] = fact;
    }

    // 6. Build Prompts
    const systemPrompt = InsightsPromptBuilder.getSystemPrompt(language);
    const userPrompt = InsightsPromptBuilder.getUserPrompt(context, focus);

    // 7. Acquire In-Flight Concurrency Slot & Execute Provider Call
    const releaseSlot = await AiQuotaManager.acquireConcurrencySlot();
    const startTime = Date.now();
    let rawResponse;

    try {
      rawResponse = await providerInstance.generateInsights(systemPrompt, userPrompt, {
        maxTokens: 2048,
        timeoutMs: 25000,
      });
    } catch (err: any) {
      // Record failed usage log
      try {
        await prisma.aiUsageLog.create({
          data: {
            workspaceId,
            userId,
            connectedPropertyId: property.id,
            feature: "insights",
            provider: providerInstance.name,
            model: providerInstance.defaultModel,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            status: "ERROR",
            durationMs: Date.now() - startTime,
            errorMessage: err.message || "Provider call failed",
          },
        });
      } catch (logErr) {
        console.error("Failed to persist AI usage error log:", logErr);
      }

      // Check for stale fallback on provider 429
      if (err.status === 429 || err.statusCode === 429) {
        const stale = await aiInsightsCacheService.getStaleFallback({
          connectedPropertyId: property.id,
          maxAgeHours: 24,
        });
        if (stale) {
          return stale;
        }
      }

      throw err;
    } finally {
      releaseSlot();
    }

    // 8. Parse and Validate Model Response with Zod
    const cleanedJson = this.cleanJsonResponse(rawResponse.rawContent);
    let parsedJson: any;

    try {
      parsedJson = JSON.parse(cleanedJson);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON response:", cleanedJson);
      throw new AppError(
        "AI provider returned an invalid response format. Please try again.",
        502,
        "AI_RESPONSE_PARSE_ERROR"
      );
    }

    const validation = aiGeneratedResponseSchema.safeParse(parsedJson);
    let structuredSummary: string;
    let structuredInsights: GeneratedInsightItem[];
    let structuredLimitations: string[] = context.limitations;

    if (validation.success) {
      structuredSummary = validation.data.summary;
      structuredInsights = validation.data.insights;
      if (validation.data.limitations && validation.data.limitations.length > 0) {
        structuredLimitations = Array.from(
          new Set([...context.limitations, ...validation.data.limitations])
        );
      }
    } else {
      // Safe fallback: Map deterministic anomalies directly with 3-tier structure
      console.warn("AI response validation warning, applying safe fallback structure:", validation.error.format());
      structuredSummary =
        parsedJson.summary ||
        `Analytics overview for ${context.displayName} across ${context.dateRange.label}.`;
      structuredInsights = context.anomalies.map((a) => ({
        type: a.type,
        severity: a.severity,
        title: a.title,
        observation: a.description,
        hypothesis: "Statistical pattern detected; verify recent campaign traffic sources or site updates.",
        recommendation: "Review marketing channel campaigns and landing page performance.",
        factReferences: [a.metric],
        explanation: a.description,
        recommendations: ["Review marketing channel campaigns and landing page performance."],
      }));

      if (structuredInsights.length === 0) {
        structuredInsights = [
          {
            type: "general",
            severity: "info",
            title: "Performance Steady",
            observation: `Total of ${context.summary.sessions} sessions and ${context.summary.activeUsers} active users recorded with an engagement rate of ${context.summary.engagementRate}%.`,
            hypothesis: "Audience traffic and engagement show steady consistency over this reporting window.",
            recommendation: "Continue tracking traffic acquisition and optimizing top converting channels.",
            factReferences: ["fact_total_sessions", "fact_engagement_rate"],
            explanation: `Total of ${context.summary.sessions} sessions and ${context.summary.activeUsers} active users recorded.`,
            recommendations: ["Continue tracking traffic acquisition."],
          },
        ];
      }
    }

    // 9. Construct Final Verified Result (Strictly Nullable Health Score & Transparent Disclaimer)
    const nowIso = new Date().toISOString();
    const result: AiInsightsResult = {
      propertyId: property.id,
      dateRange: context.dateRange,
      language,
      generatedAt: nowIso,
      dataFetchedAt: context.dataFetchedAt,
      provider: rawResponse.provider,
      model: rawResponse.model,
      summary: structuredSummary,
      healthScore: null, // Nullable: never arbitrary
      insights: structuredInsights,
      verifiedFacts,
      limitations: structuredLimitations,
      disclaimer:
        "AI insights provide automated observations and hypotheses grounded in GA4 metrics. Hypotheses are unverified possibilities and should be verified before making business decisions.",
      cache: {
        hit: false,
      },
      usage: {
        promptTokens: rawResponse.promptTokens,
        completionTokens: rawResponse.completionTokens,
        totalTokens: rawResponse.totalTokens,
      },
    };

    // 10. Persist to PostgreSQL Cache and Usage Log
    try {
      await Promise.all([
        aiInsightsCacheService.set({
          workspaceId,
          connectedPropertyId: property.id,
          dateRange,
          language,
          queryHash,
          provider: rawResponse.provider,
          model: rawResponse.model,
          result,
        }),
        prisma.aiUsageLog.create({
          data: {
            workspaceId,
            userId,
            connectedPropertyId: property.id,
            feature: "insights",
            provider: rawResponse.provider,
            model: rawResponse.model,
            promptTokens: rawResponse.promptTokens,
            completionTokens: rawResponse.completionTokens,
            totalTokens: rawResponse.totalTokens,
            status: "SUCCESS",
            durationMs: rawResponse.durationMs,
          },
        }),
      ]);
    } catch (persistErr) {
      console.error("Non-fatal error persisting AI cache/usage log:", persistErr);
    }

    return result;
  }
}

export const aiInsightsService = new AiInsightsService();
