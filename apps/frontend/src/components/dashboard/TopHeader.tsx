"use client";

import React, { useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Menu,
  ChevronDown,
  Globe,
  Calendar,
  RefreshCw,
  User,
  LogOut,
  Settings,
  PlusCircle,
  Check,
} from "lucide-react";
import Link from "next/link";

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
  collapsed: boolean;
}

const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

export function TopHeader({ onOpenMobileMenu, collapsed }: TopHeaderProps) {
  const router = useRouter();
  const {
    user,
    workspace,
    properties,
    selectedProperty,
    dateRange,
    setDateRange,
    setSelectedProperty,
    triggerManualRefresh,
  } = useDashboard();

  const [propMenuOpen, setPropMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    triggerManualRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out flex items-center justify-between px-4 sm:px-6 ${
        collapsed ? "left-0 lg:left-20" : "left-0 lg:left-64"
      }`}
    >
      {/* Left: Mobile hamburger & Property Selector */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Property Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPropMenuOpen(!propMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 max-w-[220px] sm:max-w-xs truncate"
          >
            <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="truncate">
              {selectedProperty ? selectedProperty.displayName || selectedProperty.propertyId : "No Property Selected"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
          </button>

          {propMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPropMenuOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60">
                  Select GA4 Property
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {properties.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500 text-center">
                      No connected properties found.
                    </div>
                  ) : (
                    properties.map((prop) => {
                      const isSelected = selectedProperty?.id === prop.id || selectedProperty?.propertyId === prop.propertyId;
                      return (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => {
                            setSelectedProperty(prop);
                            setPropMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            isSelected
                              ? "bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                              : "text-gray-700 dark:text-gray-200"
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="truncate font-medium">{prop.displayName || "Untitled Property"}</div>
                            <div className="text-[10px] text-gray-400">ID: {prop.propertyId} {prop.timeZone ? `• ${prop.timeZone}` : ""}</div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700/60 p-1.5">
                  <Link
                    href="/dashboard/websites"
                    onClick={() => setPropMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Manage & Link Properties
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Date Range, Refresh Button, Theme Toggle, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-transparent border-none text-xs font-medium focus:outline-none cursor-pointer pr-1 text-gray-800 dark:text-gray-200"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={handleRefreshClick}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          title="Refresh Current View"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-semibold">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700/60">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {user?.name || "User"}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || ""}
                  </div>
                  {workspace && (
                    <div className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate">
                      {workspace.name}
                    </div>
                  )}
                </div>

                <div className="p-1">
                  <Link
                    href="/account"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-400" />
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
