"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromUrl);
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token || !email) {
      setError("Reset token and email address are required.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.resetPassword({ email, token, newPassword });

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error?.message || "Failed to reset password. The link may have expired or already been used.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Set a new password</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">
          Your new password must be different from previously used passwords
        </p>
      </div>

      <div className="bg-[var(--card)] p-8 rounded-xl border border-[var(--border)] shadow-sm space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Reset Failed</p>
              <p className="mt-0.5">{error}</p>
              <div className="mt-2">
                <Link href="/forgot-password" className="font-semibold underline text-red-800 dark:text-red-200 text-xs">
                  Request a new password reset link
                </Link>
              </div>
            </div>
          </div>
        )}

        {success ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Password Changed!</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Your password has been successfully updated. All active sessions have been invalidated.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Sign In With New Password
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!emailFromUrl && (
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            )}

            {!tokenFromUrl && (
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Reset Token</label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token from email"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Confirm New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--primary)] flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? "Resetting password..." : "Reset Password"}</span>
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--primary)]" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
