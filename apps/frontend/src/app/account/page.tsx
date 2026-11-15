"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Building, ShieldCheck, Mail, LogOut, Loader2, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.getProfile();
        if (res.success && res.data) {
          setProfile(res.data);
        } else {
          // If unauthenticated, redirect to login
          router.push("/login?error=session_expired");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load authenticated profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto text-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] mx-auto" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading authenticated profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-lg mx-auto text-center py-16 bg-[var(--card)] p-8 rounded-xl border border-[var(--border)] shadow-sm space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Authentication required."}</p>
        <button
          onClick={() => router.push("/login")}
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const primaryWorkspace = profile.workspaceMembers?.[0]?.workspace;
  const workspaceRole = profile.workspaceMembers?.[0]?.role || "OWNER";

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Account Profile</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Authentication Module End-to-End Verification Page
          </p>
        </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 text-xs font-semibold shadow-xs transition-opacity"
            >
              <span>Go to Dashboard →</span>
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              <span>{loggingOut ? "Signing out..." : "Log Out"}</span>
            </button>
          </div>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm space-y-6">
        {/* User Identity Details */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            User Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
              <User className="w-4 h-4 text-[var(--primary)] mt-0.5" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Full Name</p>
                <p className="font-medium text-[var(--foreground)] mt-0.5">{profile.name || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
              <Mail className="w-4 h-4 text-[var(--primary)] mt-0.5" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Email Address</p>
                <p className="font-medium text-[var(--foreground)] mt-0.5">{profile.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
              <ShieldCheck className="w-4 h-4 text-[var(--primary)] mt-0.5" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">System Role</p>
                <p className="font-medium text-[var(--foreground)] mt-0.5">{profile.role}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
              {profile.emailVerified ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
              ) : (
                <Clock className="w-4 h-4 text-amber-500 mt-0.5" />
              )}
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Verification Status</p>
                <p className="font-medium text-[var(--foreground)] mt-0.5">
                  {profile.emailVerified ? "Verified" : "Pending Verification"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Details */}
        <div className="space-y-4 pt-4 border-t border-[var(--border)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Provisioned Workspace
          </h2>
          <div className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm text-[var(--foreground)]">
                  {primaryWorkspace?.name || "Personal Workspace"}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">Slug: {primaryWorkspace?.slug || "personal"}</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--accent)] text-[var(--accent-foreground)] border border-[var(--border)]">
              Role: {workspaceRole}
            </span>
          </div>
        </div>

        <div className="pt-2 text-center text-xs text-[var(--muted-foreground)]">
          Live Backend Connection Verified on Port 3001 | Local PostgreSQL Active
        </div>
      </div>
    </div>
  );
}
