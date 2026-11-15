import { z } from "zod";

export const linkPropertySchema = z.object({
  integrationAccountId: z.string().min(1, "Integration account ID is required"),
  propertyId: z.string().min(1, "GA4 Property ID is required"),
  displayName: z.string().min(1).optional(),
  parentAccount: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  timeZone: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const analyticsQuerySchema = z.object({
  propertyId: z.string().min(1).optional(),
  dateRange: z.string().optional().default("30d"),
  refresh: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
});

export const oauthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});
