"use client";

import React from "react";
import { AlertCircle, RefreshCw, BarChart2, PlusCircle, Globe, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5"
          >
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-28 mb-3" />
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-3" />
            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-36" />
          </div>
        ))}
      </div>

      {/* Main Chart Card Skeleton */}
      <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-48" />
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-40" />
        </div>
        <div className="h-64 bg-gray-300/60 dark:bg-gray-700/40 rounded-lg flex items-center justify-center">
          <BarChart2 className="w-12 h-12 text-gray-400 dark:text-gray-600 animate-bounce" />
        </div>
      </div>

      {/* Secondary Table Skeleton */}
      <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 space-y-4">
        <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-36" />
        <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "No data available",
  description = "No traffic or events have been recorded for this property in the selected date range.",
  actionText = "Manage Connected Properties",
  actionHref = "/dashboard/websites",
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-xs">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-inner">
        {icon || <Globe className="w-7 h-7" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          {actionText}
        </Link>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  details?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Failed to load Google Analytics data",
  details,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-center">
      <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-900 dark:text-rose-200 mb-1">{message}</h3>
      {details && (
        <p className="text-xs font-mono text-rose-700 dark:text-rose-400/90 max-w-lg mb-5 bg-white/60 dark:bg-black/30 p-2.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40 break-words">
          {details}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
}

interface ReportHeaderProps {
  title: string;
  description: string;
  propertyName?: string;
  timeZone?: string;
  currencyCode?: string;
  isCached?: boolean;
  fetchedAt?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ReportHeader({
  title,
  description,
  propertyName,
  timeZone,
  currencyCode,
  isCached,
  fetchedAt,
  onRefresh,
  isRefreshing,
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
          {propertyName && (
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
              {propertyName}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
          {timeZone && <span>Timezone: {timeZone}</span>}
          {currencyCode && <span>• Currency: {currencyCode}</span>}
          {fetchedAt && (
            <span>
              • Last synced: {new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-center">
        {isCached !== undefined && (
          <span
            className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
              isCached
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40"
            }`}
          >
            {isCached ? "PostgreSQL Cache" : "Live GA4 API"}
          </span>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-50"
            title="Force refresh data directly from Google Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
            {isRefreshing ? "Syncing..." : "Sync Fresh Data"}
          </button>
        )}
      </div>
    </div>
  );
}
