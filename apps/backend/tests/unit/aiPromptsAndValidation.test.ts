import { describe, it, expect } from "vitest";
import { InsightsPromptBuilder } from "@/server/ai/prompts/insightsPrompt";
import { aiGeneratedResponseSchema } from "@/server/ai/validators/insightsSchemas";
import { AnalyticsGroundingContext } from "@/server/ai/types/ai.types";

describe("AI Prompts & Schema Validation", () => {
  const dummyContext: AnalyticsGroundingContext = {
    propertyId: "564325115",
    displayName: "Production App",
    timeZone: "Etc/GMT",
    currencyCode: "GBP",
    dateRange: {
      startDate: "2026-10-15",
      endDate: "2026-11-14",
      label: "30d",
    },
    dataFetchedAt: new Date().toISOString(),
    summary: {
      activeUsers: 100,
      totalUsers: 120,
      newUsers: 90,
      sessions: 250,
      screenPageViews: 800,
      engagementRate: 62.0,
      bounceRate: 38.0,
      averageSessionDuration: 110,
      conversions: 15,
      eventCount: 1500,
    },
    channels: [],
    topPages: [],
    facts: [
      {
        factId: "fact_total_sessions",
        metric: "sessions",
        currentValue: 250,
        formattedValue: "250",
        label: "Total Sessions",
      },
      {
        factId: "fact_engagement_rate",
        metric: "engagementRate",
        currentValue: 62.0,
        formattedValue: "62.0%",
        label: "Engagement Rate",
      },
    ],
    anomalies: [],
    limitations: [],
  };

  it("should generate distinct system prompt for Roman Urdu and English", () => {
    const enPrompt = InsightsPromptBuilder.getSystemPrompt("en");
    const urPrompt = InsightsPromptBuilder.getSystemPrompt("roman-ur");

    expect(enPrompt).toContain("clear, professional, executive-level English");
    expect(urPrompt).toContain("natural, professional Roman Urdu");
    expect(urPrompt).toContain("Sessions, Active Users, Bounce Rate");
  });

  it("should embed verified deterministic facts in the user prompt", () => {
    const userPrompt = InsightsPromptBuilder.getUserPrompt(dummyContext, "traffic");

    expect(userPrompt).toContain("VERIFIED GA4 ANALYTICS CONTEXT");
    expect(userPrompt).toContain("564325115");
    expect(userPrompt).toContain("[fact_total_sessions] Total Sessions: 250");
    expect(userPrompt).toContain("[fact_engagement_rate] Engagement Rate: 62.0%");
    expect(userPrompt).toContain("FOCUS AREA: Prioritize insights specifically relevant to 'traffic'");
  });

  it("should validate a conforming structured model response with 3-tier structure and nullable healthScore", () => {
    const validModelOutput = {
      summary: "Traffic demonstrated strong consistency with 250 sessions and solid 62% engagement.",
      healthScore: null,
      insights: [
        {
          type: "traffic",
          severity: "positive",
          title: "Solid Audience Engagement",
          observation: "Engagement rate remained high at 62%, supported by 250 recorded sessions.",
          hypothesis: "Strong brand resonance or targeted organic acquisition may be driving engaged visits.",
          recommendation: "Maintain current content structure on top landing pages and test call-to-actions.",
          factReferences: ["fact_engagement_rate", "fact_total_sessions"],
        },
      ],
      limitations: [],
    };

    const parsed = aiGeneratedResponseSchema.safeParse(validModelOutput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.healthScore).toBeNull();
      expect(parsed.data.insights[0].observation).toContain("Engagement rate");
      expect(parsed.data.insights[0].hypothesis).toContain("Strong brand resonance");
      expect(parsed.data.insights[0].recommendation).toContain("Maintain current content");
    }
  });

  it("should enforce 3-tier rules in both English and Roman Urdu system prompts", () => {
    const enPrompt = InsightsPromptBuilder.getSystemPrompt("en");
    const urPrompt = InsightsPromptBuilder.getSystemPrompt("roman-ur");

    expect(enPrompt).toContain("3-TIER INSIGHT STRUCTURE");
    expect(enPrompt).toContain("observation");
    expect(enPrompt).toContain("hypothesis");
    expect(enPrompt).toContain("recommendation");
    expect(enPrompt).toContain("NO ARBITRARY HEALTH SCORES");

    expect(urPrompt).toContain("observations, hypotheses, and recommendations in natural, professional Roman Urdu");
    expect(urPrompt).toContain("NO ARBITRARY HEALTH SCORES");
  });

  it("should reject model output that violates the schema", () => {
    const invalidOutput = {
      summary: "Short", // Too short
      insights: [
        {
          type: "invalid_type_name", // Invalid enum
          severity: "urgent", // Invalid enum
          title: "Bad",
          explanation: "Missing data",
        },
      ],
    };

    const parsed = aiGeneratedResponseSchema.safeParse(invalidOutput);
    expect(parsed.success).toBe(false);
  });
});
