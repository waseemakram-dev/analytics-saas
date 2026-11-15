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
  explanation: string;
  factReferences: string[];
  recommendations: string[];
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
  insights: GeneratedInsightItem[];
  verifiedFacts: Record<string, DeterministicFact>;
  limitations: string[];
  cache: {
    hit: boolean;
    cachedAt?: string;
    expiresAt?: string;
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
