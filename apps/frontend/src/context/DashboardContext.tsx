"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export interface ConnectedPropertyItem {
  id: string;
  workspaceId: string;
  integrationAccountId: string;
  propertyId: string;
  displayName: string;
  accountName?: string;
  currencyCode?: string;
  timeZone?: string;
  isDefault: boolean;
  status: string;
  lastFetchedAt?: string;
  integrationAccount?: {
    id: string;
    email: string;
    status: string;
  };
}

interface DashboardContextType {
  user: any | null;
  workspace: any | null;
  properties: ConnectedPropertyItem[];
  selectedProperty: ConnectedPropertyItem | null;
  dateRange: string;
  loading: boolean;
  refreshKey: number;
  setDateRange: (range: string) => void;
  setSelectedProperty: (prop: ConnectedPropertyItem | null) => void;
  reloadProperties: () => Promise<void>;
  triggerManualRefresh: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [properties, setProperties] = useState<ConnectedPropertyItem[]>([]);
  const [selectedProperty, setSelectedPropertyState] = useState<ConnectedPropertyItem | null>(null);
  const [dateRange, setDateRange] = useState<string>("30d");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const reloadProperties = useCallback(async () => {
    try {
      const res = await api.getProperties();
      if (res.success && res.data?.properties) {
        const props: ConnectedPropertyItem[] = res.data.properties;
        setProperties(props);

        // Retain or select default property
        setSelectedPropertyState((prev) => {
          if (prev) {
            const stillExists = props.find((p) => p.id === prev.id || p.propertyId === prev.propertyId);
            if (stillExists) return stillExists;
          }
          const defaultProp = props.find((p) => p.isDefault) || props[0] || null;
          return defaultProp;
        });
      }
    } catch (err) {
      console.error("Failed to fetch properties:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      try {
        const profileRes = await api.getProfile();
        const rawData: any = profileRes.data;
        const userData = rawData?.user || (rawData?.id ? rawData : null);

        if (!profileRes.success || !userData) {
          // Unauthenticated, redirect to login
          router.push("/login?error=session_expired");
          return;
        }

        if (mounted) {
          setUser(userData);
          const activeWs = userData.workspaceMembers?.[0]?.workspace || rawData?.workspace || null;
          setWorkspace(activeWs);
        }

        await reloadProperties();
      } catch (err) {
        console.error("Dashboard initialization error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [router, reloadProperties]);

  const setSelectedProperty = (prop: ConnectedPropertyItem | null) => {
    setSelectedPropertyState(prop);
    if (prop) {
      try {
        localStorage.setItem("selected_ga4_property_id", prop.propertyId);
      } catch {
        // Safe fallback
      }
    }
  };

  const triggerManualRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <DashboardContext.Provider
      value={{
        user,
        workspace,
        properties,
        selectedProperty,
        dateRange,
        loading,
        refreshKey,
        setDateRange,
        setSelectedProperty,
        reloadProperties,
        triggerManualRefresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
