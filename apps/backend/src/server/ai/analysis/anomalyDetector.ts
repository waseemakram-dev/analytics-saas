import { DeterministicAnomaly } from "../types/ai.types";
import { OverviewReport, TrafficReport } from "../../integrations/ga4/types/ga4.types";

export class AnomalyDetector {
  /**
   * Deterministically identifies anomalies and critical changes.
   */
  static detect(overview: OverviewReport, traffic?: TrafficReport): DeterministicAnomaly[] {
    const anomalies: DeterministicAnomaly[] = [];
    const summary = overview.summary;

    // 1. Zero Traffic State
    if (summary.sessions === 0 && summary.activeUsers === 0) {
      anomalies.push({
        id: "anomaly_zero_traffic",
        type: "traffic",
        severity: "warning",
        metric: "sessions",
        title: "No Traffic Activity Recorded",
        description:
          "Zero sessions and zero active users were recorded by Google Analytics for this property in the selected date range.",
        isStatisticallySignificant: true,
        sampleSizeWarning: false,
      });
      return anomalies;
    }

    // 2. Small Sample Size Flag
    const isSmallSample = summary.sessions < 20;
    if (isSmallSample) {
      anomalies.push({
        id: "anomaly_small_sample",
        type: "general",
        severity: "info",
        metric: "sessions",
        title: "Low Volume / Small Sample Size",
        description: `With only ${summary.sessions} sessions recorded, percentage variations should be interpreted cautiously as random variance is high.`,
        isStatisticallySignificant: false,
        sampleSizeWarning: true,
      });
    }

    // 3. Trend Anomalies (Comparing first half vs second half of date range)
    const trend = overview.trend || [];
    if (trend.length >= 6) {
      const mid = Math.floor(trend.length / 2);
      const firstHalf = trend.slice(0, mid);
      const secondHalf = trend.slice(mid);

      const firstHalfSessions = firstHalf.reduce((sum, d) => sum + (d.sessions || 0), 0);
      const secondHalfSessions = secondHalf.reduce((sum, d) => sum + (d.sessions || 0), 0);

      if (firstHalfSessions > 10 && secondHalfSessions >= 0) {
        const delta = secondHalfSessions - firstHalfSessions;
        const pctChange = (delta / firstHalfSessions) * 100;

        if (pctChange <= -30 && Math.abs(delta) >= 15) {
          anomalies.push({
            id: "anomaly_session_drop",
            type: "traffic",
            severity: "warning",
            metric: "sessions",
            title: "Significant Session Decline",
            description: `Sessions declined by ${Math.abs(Math.round(pctChange))}% across the recent period (from ${firstHalfSessions} down to ${secondHalfSessions} sessions).`,
            deltaPercentage: Number(pctChange.toFixed(1)),
            isStatisticallySignificant: !isSmallSample,
            sampleSizeWarning: isSmallSample,
          });
        } else if (pctChange >= 40 && delta >= 15) {
          anomalies.push({
            id: "anomaly_session_surge",
            type: "traffic",
            severity: "positive",
            metric: "sessions",
            title: "Strong Traffic Growth",
            description: `Sessions increased by ${Math.round(pctChange)}% in the latter half of this timeframe (from ${firstHalfSessions} up to ${secondHalfSessions} sessions).`,
            deltaPercentage: Number(pctChange.toFixed(1)),
            isStatisticallySignificant: !isSmallSample,
            sampleSizeWarning: isSmallSample,
          });
        }
      }
    }

    // 4. Engagement Health Anomalies
    if (summary.sessions >= 20) {
      if (summary.engagementRate < 35) {
        anomalies.push({
          id: "anomaly_low_engagement",
          type: "engagement",
          severity: "warning",
          metric: "engagementRate",
          title: "Below-Average Engagement Rate",
          description: `Engagement rate is at ${summary.engagementRate.toFixed(1)}%, indicating that over ${(100 - summary.engagementRate).toFixed(1)}% of visits exited without meaningful interaction.`,
          isStatisticallySignificant: true,
          sampleSizeWarning: false,
        });
      } else if (summary.engagementRate >= 70) {
        anomalies.push({
          id: "anomaly_high_engagement",
          type: "engagement",
          severity: "positive",
          metric: "engagementRate",
          title: "High Audience Engagement",
          description: `Engagement rate reached ${summary.engagementRate.toFixed(1)}%, well above typical industry benchmarks of 50-60%.`,
          isStatisticallySignificant: true,
          sampleSizeWarning: false,
        });
      }
    }

    // 5. Channel Concentration Risk
    if (traffic?.channels && traffic.channels.length > 1 && summary.sessions >= 30) {
      const topChannel = traffic.channels.reduce((prev, curr) =>
        curr.sessions > prev.sessions ? curr : prev
      );
      const topShare = (topChannel.sessions / summary.sessions) * 100;

      if (topShare >= 80) {
        anomalies.push({
          id: "anomaly_channel_concentration",
          type: "acquisition",
          severity: "info",
          metric: "channels",
          title: "High Single-Channel Concentration",
          description: `The '${topChannel.channelGroup}' channel accounts for ${topShare.toFixed(1)}% of your total website sessions. Diversifying acquisition channels reduces reliance risk.`,
          isStatisticallySignificant: true,
          sampleSizeWarning: false,
        });
      }
    }

    return anomalies;
  }
}
