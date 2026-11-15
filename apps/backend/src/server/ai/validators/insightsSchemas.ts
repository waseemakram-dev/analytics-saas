import { z } from "zod";

export const generateInsightsInputSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  dateRange: z.string().default("30d"),
  language: z.enum(["en", "roman-ur"]).default("en"),
  focus: z
    .enum(["traffic", "acquisition", "engagement", "content", "events", "general"])
    .optional(),
  refresh: z.boolean().default(false),
});

export type GenerateInsightsInput = z.infer<typeof generateInsightsInputSchema>;

export const aiGeneratedInsightItemSchema = z
  .object({
    type: z.enum(["traffic", "acquisition", "engagement", "content", "events", "general"]),
    severity: z.enum(["info", "positive", "warning", "critical"]),
    title: z.string().min(3).max(150),
    observation: z.string().min(5).max(1000).optional(),
    hypothesis: z.string().min(5).max(1000).optional(),
    recommendation: z.string().min(5).max(1000).optional(),
    factReferences: z.array(z.string()).default([]),
    // Backwards-compatible fallback inputs
    explanation: z.string().optional(),
    recommendations: z.array(z.string()).optional(),
  })
  .transform((item) => {
    const observation =
      item.observation || item.explanation || "Observation based on verified analytics data.";
    const hypothesis =
      item.hypothesis ||
      "Performance may be influenced by campaign timing, audience mix, or seasonal variations.";
    const recommendation =
      item.recommendation ||
      (item.recommendations && item.recommendations[0]) ||
      "Continue monitoring channel acquisition and review landing page engagement metrics.";

    return {
      type: item.type,
      severity: item.severity,
      title: item.title,
      observation,
      hypothesis,
      recommendation,
      factReferences: item.factReferences,
      explanation: observation,
      recommendations: item.recommendations || [recommendation],
    };
  });

export const aiGeneratedResponseSchema = z.object({
  summary: z.string().min(10).max(3000),
  healthScore: z.number().nullable().optional(), // Nullable: prevents arbitrary unscientific score generation
  insights: z.array(aiGeneratedInsightItemSchema).min(1).max(10),
  limitations: z.array(z.string()).default([]),
});

export type AiGeneratedResponse = z.infer<typeof aiGeneratedResponseSchema>;
