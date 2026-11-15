"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import { formatPercent } from "@/components/dashboard/MetricCard";
import { MetricTooltip } from "@/components/dashboard/MetricTooltip";
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorState,
  ReportHeader,
} from "@/components/dashboard/StateContainers";
import {
  TrendingUp,
  ArrowUpDown,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function TrafficPage() {
  const { selectedProperty, dateRange, refreshKey, properties, loading: dashboardLoading } = useDashboard();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<string>("sessions");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

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
        const res = await api.getTrafficReport(selectedProperty.id, dateRange, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load traffic acquisition report");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading traffic data");
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

  if (dashboardLoading) return <DashboardLoadingSkeleton />;

  if (properties.length === 0) {
    return (
      <EmptyState
        title="No Properties Connected"
        description="Link your GA4 property to view acquisition channel data."
        actionText="Link GA4 Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a property from the top header to view traffic channels."
      />
    );
  }

  if (loading) return <DashboardLoadingSkeleton />;

  if (error) {
    return (
      <ErrorState
        message="Unable to fetch Traffic Acquisition report"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const rawChannels = data?.channels || [];
  const metadata = data?.metadata;

  const filteredChannels = rawChannels
    .filter((c: any) =>
      (c.channelGroup || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.sourceMedium || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      return sortAsc ? valA - valB : valB - valA;
    });

  const chartData = rawChannels.slice(0, 8).map((c: any) => ({
    name: c.channelGroup || "Unassigned",
    sessions: c.sessions || 0,
    users: c.activeUsers || 0,
  }));

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getMetricKeyForChannel = (name: string) => {
    const lower = (name || "").toLowerCase();
    if (lower.includes("direct")) return "direct";
    if (lower.includes("organic search")) return "organicSearch";
    if (lower.includes("referral")) return "referral";
    if (lower.includes("organic social")) return "organicSocial";
    if (lower.includes("unassigned")) return "unassigned";
    return undefined;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Traffic Acquisition"
        description="Understand which marketing channels (search engines, direct links, social media, referrals) drive visitors to your site."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        currencyCode={metadata?.currencyCode || selectedProperty.currencyCode}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* Chart Section */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Top Channels by Sessions & Users
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          Compare total visits and engaged audience by default channel group.
        </p>

        {chartData.length === 0 || chartData.every((c: any) => c.sessions === 0) ? (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <TrendingUp className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              No channel visits recorded
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
              No traffic sources have been categorized yet for this property in the selected date range.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="name"
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
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-lg border border-gray-700">
                          <div className="font-semibold text-gray-200 mb-1">{label}</div>
                          {payload.map((entry: any, i: number) => (
                            <div key={i} className="flex justify-between gap-4 text-xs">
                              <span className="text-gray-400 capitalize">{entry.name}:</span>
                              <span className="font-bold text-indigo-300">{entry.value?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sessions" name="Sessions" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" name="Active Users" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Channel Performance Table */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Channel Performance Breakdown
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Detailed breakdown of session volume, user quality, engagement rates, and conversions.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search channels..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Channel Group</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("sessions")}
                >
                  <div className="flex items-center gap-1">
                    <span>Sessions</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("activeUsers")}
                >
                  <div className="flex items-center gap-1">
                    <span>Active Users</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("newUsers")}
                >
                  <div className="flex items-center gap-1">
                    <span>New Users</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("engagementRate")}
                >
                  <div className="flex items-center gap-1">
                    <span>Engagement Rate</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("conversions")}
                >
                  <div className="flex items-center gap-1">
                    <span>Conversions</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Event Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredChannels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No matching channels found.
                  </td>
                </tr>
              ) : (
                filteredChannels.map((c: any, idx: number) => {
                  const mKey = getMetricKeyForChannel(c.channelGroup);
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>{c.channelGroup || "Unassigned"}</span>
                        {mKey && <MetricTooltip metricKey={mKey} />}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800 dark:text-gray-200">
                        {(c.sessions || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {(c.activeUsers || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {(c.newUsers || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {formatPercent(c.engagementRate || 0)}
                      </td>
                      <td className="py-3 px-3 font-medium text-indigo-600 dark:text-indigo-400">
                        {(c.conversions || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                        {(c.eventCount || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
