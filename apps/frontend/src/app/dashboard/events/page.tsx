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
import { Zap, Search, ArrowUpDown, Tag } from "lucide-react";

export default function EventsReportPage() {
  const { selectedProperty, dateRange, refreshKey, properties, loading: dashboardLoading } = useDashboard();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<string>("eventCount");
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
        const res = await api.getEventsReport(selectedProperty.id, dateRange, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load events report");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading events data");
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
        description="Link your GA4 property to view custom and automatically collected events."
        actionText="Link GA4 Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a property from the top header to view event analytics."
      />
    );
  }

  if (loading) return <DashboardLoadingSkeleton />;

  if (error) {
    return (
      <ErrorState
        message="Unable to fetch Events report"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const events = data?.events || [];
  const metadata = data?.metadata;

  const filteredEvents = events
    .filter((e: any) =>
      (e.eventName || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      return sortAsc ? valA - valB : valB - valA;
    });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Event Tracking"
        description="Monitor user actions and interactions triggered across your site, from standard page views and scrolls to custom conversion events."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        currencyCode={metadata?.currencyCode || selectedProperty.currencyCode}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* Events Table Card */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Recorded Events
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Showing {filteredEvents.length} distinct GA4 events.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by event name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Event Name</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("eventCount")}
                >
                  <div className="flex items-center gap-1">
                    <span>Event Count</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("totalUsers")}
                >
                  <div className="flex items-center gap-1">
                    <span>Total Users</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("eventCountPerUser")}
                >
                  <div className="flex items-center gap-1">
                    <span>Count Per User</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    No events recorded in this date range.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e: any, idx: number) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{e.eventName}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                      {(e.eventCount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {(e.totalUsers || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {Number(e.eventCountPerUser || 0).toFixed(2)}
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
