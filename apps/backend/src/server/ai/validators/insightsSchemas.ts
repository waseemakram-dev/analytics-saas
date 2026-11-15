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

export const aiGeneratedInsightItemSchema = z.object({
  type: z.enum(["traffic", "acquisition", "engagement", "content", "events", "general"]),
  severity: z.enum(["info", "positive", "warning", "critical"]),
  title: z.string().min(3).max(150),
  explanation: z.string().min(10).max(1000),
  factReferences: z.array(z.string()).default([]),
  recommendations: z.array(z.string().min(5).max(300)).default([]),
});

export const aiGeneratedResponseSchema = z.object({
  summary: z.string().min(10).max(3000),
  insights: z.array(aiGeneratedInsightItemSchema).min(1).max(10),
  limitations: z.array(z.string()).default([]),
});

export type AiGeneratedResponse = z.infer<typeof aiGeneratedResponseSchema>;
