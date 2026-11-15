"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorState,
  ReportHeader,
} from "@/components/dashboard/StateContainers";
import { Monitor, Smartphone, Tablet, Globe, Cpu } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#4f46e5",
  mobile: "#10b981",
  tablet: "#f59e0b",
  smart_tv: "#8b5cf6",
};

export default function TechnologyPage() {
  const { selectedProperty, dateRange, refreshKey, properties, loading: dashboardLoading } = useDashboard();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        const res = await api.getTechnologyReport(selectedProperty.id, dateRange, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load technology report");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading technology data");
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
        description="Link your GA4 property to view visitor devices and browser technologies."
        actionText="Link GA4 Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a property from the top header to view technology analytics."
      />
    );
  }

  if (loading) return <DashboardLoadingSkeleton />;

  if (error) {
    return (
      <ErrorState
        message="Unable to fetch Technology report"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const deviceCategories = data?.deviceCategories || [];
  const browsers = data?.browsers || [];
  const operatingSystems = data?.operatingSystems || [];
  const metadata = data?.metadata;

  const devicePieData = deviceCategories.map((d: any) => ({
    name: (d.category || "desktop").toLowerCase(),
    displayName: (d.category || "Desktop").charAt(0).toUpperCase() + (d.category || "desktop").slice(1),
    value: d.activeUsers || 0,
    sessions: d.sessions || 0,
  }));

  const browserChartData = browsers.slice(0, 6).map((b: any) => ({
    name: b.browser || "(not set)",
    users: b.activeUsers || 0,
    sessions: b.sessions || 0,
  }));

  const getDeviceIcon = (category: string) => {
    const c = (category || "").toLowerCase();
    if (c === "mobile") return <Smartphone className="w-5 h-5 text-emerald-500" />;
    if (c === "tablet") return <Tablet className="w-5 h-5 text-amber-500" />;
    return <Monitor className="w-5 h-5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Technology & Devices"
        description="Discover the hardware and software your visitors use to browse your site, from device form factors to operating systems and web browsers."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        currencyCode={metadata?.currencyCode || selectedProperty.currencyCode}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* Device Categories Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4 text-indigo-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Device Breakdown
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Distribution of active users across desktop, mobile, and tablet.
            </p>
          </div>

          {devicePieData.length === 0 || devicePieData.every((d: any) => d.value === 0) ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-400">
              No device category data available
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={devicePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {devicePieData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DEVICE_COLORS[entry.name] || "#6366f1"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg">
                            <span className="font-semibold">{item.displayName}:</span> {item.value?.toLocaleString()} users ({item.sessions} sessions)
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50">
            {devicePieData.map((d: any, idx: number) => (
              <div key={idx} className="text-center text-xs">
                <div className="text-gray-500 dark:text-gray-400 text-[11px] font-medium">{d.displayName}</div>
                <div className="font-bold text-gray-900 dark:text-white text-sm mt-0.5">
                  {d.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Browsers Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Web Browsers
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            Leading browser platforms used by your visitors (Chrome, Safari, Edge, Firefox).
          </p>

          {browserChartData.length === 0 || browserChartData.every((b: any) => b.users === 0) ? (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <Globe className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No browser analytics recorded
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                Zero browser sessions logged in the selected timeframe.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={browserChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-lg border border-gray-700">
                            <div className="font-semibold text-gray-200 mb-1">{label}</div>
                            <div className="text-indigo-300">Active Users: {payload[0].value?.toLocaleString()}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="users" name="Active Users" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Operating Systems Table */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Operating Systems
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Operating System</th>
                <th className="py-3 px-3">Active Users</th>
                <th className="py-3 px-3">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {operatingSystems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-400">
                    No operating systems recorded.
                  </td>
                </tr>
              ) : (
                operatingSystems.map((os: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                      {os.os || "(not set)"}
                    </td>
                    <td className="py-3 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                      {(os.activeUsers || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300">
                      {(os.sessions || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
