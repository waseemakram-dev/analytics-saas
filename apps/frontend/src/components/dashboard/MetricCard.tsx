"use client";

import React from "react";
import { MetricTooltip } from "./MetricTooltip";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  metricKey?: string;
  icon?: LucideIcon;
  subtitle?: string;
  badge?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
    label?: string;
  };
  className?: string;
}

export function MetricCard({
  title,
  value,
  metricKey,
  icon: Icon,
  subtitle,
  badge,
  trend,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200/80 dark:border-gray-700/60 p-5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span>{title}</span>
            {metricKey && <MetricTooltip metricKey={metricKey} />}
          </div>
          {Icon && (
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              {badge}
            </span>
          )}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={`font-medium flex items-center gap-0.5 ${
                trend.isPositive ?? trend.value >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label || "vs prev"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Formats seconds into mm:ss or hh:mm:ss for duration display.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const sec = Math.round(seconds);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h === 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${h}h ${remM.toString().padStart(2, "0")}m`;
}

/**
 * Formats percentages to 1 decimal place with % sign.
 */
export function formatPercent(value: number): string {
  if (isNaN(value)) return "0.0%";
  return `${(value).toFixed(1)}%`;
}
