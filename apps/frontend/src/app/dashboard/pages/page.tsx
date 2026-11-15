"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import { formatDuration, formatPercent } from "@/components/dashboard/MetricCard";
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorState,
  ReportHeader,
} from "@/components/dashboard/StateContainers";
import { FileText, Search, ArrowUpDown, ExternalLink } from "lucide-react";

export default function PagesReportPage() {
  const { selectedProperty, dateRange, refreshKey, properties, loading: dashboardLoading } = useDashboard();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<string>("screenPageViews");
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
        const res = await api.getPagesReport(selectedProperty.id, dateRange, forceRefresh);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load pages & screens report");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading page data");
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
        description="Link your GA4 property to view your most visited pages and screen views."
        actionText="Link GA4 Property"
        actionHref="/dashboard/websites"
      />
    );
  }

  if (!selectedProperty) {
    return (
      <EmptyState
        title="No Property Selected"
        description="Please select a property from the top header to view page performance."
      />
    );
  }

  if (loading) return <DashboardLoadingSkeleton />;

  if (error) {
    return (
      <ErrorState
        message="Unable to fetch Pages & Screens report"
        details={error}
        onRetry={() => fetchData(true)}
      />
    );
  }

  const pages = data?.pages || [];
  const metadata = data?.metadata;

  const filteredPages = pages
    .filter((p: any) =>
      (p.pageTitle || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.pagePath || "").toLowerCase().includes(searchTerm.toLowerCase())
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
        title="Pages & Screen Views"
        description="Evaluate content performance: identify which landing pages attract the most attention, where visitors spend the most time, and where bounce rates are highest."
        propertyName={metadata?.displayName || selectedProperty.displayName}
        timeZone={metadata?.timeZone || selectedProperty.timeZone}
        currencyCode={metadata?.currencyCode || selectedProperty.currencyCode}
        isCached={metadata?.isCached}
        fetchedAt={metadata?.fetchedAt}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
      />

      {/* Pages Table Card */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Content Performance
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Showing {filteredPages.length} pages recorded by GA4 runReport.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or URL path..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Page Title & Path</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("screenPageViews")}
                >
                  <div className="flex items-center gap-1">
                    <span>Views</span>
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
                  onClick={() => handleSort("averageEngagementTime")}
                >
                  <div className="flex items-center gap-1">
                    <span>Avg Engagement</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort("bounceRate")}
                >
                  <div className="flex items-center gap-1">
                    <span>Bounce Rate</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No page views recorded in this period.
                  </td>
                </tr>
              ) : (
                filteredPages.map((p: any, idx: number) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="py-3 px-3 max-w-md">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {p.pageTitle || "(no title)"}
                      </div>
                      <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                        <span>{p.pagePath}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                      {(p.screenPageViews || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {(p.activeUsers || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {formatDuration(p.averageEngagementTime || 0)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {formatPercent(p.bounceRate || 0)}
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
