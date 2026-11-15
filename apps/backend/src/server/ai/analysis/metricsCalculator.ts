import { DeterministicFact } from "../types/ai.types";
import { OverviewReport, TrafficReport, PagesReport } from "../../integrations/ga4/types/ga4.types";

export class MetricsCalculator {
  /**
   * Safe percentage calculator (avoids DivisionByZero).
   */
  static safePercentage(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0;
    const val = (numerator / denominator) * 100;
    return Number(val.toFixed(2));
  }

  /**
   * Safe ratio calculator.
   */
  static safeRatio(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0;
    const val = numerator / denominator;
    return Number(val.toFixed(2));
  }

  /**
   * Calculates deterministic facts from real GA4 reports.
   */
  static calculateFacts(
    overview: OverviewReport,
    traffic?: TrafficReport,
    pages?: PagesReport
  ): DeterministicFact[] {
    const summary = overview.summary;
    const facts: DeterministicFact[] = [];

    // 1. Core Summary Metrics
    facts.push({
      factId: "fact_active_users",
      metric: "activeUsers",
      currentValue: summary.activeUsers,
      formattedValue: summary.activeUsers.toLocaleString(),
      label: "Active Users",
    });

    facts.push({
      factId: "fact_total_sessions",
      metric: "sessions",
      currentValue: summary.sessions,
      formattedValue: summary.sessions.toLocaleString(),
      label: "Total Sessions",
    });

    facts.push({
      factId: "fact_new_users",
      metric: "newUsers",
      currentValue: summary.newUsers,
      formattedValue: summary.newUsers.toLocaleString(),
      label: "New Users",
    });

    facts.push({
      factId: "fact_page_views",
      metric: "screenPageViews",
      currentValue: summary.screenPageViews,
      formattedValue: summary.screenPageViews.toLocaleString(),
      label: "Page Views",
    });

    facts.push({
      factId: "fact_engagement_rate",
      metric: "engagementRate",
      currentValue: summary.engagementRate,
      formattedValue: `${summary.engagementRate.toFixed(1)}%`,
      label: "Engagement Rate",
    });

    facts.push({
      factId: "fact_bounce_rate",
      metric: "bounceRate",
      currentValue: summary.bounceRate,
      formattedValue: `${summary.bounceRate.toFixed(1)}%`,
      label: "Bounce Rate",
    });

    facts.push({
      factId: "fact_avg_session_duration",
      metric: "averageSessionDuration",
      currentValue: summary.averageSessionDuration,
      formattedValue: `${Math.round(summary.averageSessionDuration)}s`,
      label: "Average Session Duration",
    });

    facts.push({
      factId: "fact_conversions",
      metric: "conversions",
      currentValue: summary.conversions,
      formattedValue: summary.conversions.toLocaleString(),
      label: "Total Key Events (Count)",
    });

    // 2. Official GA4 Session Key Event Rate & Key Events per Session Ratio
    if (summary.sessionKeyEventRate !== undefined && summary.sessionKeyEventRate !== null) {
      facts.push({
        factId: "fact_session_key_event_rate",
        metric: "sessionKeyEventRate",
        currentValue: summary.sessionKeyEventRate,
        formattedValue: `${summary.sessionKeyEventRate.toFixed(2)}%`,
        label: "Session Key Event Rate (Official GA4)",
      });
    }

    const keyEventsPerSession = this.safeRatio(summary.conversions, summary.sessions);
    facts.push({
      factId: "fact_key_events_per_session",
      metric: "keyEventsPerSession",
      currentValue: keyEventsPerSession,
      formattedValue: keyEventsPerSession.toFixed(2),
      label: "Key Events per Session (Ratio)",
    });

    // Backwards-compatible conversion rate fact (uses official sessionKeyEventRate if available, or custom ratio)
    const conversionRate = summary.sessionKeyEventRate !== undefined && summary.sessionKeyEventRate !== null
      ? summary.sessionKeyEventRate
      : this.safePercentage(summary.conversions, summary.sessions);
    facts.push({
      factId: "fact_conversion_rate",
      metric: "conversionRate",
      currentValue: conversionRate,
      formattedValue: `${conversionRate.toFixed(2)}%`,
      label: summary.sessionKeyEventRate !== undefined
        ? "Session Key Event Rate"
        : "Key Events per Session Ratio",
    });

    const pagesPerSession = this.safeRatio(summary.screenPageViews, summary.sessions);
    facts.push({
      factId: "fact_pages_per_session",
      metric: "pagesPerSession",
      currentValue: pagesPerSession,
      formattedValue: pagesPerSession.toString(),
      label: "Pages per Session",
    });

    // 3. Channel Analysis
    if (traffic?.channels && traffic.channels.length > 0) {
      const sortedChannels = [...traffic.channels].sort((a, b) => b.sessions - a.sessions);
      const topChannel = sortedChannels[0];
      if (topChannel) {
        const topChannelShare = this.safePercentage(topChannel.sessions, summary.sessions);
        facts.push({
          factId: "fact_top_channel",
          metric: "topChannel",
          currentValue: topChannel.sessions,
          formattedValue: `${topChannel.channelGroup} (${topChannelShare}%)`,
          label: "Primary Traffic Channel",
        });
      }
    }

    // 4. Content Analysis
    if (pages?.pages && pages.pages.length > 0) {
      const sortedPages = [...pages.pages].sort((a, b) => b.screenPageViews - a.screenPageViews);
      const topPage = sortedPages[0];
      if (topPage) {
        facts.push({
          factId: "fact_top_page",
          metric: "topPage",
          currentValue: topPage.screenPageViews,
          formattedValue: `${topPage.pageTitle || topPage.pagePath} (${topPage.screenPageViews} views)`,
          label: "Most Viewed Page",
        });
      }
    }

    return facts;
  }
}
