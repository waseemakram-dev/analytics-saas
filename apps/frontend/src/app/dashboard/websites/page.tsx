"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { api } from "@/lib/api";
import {
  Globe,
  PlusCircle,
  CheckCircle2,
  Trash2,
  Star,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Building,
} from "lucide-react";
import Link from "next/link";

export default function WebsitesPage() {
  const { properties, reloadProperties, selectedProperty, setSelectedProperty } = useDashboard();
  const [googleAccounts, setGoogleAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [discoveredProperties, setDiscoveredProperties] = useState<any[]>([]);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Link property modal state
  const [linkingProp, setLinkingProp] = useState<any | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState<string>("");
  const [makeDefaultInput, setMakeDefaultInput] = useState<boolean>(false);

  // Unlink confirm modal state
  const [unlinkingProp, setUnlinkingProp] = useState<any | null>(null);

  const loadGoogleAccounts = useCallback(async () => {
    try {
      const res = await api.getConnectedGoogleAccounts();
      if (res.success && res.data?.accounts) {
        setGoogleAccounts(res.data.accounts);
        if (res.data.accounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(res.data.accounts[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load connected Google accounts:", err);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadGoogleAccounts();
  }, [loadGoogleAccounts]);

  const discoverGoogleProperties = useCallback(async () => {
    if (!selectedAccountId) return;
    setDiscovering(true);
    setMessage(null);
    try {
      const res = await api.getProperties(selectedAccountId);
      if (res.success && res.data?.properties) {
        setDiscoveredProperties(res.data.properties);
      } else {
        setMessage({
          type: "error",
          text: res.error?.message || "Failed to discover properties from Google Analytics Admin API.",
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to query Google Admin API." });
    } finally {
      setDiscovering(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) {
      discoverGoogleProperties();
    }
  }, [selectedAccountId, discoverGoogleProperties]);

  const handleSetDefault = async (propId: string) => {
    setActionLoading(propId);
    setMessage(null);
    try {
      const res = await api.setDefaultProperty(propId);
      if (res.success) {
        setMessage({ type: "success", text: "Default property updated successfully." });
        await reloadProperties();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to set default property." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Request failed." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmUnlink = async () => {
    if (!unlinkingProp) return;
    setActionLoading(unlinkingProp.id);
    setMessage(null);
    try {
      const res = await api.unlinkProperty(unlinkingProp.id);
      if (res.success) {
        setMessage({ type: "success", text: `Unlinked "${unlinkingProp.displayName || unlinkingProp.propertyId}".` });
        setUnlinkingProp(null);
        await reloadProperties();
        if (selectedProperty?.id === unlinkingProp.id) {
          setSelectedProperty(null);
        }
        if (selectedAccountId) {
          discoverGoogleProperties();
        }
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to unlink property." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Request failed." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenLinkModal = (prop: any) => {
    setLinkingProp(prop);
    setDisplayNameInput(prop.displayName || `GA4 Property ${prop.propertyId}`);
    setMakeDefaultInput(properties.length === 0);
  };

  const handleConfirmLink = async () => {
    if (!linkingProp || !selectedAccountId) return;
    setActionLoading(linkingProp.propertyId);
    setMessage(null);
    try {
      const res = await api.linkProperty({
        integrationAccountId: selectedAccountId,
        propertyId: linkingProp.propertyId,
        displayName: displayNameInput.trim() || linkingProp.displayName,
        currencyCode: linkingProp.currencyCode,
        timeZone: linkingProp.timeZone,
        isDefault: makeDefaultInput,
      });

      if (res.success) {
        setMessage({ type: "success", text: `Linked "${displayNameInput}" to workspace!` });
        setLinkingProp(null);
        await reloadProperties();
        discoverGoogleProperties();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to link property." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to link property." });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Connected Websites & GA4 Properties
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          Manage Google Analytics 4 properties linked to your workspace. Set your primary property for default reports or link additional websites.
        </p>
      </div>

      {/* Status Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-medium">{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* 1. Currently Linked Properties */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Linked Workspace Properties ({properties.length})
            </h2>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <Globe className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              No GA4 properties currently linked
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-4">
              Connect a Google Analytics account below to discover and link your website properties.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map((prop) => {
              const isDefault = prop.isDefault;
              const isCurrentlySelected = selectedProperty?.id === prop.id;

              return (
                <div
                  key={prop.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isDefault
                      ? "bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800/60"
                      : "bg-gray-50/50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="truncate">
                      <div className="font-bold text-sm text-gray-900 dark:text-white truncate flex items-center gap-2">
                        <span>{prop.displayName || "Untitled Property"}</span>
                        {isDefault && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                            Primary
                          </span>
                        )}
                        {isCurrentlySelected && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Active in View
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                        Property ID: {prop.propertyId}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 my-3 pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                    <div>
                      <span className="text-gray-400">Timezone: </span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {prop.timeZone || "UTC"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Currency: </span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {prop.currencyCode || "USD"}
                      </span>
                    </div>
                    {prop.integrationAccount?.email && (
                      <div className="col-span-2 truncate">
                        <span className="text-gray-400">Account: </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                          {prop.integrationAccount.email}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                    <div>
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(prop.id)}
                          disabled={actionLoading === prop.id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Set as Default
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setUnlinkingProp(prop)}
                      disabled={actionLoading === prop.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Unlink
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Discover Available Properties From Google Analytics */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Discover Properties from Google Analytics
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Query Google Analytics Admin API to find properties accessible by your connected Google Accounts.
            </p>
          </div>

          {googleAccounts.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none"
              >
                {googleAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.email}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={discoverGoogleProperties}
                disabled={discovering}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${discovering ? "animate-spin text-indigo-600" : ""}`} />
                {discovering ? "Querying..." : "Scan Account"}
              </button>
            </div>
          )}
        </div>

        {googleAccounts.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
              No Google Account Connected
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
              You must authenticate with Google Analytics before discovering and linking properties.
            </p>
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Go to Integrations
            </Link>
          </div>
        ) : discovering ? (
          <div className="py-12 flex flex-col items-center justify-center text-xs text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
            Querying Google Analytics Admin API...
          </div>
        ) : discoveredProperties.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            No GA4 properties found in this Google account. Ensure you have 'Viewer' or 'Admin' permissions on at least one GA4 property.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold uppercase">
                  <th className="py-3 px-3">Property Name</th>
                  <th className="py-3 px-3">Property ID</th>
                  <th className="py-3 px-3">Timezone</th>
                  <th className="py-3 px-3">Currency</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {discoveredProperties.map((prop: any) => {
                  const isAlreadyLinked = prop.isLinked;

                  return (
                    <tr key={prop.propertyId} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                        {prop.displayName}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-600 dark:text-gray-400">
                        {prop.propertyId}
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                        {prop.timeZone || "-"}
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                        {prop.currencyCode || "-"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isAlreadyLinked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Linked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenLinkModal(prop)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Link to Workspace
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link Property Modal */}
      {linkingProp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              Link GA4 Property to Workspace
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Configure how this property will appear on your dashboard.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  Property ID
                </label>
                <input
                  type="text"
                  disabled
                  value={linkingProp.propertyId}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 font-mono text-gray-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="e.g. My Online Store"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 mb-1">Timezone</label>
                  <input
                    type="text"
                    disabled
                    value={linkingProp.timeZone || "UTC"}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">Currency</label>
                  <input
                    type="text"
                    disabled
                    value={linkingProp.currencyCode || "USD"}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="makeDefault"
                  checked={makeDefaultInput}
                  onChange={(e) => setMakeDefaultInput(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="makeDefault" className="text-gray-700 dark:text-gray-300 font-medium">
                  Set as default property for this workspace
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setLinkingProp(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLink}
                disabled={actionLoading === linkingProp.propertyId}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {actionLoading === linkingProp.propertyId ? "Linking..." : "Confirm & Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Confirm Modal */}
      {unlinkingProp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Unlink GA4 Property?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to unlink <strong>{unlinkingProp.displayName || unlinkingProp.propertyId}</strong>? This removes it from your dashboard without modifying your Google account.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setUnlinkingProp(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                disabled={actionLoading === unlinkingProp.id}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {actionLoading === unlinkingProp.id ? "Unlinking..." : "Yes, Unlink"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
