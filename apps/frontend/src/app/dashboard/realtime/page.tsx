"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorState,
  ReportHeader,
} from "@/components/dashboard/StateContainers";
import {
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  FileText,
  Clock,
  Radio,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function RealtimePage() {
  const { selectedProperty, refreshKey, properties, loading: dashboardLoading } = useDashboard();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(30);
  const timerRef = useRef<any>(null);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!selectedProperty) {
        setLoading(false);
        return;
      }

      if (forceRefresh) setRefreshing(true);
      else if (!data) setLoading(true);
      setError(null);

      try {
        const res = await api.getRealtimeReport(selectedProperty.id, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
          setCountdown(30);
        } else {
          setError(res.error?.message || "Failed to load realtime analytics");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading realtime data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedProperty, data]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  if (dashboardLoading) return <DashboardLoadingSkeleton />;

  if (properties.length === 0) {
    return (
      <EmptyState
        title="No Properties Connected"
        description="Link a GA4 property to view realtime audience interactions."
        actionText="Link Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a property from the top header to view realtime analytics."
      />
    );
  }

  if (loading && !data) return <DashboardLoadingSkeleton />;

  if (error && !data) {
    return (
      <ErrorState
        message="Unable to fetch Realtime data"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const activeUsersLast30 = data?.activeUsersLast30Minutes || 0;
  const minuteData = (data?.minuteByMinute || []).map((m: any) => ({
    ...m,
    label: m.minuteAgo === 0 ? "now" : `${m.minuteAgo}m`,
  }));
  const countries = data?.byCountry || [];
  const devices = data?.byDevice || [];
  const topPages = data?.topPages || [];
  const metadata = data?.metadata;

  const getDeviceIcon = (cat: string) => {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("mobile")) return <Smartphone className="w-4 h-4 text-emerald-500" />;
    if (lower.includes("tablet")) return <Tablet className="w-4 h-4 text-amber-500" />;
    return <Monitor className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Realtime Activity"
        description="Live visitor activity on your website within the last 30 minutes, directly from GA4 runRealtimeReport."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* Auto-refresh control bar */}
      <div className="flex items-center justify-between text-xs bg-white dark:bg-gray-800/80 px-4 py-2.5 rounded-xl border border-gray-200/80 dark:border-gray-700/60 shadow-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            Live Stream Status:
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {autoRefresh ? `Updating in ${countdown}s` : "Paused"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-xs"
        >
          {autoRefresh ? "Pause Auto-Refresh" : "Enable Auto-Refresh"}
        </button>
      </div>

      {/* Hero Metric & Minute Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hero Card: 30-min count */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
          <div>
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-ping" />
              <span>Right Now</span>
            </div>
            <div className="text-5xl sm:text-6xl font-black tracking-tight mt-2 text-white">
              {activeUsersLast30.toLocaleString()}
            </div>
            <div className="text-indigo-200/80 text-sm mt-2">
              Active visitors on site in the last 30 minutes
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-indigo-800/60 text-xs text-indigo-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 30-minute window
            </span>
            <span>GA4 Realtime API</span>
          </div>
        </div>

        {/* Minute by Minute Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Users Per Minute
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Breakdown of active users across each of the preceding 30 minutes.
            </p>
          </div>

          <div className="h-44 w-full mt-4">
            {minuteData.length === 0 || minuteData.every((m: any) => m.activeUsers === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                No active visits in the last 30 minutes
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={minuteData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    interval={4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg">
                            <span className="font-semibold">
                              {item.minuteAgo === 0 ? "Current minute:" : `${item.minuteAgo} min ago:`}
                            </span>{" "}
                            {item.activeUsers} user{item.activeUsers !== 1 ? "s" : ""}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="activeUsers" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 3-Column Breakdown: Countries, Devices, Pages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Countries */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Top Active Countries
            </h3>
          </div>
          {countries.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No active geographic data</p>
          ) : (
            <div className="space-y-3">
              {countries.map((c: any, idx: number) => {
                const pct = activeUsersLast30 > 0 ? (c.activeUsers / activeUsersLast30) * 100 : 0;
                return (
                  <div key={idx} className="text-xs">
                    <div className="flex justify-between font-medium text-gray-800 dark:text-gray-200 mb-1">
                      <span>{c.country || "(not set)"}</span>
                      <span className="font-bold">{c.activeUsers}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Active Devices
            </h3>
          </div>
          {devices.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No active device data</p>
          ) : (
            <div className="space-y-3">
              {devices.map((d: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {getDeviceIcon(d.deviceCategory)}
                    <span className="font-medium capitalize text-gray-800 dark:text-gray-200">
                      {d.deviceCategory || "Desktop"}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {d.activeUsers}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Pages */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Top Active Pages
            </h3>
          </div>
          {topPages.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No active pages</p>
          ) : (
            <div className="space-y-2.5">
              {topPages.map((p: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-xs flex justify-between items-start gap-2"
                >
                  <div className="truncate flex-1">
                    <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {p.pageTitle || p.pagePath}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">
                      {p.pagePath}
                    </div>
                  </div>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                    {p.activeUsers}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
