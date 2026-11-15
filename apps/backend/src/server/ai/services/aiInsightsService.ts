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

    // 2. Check Cache
    const queryHash = AiInsightsCacheService.generateHash({
      propertyId: property.id,
      dateRange,
      language,
      focus,
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

    // 3. Build Grounded Analytics Context
    const context = await AnalyticsContextBuilder.buildContext({
      workspaceId,
      propertyId: property.id,
      dateRange,
      refresh,
    });

    // 4. Build Facts Dictionary (for immutable O(1) fact lookup)
    const verifiedFacts: Record<string, DeterministicFact> = {};
    for (const fact of context.facts) {
      verifiedFacts[fact.factId] = fact;
    }

    // 5. Build Prompts
    const systemPrompt = InsightsPromptBuilder.getSystemPrompt(language);
    const userPrompt = InsightsPromptBuilder.getUserPrompt(context, focus);

    // 6. Call AI Provider
    const provider = AiProviderFactory.getProvider();
    const startTime = Date.now();
    let rawResponse;

    try {
      rawResponse = await provider.generateInsights(systemPrompt, userPrompt, {
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
            provider: provider.name,
            model: provider.defaultModel,
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
      throw err;
    }

    // 7. Parse and Validate Model Response with Zod
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
      // Bounded fallback: Map deterministic anomalies directly if validation failed
      console.warn("AI response validation warning, applying safe fallback structure:", validation.error.format());
      structuredSummary =
        parsedJson.summary ||
        `Analytics overview for ${context.displayName} across ${context.dateRange.label}.`;
      structuredInsights = context.anomalies.map((a) => ({
        type: a.type,
        severity: a.severity,
        title: a.title,
        explanation: a.description,
        factReferences: [a.metric],
        recommendations: ["Review marketing channel campaigns and landing page performance."],
      }));

      if (structuredInsights.length === 0) {
        structuredInsights = [
          {
            type: "general",
            severity: "info",
            title: "Performance Steady",
            explanation: `Total of ${context.summary.sessions} sessions and ${context.summary.activeUsers} active users recorded with an engagement rate of ${context.summary.engagementRate}%.`,
            factReferences: ["fact_total_sessions", "fact_engagement_rate"],
            recommendations: ["Continue tracking traffic acquisition and optimizing top converting channels."],
          },
        ];
      }
    }

    // 8. Construct Final Verified Result
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
      insights: structuredInsights,
      verifiedFacts,
      limitations: structuredLimitations,
      cache: {
        hit: false,
      },
      usage: {
        promptTokens: rawResponse.promptTokens,
        completionTokens: rawResponse.completionTokens,
        totalTokens: rawResponse.totalTokens,
      },
    };

    // 9. Persist to PostgreSQL Cache and Usage Log
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
