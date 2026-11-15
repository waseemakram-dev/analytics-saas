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
import { Globe, MapPin, Users, UserCheck } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

export default function AudiencePage() {
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
        const res = await api.getAudienceReport(selectedProperty.id, dateRange, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load audience report");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading audience data");
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
        description="Link your GA4 property to view visitor geography and audience makeup."
        actionText="Link GA4 Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a property from the top header to view audience analytics."
      />
    );
  }

  if (loading) return <DashboardLoadingSkeleton />;

  if (error) {
    return (
      <ErrorState
        message="Unable to fetch Audience report"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const countries = data?.countries || [];
  const cities = data?.cities || [];
  const userTypes = data?.userTypes || [];
  const metadata = data?.metadata;

  const topCountriesChart = countries.slice(0, 7).map((c: any) => ({
    country: c.country || "(not set)",
    users: c.activeUsers || 0,
    sessions: c.sessions || 0,
  }));

  const userTypeChartData = userTypes.map((u: any) => ({
    name: u.userType === "new" ? "New Visitors" : u.userType === "returning" ? "Returning Visitors" : u.userType,
    value: u.activeUsers || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Audience & Geography"
        description="Analyze where your visitors live across the globe, top target cities, and your balance of new versus returning users."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        currencyCode={metadata?.currencyCode || selectedProperty.currencyCode}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* Grid: Top Countries Bar Chart & User Types Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Countries Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Top Countries by Active Users
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            Leading international markets sending engaged traffic to your site.
          </p>

          {topCountriesChart.length === 0 || topCountriesChart.every((c: any) => c.users === 0) ? (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <Globe className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No geographic data recorded
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                Zero country visits were recorded by GA4 in the selected timeframe.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCountriesChart}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis
                    dataKey="country"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    width={100}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-lg border border-gray-700">
                            <div className="font-semibold text-gray-200 mb-1">{item.country}</div>
                            <div className="text-indigo-300">Active Users: {item.users.toLocaleString()}</div>
                            <div className="text-gray-400 text-[11px]">Sessions: {item.sessions.toLocaleString()}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="users" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* User Type Donut Chart */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                New vs Returning
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Balance between fresh acquisition and audience retention.
            </p>
          </div>

          {userTypeChartData.length === 0 || userTypeChartData.every((u: any) => u.value === 0) ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-400">
              No user type distribution available
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userTypeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {userTypeChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0];
                        return (
                          <div className="bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg">
                            <span className="font-semibold">{item.name}:</span> {item.value?.toLocaleString()} users
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

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
            {userTypeChartData.map((item: any, i: number) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="font-bold text-gray-900 dark:text-white mt-0.5 ml-4">
                  {item.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dual Tables: Countries Table & Cities Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Full Countries Table */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            All Countries
          </h3>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Country</th>
                  <th className="py-2.5 px-3">Active Users</th>
                  <th className="py-2.5 px-3">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {countries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      No country records.
                    </td>
                  </tr>
                ) : (
                  countries.map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                      <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                        {c.country || "(not set)"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                        {(c.activeUsers || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                        {(c.sessions || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cities Table */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-500" />
            Top Cities
          </h3>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Country</th>
                  <th className="py-2.5 px-3">Active Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {cities.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      No city records.
                    </td>
                  </tr>
                ) : (
                  cities.map((city: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                      <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                        {city.city || "(not set)"}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">
                        {city.country || "-"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                        {(city.activeUsers || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
