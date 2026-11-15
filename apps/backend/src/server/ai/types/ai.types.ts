/**
 * AI Analytics Intelligence Domain Types (Stage 4A)
 */

export type AiLanguage = "en" | "roman-ur";

export type InsightType =
  | "traffic"
  | "acquisition"
  | "engagement"
  | "content"
  | "events"
  | "general";

export type InsightSeverity = "info" | "positive" | "warning" | "critical";

export interface DeterministicFact {
  factId: string;
  metric: string;
  currentValue: number;
  previousValue?: number;
  deltaAbsolute?: number;
  deltaPercentage?: number;
  formattedValue: string;
  label: string;
}

export interface DeterministicAnomaly {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  metric: string;
  title: string;
  description: string;
  deltaPercentage?: number;
  isStatisticallySignificant: boolean;
  sampleSizeWarning?: boolean;
}

export interface AnalyticsGroundingContext {
  propertyId: string;
  displayName: string;
  timeZone: string;
  currencyCode: string;
  dateRange: {
    startDate: string;
    endDate: string;
    label: string;
  };
  dataFetchedAt: string;
  summary: {
    activeUsers: number;
    totalUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    engagementRate: number; // 0-100%
    bounceRate: number;     // 0-100%
    averageSessionDuration: number; // seconds
    conversions: number;
    eventCount: number;
    sessionKeyEventRate?: number; // Official GA4 Session Key Event Rate (Percentage 0-100)
  };
  channels: Array<{
    channelGroup: string;
    sessions: number;
    activeUsers: number;
    engagementRate: number;
    conversions: number;
  }>;
  topPages: Array<{
    pagePath: string;
    pageTitle: string;
    screenPageViews: number;
    activeUsers: number;
    averageEngagementTime: number;
  }>;
  facts: DeterministicFact[];
  anomalies: DeterministicAnomaly[];
  limitations: string[];
}

export interface GeneratedInsightItem {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  observation: string; // Grounded finding directly supported by verified GA4 data
  hypothesis: string;  // Plausible explanation using conditional language (not confirmed cause)
  recommendation: string; // Actionable test or practical next step
  factReferences: string[];
  explanation?: string; // Backwards-compatible alias for observation
  recommendations?: string[]; // Backwards-compatible alias for array of recommendations
}

export interface AiInsightsResult {
  propertyId: string;
  dateRange: {
    startDate: string;
    endDate: string;
    label: string;
  };
  language: AiLanguage;
  generatedAt: string;
  dataFetchedAt: string;
  provider: string;
  model: string;
  summary: string;
  healthScore?: number | null; // Nullable until validated, configurable methodology is established
  insights: GeneratedInsightItem[];
  verifiedFacts: Record<string, DeterministicFact>;
  limitations: string[];
  disclaimer?: string;
  cache: {
    hit: boolean;
    cachedAt?: string;
    expiresAt?: string;
    isStale?: boolean;
    staleNotice?: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateInsightsOptions {
  workspaceId: string;
  userId: string;
  propertyId: string;
  dateRange?: string;
  language?: AiLanguage;
  focus?: InsightType;
  refresh?: boolean;
}
