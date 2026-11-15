"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import { MetricCard, formatDuration, formatPercent } from "@/components/dashboard/MetricCard";
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorState,
  ReportHeader,
} from "@/components/dashboard/StateContainers";
import {
  Users,
  MousePointer,
  Eye,
  UserPlus,
  Percent,
  Activity,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function formatDateLabel(rawDate: string): string {
  if (!rawDate) return "";
  if (rawDate.length === 8) {
    const y = rawDate.substring(0, 4);
    const m = parseInt(rawDate.substring(4, 6), 10) - 1;
    const d = parseInt(rawDate.substring(6, 8), 10);
    const dateObj = new Date(Number(y), m, d);
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return rawDate;
}

export default function OverviewPage() {
  const { selectedProperty, dateRange, refreshKey, properties, loading: dashboardLoading } = useDashboard();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<"activeUsers" | "sessions" | "screenPageViews">("activeUsers");

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!selectedProperty) {
        setLoading(false);
        return;
      }

      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await api.getOverviewReport(selectedProperty.id, dateRange, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load overview analytics");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading analytics");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedProperty, dateRange]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  if (dashboardLoading) {
    return <DashboardLoadingSkeleton />;
  }

  if (properties.length === 0) {
    return (
      <EmptyState
        title="No Google Analytics Properties Linked"
        description="Link your first GA4 property to view live traffic metrics, engagement rates, and trend analysis."
        actionText="Link GA4 Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a connected property from the top header dropdown to view analytics."
      />
    );
  }

  if (loading) {
    return <DashboardLoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message="Unable to fetch GA4 Overview report"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const summary = data?.summary || {
    activeUsers: 0,
    totalUsers: 0,
    newUsers: 0,
    sessions: 0,
    screenPageViews: 0,
    engagementRate: 0,
    bounceRate: 0,
    averageSessionDuration: 0,
    eventCount: 0,
    conversions: 0,
  };

  const trend = (data?.trend || []).map((t: any) => ({
    ...t,
    formattedDate: formatDateLabel(t.date),
  }));

  const metadata = data?.metadata;

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Analytics Overview"
        description="High-level performance summary of your website traffic, user engagement, and core conversions."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        currencyCode={metadata?.currencyCode || selectedProperty.currencyCode}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Users"
          value={summary.activeUsers}
          metricKey="activeUsers"
          icon={Users}
          subtitle="Engaged visitors"
        />
        <MetricCard
          title="Total Sessions"
          value={summary.sessions}
          metricKey="sessions"
          icon={MousePointer}
          subtitle="Browsing periods"
        />
        <MetricCard
          title="Page Views"
          value={summary.screenPageViews}
          metricKey="screenPageViews"
          icon={Eye}
          subtitle="Total screens viewed"
        />
        <MetricCard
          title="New Users"
          value={summary.newUsers}
          metricKey="newUsers"
          icon={UserPlus}
          subtitle="First-time visitors"
        />
        <MetricCard
          title="Engagement Rate"
          value={formatPercent(summary.engagementRate)}
          metricKey="engagementRate"
          icon={Percent}
          subtitle="Engaged / total sessions"
        />
        <MetricCard
          title="Bounce Rate"
          value={formatPercent(summary.bounceRate)}
          metricKey="bounceRate"
          icon={Activity}
          subtitle="Non-engaged visits"
        />
        <MetricCard
          title="Avg Session Duration"
          value={formatDuration(summary.averageSessionDuration)}
          metricKey="averageSessionDuration"
          icon={Clock}
          subtitle="Time per session"
        />
        <MetricCard
          title="Key Events (Conversions)"
          value={summary.conversions}
          metricKey="conversions"
          icon={Target}
          subtitle="Marked goal events"
        />
      </div>

      {/* Interactive Trend Chart Card */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Traffic Trend Over Time
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Daily distribution of visitors and interactions for the selected timeframe.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveMetricTab("activeUsers")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeMetricTab === "activeUsers"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Active Users
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricTab("sessions")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeMetricTab === "sessions"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Sessions
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricTab("screenPageViews")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeMetricTab === "screenPageViews"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Page Views
            </button>
          </div>
        </div>

        {trend.length === 0 || trend.every((t: any) => t[activeMetricTab] === 0) ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <Activity className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              No traffic recorded in this date range
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
              Google Analytics Data API returned 0 recorded visits for this period. If your site was just launched, events can take 24–48 hours to appear in standard reports.
            </p>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-gray-900 text-white dark:bg-gray-800 text-xs rounded-lg p-2.5 shadow-lg border border-gray-700">
                          <div className="font-semibold text-gray-200 mb-1">{label}</div>
                          <div className="text-indigo-300 flex items-center gap-1.5 font-bold">
                            <span>
                              {activeMetricTab === "activeUsers"
                                ? "Active Users:"
                                : activeMetricTab === "sessions"
                                ? "Sessions:"
                                : "Page Views:"}
                            </span>
                            <span>{payload[0].value?.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={activeMetricTab}
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#metricGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-indigo-950 dark:text-indigo-200">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            Total recorded interactions across your site:{" "}
            <strong>{summary.eventCount.toLocaleString()} events</strong>.
          </span>
        </div>
        <div className="text-gray-500 dark:text-gray-400 text-[11px]">
          GA4 Data API v1beta
        </div>
      </div>
    </div>
  );
}
