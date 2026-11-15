"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  Users,
  Monitor,
  FileText,
  Zap,
  Globe,
  Share2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  {
    section: "Analytics",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Realtime", href: "/dashboard/realtime", icon: Activity, badge: "Live" },
      { name: "Traffic Acquisition", href: "/dashboard/traffic", icon: TrendingUp },
      { name: "Audience & Geo", href: "/dashboard/audience", icon: Users },
      { name: "Technology", href: "/dashboard/technology", icon: Monitor },
      { name: "Pages & Screens", href: "/dashboard/pages", icon: FileText },
      { name: "Events", href: "/dashboard/events", icon: Zap },
    ],
  },
  {
    section: "Configuration",
    items: [
      { name: "Connected Websites", href: "/dashboard/websites", icon: Globe },
      { name: "Integrations", href: "/dashboard/integrations", icon: Share2 },
    ],
  },
];

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
            onClick={onCloseMobile}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-gray-900 dark:text-white tracking-tight truncate">
                  Analytics Intelligence
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-600 dark:text-indigo-400">
                  Beta Release
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_ITEMS.map((group) => (
            <div key={group.section} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.section}
                </div>
              )}
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.name : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                    {!collapsed && (
                      <span className="truncate flex-1">{item.name}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          {!collapsed ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400">
              <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                GA4 Analytics v1.0
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                Google Analytics Data API
              </div>
            </div>
          ) : (
            <div className="flex justify-center text-[10px] text-gray-400 font-bold">
              GA4
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
