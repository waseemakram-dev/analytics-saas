"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import {
  Share2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Lock,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

function IntegrationsContent() {
  const { workspace, reloadProperties } = useDashboard();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectModalAcc, setDisconnectModalAcc] = useState<any | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");
    if (successParam) {
      setBanner({
        type: "success",
        message: "Google Analytics account connected successfully! Properties are now available.",
      });
    } else if (errorParam) {
      setBanner({
        type: "error",
        message: `Authentication error: ${decodeURIComponent(errorParam)}`,
      });
    }
  }, [searchParams]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getConnectedGoogleAccounts();
      if (res.success && res.data?.accounts) {
        setAccounts(res.data.accounts);
      }
    } catch (err: any) {
      console.error("Failed to load connected Google accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleStartConnect = async () => {
    setConnecting(true);
    setBanner(null);
    try {
      const res = await api.getGa4ConnectUrl(workspace?.id);
      if (res.success && res.data?.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
      } else {
        setBanner({
          type: "error",
          message: res.error?.message || "Failed to initiate Google OAuth authorization flow.",
        });
        setConnecting(false);
      }
    } catch (err: any) {
      setBanner({
        type: "error",
        message: err.message || "Failed to initiate OAuth flow.",
      });
      setConnecting(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectModalAcc) return;
    setDisconnectingId(disconnectModalAcc.id);
    try {
      const res = await api.disconnectGoogleAccount(disconnectModalAcc.id);
      if (res.success) {
        setBanner({
          type: "success",
          message: `Disconnected Google account "${disconnectModalAcc.email}".`,
        });
        setDisconnectModalAcc(null);
        await loadAccounts();
        await reloadProperties();
      } else {
        setBanner({
          type: "error",
          message: res.error?.message || "Failed to disconnect account.",
        });
      }
    } catch (err: any) {
      setBanner({
        type: "error",
        message: err.message || "Network error disconnecting account.",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Integrations & OAuth Connections
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          Connect your Google Analytics 4 accounts securely using OAuth 2.0. Tokens are encrypted at rest using AES-256-GCM in local PostgreSQL.
        </p>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
            banner.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-medium">{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-gray-400 hover:text-gray-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Connect Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-800/60 border border-indigo-700/60 text-xs font-semibold text-indigo-200 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Verified Google OAuth 2.0 Integration
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            Connect Google Analytics 4
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed mb-6">
            Grant read-only permissions to your GA4 accounts and properties. We never request edit permissions or access to sensitive billing settings.
          </p>

          <button
            type="button"
            onClick={handleStartConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs sm:text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-60 cursor-pointer"
          >
            <Share2 className={`w-4 h-4 text-indigo-600 ${connecting ? "animate-spin" : ""}`} />
            {connecting ? "Opening Google OAuth..." : "Connect Google Analytics Account"}
          </button>
        </div>
      </div>

      {/* Connected Accounts List */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Connected Accounts ({accounts.length})
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          Authorized Google identities providing GA4 data to this workspace.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <Share2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              No Google accounts connected
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-4">
              Click the button above to authenticate with Google and sync your properties.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {acc.email}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {acc.status || "Active"}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> AES-256-GCM
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                    <div>
                      Linked Properties:{" "}
                      <strong className="text-gray-700 dark:text-gray-300">
                        {acc._count?.connectedProperties ?? acc.connectedProperties?.length ?? 0}
                      </strong>
                    </div>
                    <div>
                      Scopes Authorized:{" "}
                      <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                        analytics.readonly, analytics.manage.users.readonly
                      </span>
                    </div>
                    {acc.connectedAt && (
                      <div>
                        Connected: {new Date(acc.connectedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/websites"
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    View Properties
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDisconnectModalAcc(acc)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disconnect Confirm Modal */}
      {disconnectModalAcc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Disconnect Google Account?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Disconnecting <strong>{disconnectModalAcc.email}</strong> will revoke access tokens and remove associated property feeds from your dashboard.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDisconnectModalAcc(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={disconnectingId === disconnectModalAcc.id}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {disconnectingId === disconnectModalAcc.id ? "Disconnecting..." : "Yes, Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-400">Loading Integrations...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
