import { AnalyticsGroundingContext } from "../types/ai.types";
import { ga4DataService } from "../../integrations/ga4/services/ga4DataService";
import { MetricsCalculator } from "../analysis/metricsCalculator";
import { AnomalyDetector } from "../analysis/anomalyDetector";

export class AnalyticsContextBuilder {
  /**
   * Sanitizes untrusted analytics strings (page titles, URLs, channel names)
   * to mitigate prompt injection attempts embedded in web analytics content.
   */
  static sanitizeString(input: string | null | undefined, maxLength = 80): string {
    if (!input) return "";
    return input
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Strip control characters
      .replace(/[\`\{\}\[\]\<\>\\]/g, "")           // Strip bracket/delimiters
      .replace(/(system:|assistant:|user:|prompt:)/gi, "") // Neutralize role injection
      .trim()
      .slice(0, maxLength);
  }

  /**
   * Builds an authenticated, sanitized, and deterministically verified analytics context.
   */
  static async buildContext(params: {
    workspaceId: string;
    propertyId: string;
    dateRange?: string;
    refresh?: boolean;
  }): Promise<AnalyticsGroundingContext> {
    const { workspaceId, propertyId, dateRange = "30d", refresh = false } = params;

    // 1. Fetch real reports using internal GA4 service
    const overview = await ga4DataService.getOverview({
      workspaceId,
      propertyId,
      dateRange,
      refresh,
    });

    let traffic;
    try {
      traffic = await ga4DataService.getTrafficAcquisition({
        workspaceId,
        propertyId,
        dateRange,
        refresh,
      });
    } catch {
      // Graceful fallback if traffic report is unavailable
    }

    let pages;
    try {
      pages = await ga4DataService.getPagesAndContent({
        workspaceId,
        propertyId,
        dateRange,
        refresh,
      });
    } catch {
      // Graceful fallback if pages report is unavailable
    }

    // 2. Compute deterministic facts and anomalies
    const facts = MetricsCalculator.calculateFacts(overview, traffic, pages);
    const anomalies = AnomalyDetector.detect(overview, traffic);

    // 3. Compact & sanitize channel data
    const channels = (traffic?.channels || []).slice(0, 6).map((c: any) => ({
      channelGroup: this.sanitizeString(c.channelGroup, 40),
      sessions: c.sessions || 0,
      activeUsers: c.activeUsers || 0,
      engagementRate: Number((c.engagementRate || 0).toFixed(1)),
      conversions: c.conversions || 0,
    }));

    // 4. Compact & sanitize top page data
    const topPages = (pages?.pages || []).slice(0, 5).map((p: any) => ({
      pagePath: this.sanitizeString(p.pagePath, 60),
      pageTitle: this.sanitizeString(p.pageTitle, 70),
      screenPageViews: p.screenPageViews || 0,
      activeUsers: p.activeUsers || 0,
      averageEngagementTime: Math.round(p.averageEngagementTime || 0),
    }));

    // 5. Build data limitations list
    const limitations: string[] = [];
    if (overview.summary.sessions === 0) {
      limitations.push("Property has 0 recorded sessions in this date range.");
    } else if (overview.summary.sessions < 20) {
      limitations.push("Small sample size (<20 sessions); rate fluctuations are statistically volatile.");
    }
    if (!traffic?.channels || traffic.channels.length === 0) {
      limitations.push("Channel breakdown data is currently unavailable.");
    }
    if (overview.metadata.isStale) {
      limitations.push("Analytics data was retrieved from cached state.");
    }

    return {
      propertyId: overview.metadata.propertyId,
      displayName: this.sanitizeString(overview.metadata.displayName || "Website", 50),
      timeZone: overview.metadata.timeZone || "UTC",
      currencyCode: overview.metadata.currencyCode || "USD",
      dateRange: {
        startDate: overview.metadata.startDate || "N/A",
        endDate: overview.metadata.endDate || "N/A",
        label: overview.metadata.dateRange || dateRange,
      },
      dataFetchedAt: overview.metadata.fetchedAt,
      summary: overview.summary,
      channels,
      topPages,
      facts,
      anomalies,
      limitations,
    };
  }
}
